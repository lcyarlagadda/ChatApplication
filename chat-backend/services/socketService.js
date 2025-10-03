// services/socketService.js - Fixed version - no auto-read on join

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const sidebarCache = require('./sidebarCacheService');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> { socketId, userInfo }
    this.userSockets = new Map(); // socketId -> userId
    this.conversationRooms = new Map(); // conversationId -> Set of socketIds
    this.activeChats = new Map(); // userId -> conversationId (currently viewing)
    this.userLastActivity = new Map(); // userId -> timestamp (to track when user was last active)
    this.offlineNotifications = new Map(); // userId -> Array of notifications to send when they come online
  }

  async initialize(server) {
    const { Server } = require('socket.io');
    
    // Initialize Socket.IO server first
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      // Optimized ping settings to match client
      pingInterval: 25000,
      pingTimeout: 60000,
      pingTimeoutRetries: 3,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    // Try to configure Redis adapter (optional)
    if (process.env.REDIS_URL && process.env.REDIS_URL !== 'disabled') {
      try {
        console.log('Attempting to initialize Redis adapter...');
        const { createAdapter } = require('@socket.io/redis-adapter');
        const { createClient } = require('redis');
        
        const pubClient = createClient({ 
          url: process.env.REDIS_URL,
          socket: {
            reconnectStrategy: (retries) => {
              if (retries > 3) {
                console.log('Redis connection failed after 3 retries, using default adapter');
                return new Error('Redis connection failed');
              }
              return Math.min(retries * 100, 3000);
            }
          }
        });
        
        const subClient = pubClient.duplicate();
        
        // Add error handlers
        pubClient.on('error', (err) => {
          console.warn('Redis pub client error:', err.message);
        });
        
        subClient.on('error', (err) => {
          console.warn('Redis sub client error:', err.message);
        });
        
        // Try to connect with timeout
        const connectPromise = Promise.all([pubClient.connect(), subClient.connect()]);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Redis connection timeout')), 5000)
        );
        
        await Promise.race([connectPromise, timeoutPromise]);
        
        const adapter = createAdapter(pubClient, subClient);
        this.io.adapter(adapter);
        console.log('✅ Redis adapter initialized for Socket.IO');
        
      } catch (error) {
        console.warn('⚠️ Redis adapter initialization failed:', error.message);
        console.log('📝 Using default Socket.IO adapter (single server mode)');
        console.log('💡 To enable Redis: Install Redis server and set REDIS_URL environment variable');
      }
    } else {
      console.log('📝 Using default Socket.IO adapter (Redis URL not provided)');
    }
    
    console.log('✅ Socket.IO server initialized');
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check token expiration
        if (decoded.exp && decoded.exp < Date.now() / 1000) {
          return next(new Error('Token expired'));
        }
        
        // Get user from database
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
          return next(new Error('User not found'));
        }

        // Attach user to socket
        socket.userId = user._id.toString();
        socket.user = user;
        
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`👋 User connected:`, {
        userId: socket.userId,
        userName: socket.user.name,
        socketId: socket.id
      });
      
      // Store user connection
      this.connectedUsers.set(socket.userId, {
        socketId: socket.id,
        socket: socket,
        userInfo: socket.user,
        connectedAt: new Date()
      });
      
      this.userSockets.set(socket.id, socket.userId);
      
      // Send any pending offline notifications (async, don't await)
      this.sendPendingOfflineNotifications(socket.userId).catch(error => {
        console.error('Error sending pending offline notifications:', error);
      });

      // Add user to online users cache
      sidebarCache.addOnlineUser(socket.userId, {
        socketId: socket.id,
        userName: socket.user.name,
        userEmail: socket.user.email,
        userAgent: socket.handshake.headers['user-agent'],
        connectedAt: new Date().toISOString()
      });

      // Join user to their personal room for notifications
      socket.join(`user_${socket.userId}`);

      // Broadcast user online status
      this.broadcastUserOnline(socket.userId, socket.user);

      // Update user's last seen and online status
      this.updateUserOnlineStatus(socket.userId, true);

      // Handle joining user room - FIXED: Only allow joining own room
      socket.on('join_user_room', (userId) => {
        // Only allow users to join their own room
        if (userId === socket.userId) {
          socket.join(`user_${userId}`);
        }
      });

      // Handle joining conversation rooms - FIXED: No auto-read on join
      socket.on('join_conversation', (conversationId) => {
        socket.join(`conversation_${conversationId}`);
        
        // Track conversation membership
        if (!this.conversationRooms.has(conversationId)) {
          this.conversationRooms.set(conversationId, new Set());
        }
        this.conversationRooms.get(conversationId).add(socket.id);
        
        // Track active chat for message status
        this.activeChats.set(socket.userId, conversationId);
        
        console.log(`User ${socket.user.name} joined conversation ${conversationId}`);
        
        // Auto-mark undelivered messages as delivered when user joins
        this.markUndeliveredMessagesAsDelivered(socket, conversationId);
      });

      // Handle leaving conversation rooms
      socket.on('leave_conversation', (conversationId) => {
        socket.leave(`conversation_${conversationId}`);
        
        // Remove from tracking
        if (this.conversationRooms.has(conversationId)) {
          this.conversationRooms.get(conversationId).delete(socket.id);
        }
        
        // Remove from active chats
        if (this.activeChats.get(socket.userId) === conversationId) {
          this.activeChats.delete(socket.userId);
        }
        
        console.log(`User ${socket.user.name} left conversation ${conversationId}`);
      });

      // Handle explicit conversation view (when user actively opens/focuses chat)
      socket.on('conversation_viewed', async (data) => {
        try {
          const { conversationId } = data;
          
          // Update active chat tracking
          this.activeChats.set(socket.userId, conversationId);
          
          // Update last activity time
          this.userLastActivity.set(socket.userId, new Date());
          
          // Update activity in cache
          await sidebarCache.updateUserActivity(socket.userId);
          
          // Mark conversation messages as seen when explicitly viewed
          await this.markConversationMessagesAsSeen(socket, conversationId);
          
          // Update conversation's lastRead timestamp
          await this.updateConversationLastRead(socket, conversationId);
        } catch (error) {
          console.error('Error handling conversation_viewed:', error);
        }
      });

      // Handle heartbeat/ping from client
      socket.on('ping', () => {
        console.log('Received heartbeat from user:', socket.userId);
        socket.emit('pong');
      });

      // Handle sending messages
      socket.on('send_message', async (data) => {
        try {
          await this.handleSendMessage(socket, data);
        } catch (error) {
          console.error('Error handling send_message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle message status updates
      socket.on('message_delivered', async (data) => {
        try {
          await this.handleMessageDelivered(socket, data);
        } catch (error) {
          console.error('Error handling message_delivered:', error);
        }
      });

      socket.on('message_seen', async (data) => {
        try {
          await this.handleMessageSeen(socket, data);
        } catch (error) {
          console.error('Error handling message_seen:', error);
        }
      });

      socket.on('mark_conversation_read', async (data) => {
        try {
          const { conversationId } = data;
          
          // Update active chat tracking
          this.activeChats.set(socket.userId, conversationId);
          
          const rateLimitKey = `${socket.userId}_${conversationId}`;
          const now = Date.now();
          
          // Rate limit: only allow one call per conversation per 2 seconds
          if (this.lastMarkReadCall && this.lastMarkReadCall[rateLimitKey]) {
            const timeSinceLastCall = now - this.lastMarkReadCall[rateLimitKey];
            if (timeSinceLastCall < 2000) {
              return; // Skip this call if it's too soon
            }
          }
          
          if (!this.lastMarkReadCall) {
            this.lastMarkReadCall = {};
          }
          this.lastMarkReadCall[rateLimitKey] = now;
          
          await this.markConversationMessagesAsSeen(socket, conversationId);
          await this.updateConversationLastRead(socket, conversationId);
        } catch (error) {
          console.error('Error handling mark_conversation_read:', error);
        }
      });

      // Handle editing messages
      socket.on('edit_message', async (data) => {
        try {
          await this.handleEditMessage(socket, data);
        } catch (error) {
          console.error('Error handling edit_message:', error);
          socket.emit('error', { message: 'Failed to edit message' });
        }
      });

      // Handle deleting messages
      socket.on('delete_message', async (data) => {
        try {
          await this.handleDeleteMessage(socket, data);
        } catch (error) {
          console.error('Error handling delete_message:', error);
          socket.emit('error', { message: 'Failed to delete message' });
        }
      });

      // Handle message reactions
      socket.on('react_to_message', async (data) => {
        try {
          await this.handleReactToMessage(socket, data);
        } catch (error) {
          console.error('Error handling react_to_message:', error);
          socket.emit('error', { message: 'Failed to react to message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Handle user status updates
      socket.on('update_status', async (data) => {
        try {
          await this.handleUpdateUserStatus(socket, data);
        } catch (error) {
          console.error('Error handling update_status:', error);
          socket.emit('error', { message: 'Failed to update status' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async (reason) => {
        console.log(`User ${socket.user.name} disconnected:`, reason);
        
        // Remove from online users cache
        await sidebarCache.removeOnlineUser(socket.userId);
        
        // Clean up user tracking
        this.connectedUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);
        this.activeChats.delete(socket.userId);
        this.userLastActivity.delete(socket.userId);
        
        // Clean up conversation rooms
        this.conversationRooms.forEach((sockets, conversationId) => {
          sockets.delete(socket.id);
        });
        
        // Broadcast user offline status
        this.broadcastUserOffline(socket.userId);
        
        // Update user's last seen and offline status
        this.updateUserOnlineStatus(socket.userId, false);
      });

      // Handle connection errors
      socket.on('error', (error) => {
        console.error('Socket error for user', socket.user.name, ':', error);
      });
    });
  }

  async handleSendMessage(socket, data) {
    const { conversationId, content, messageType = 'text', replyTo, tempId } = data;
    
    // Import models here to avoid circular dependencies
    const Message = require('../models/Message');
    const Conversation = require('../models/Conversation');
    
    // Verify user is member of conversation
    const conversation = await Conversation.findById(conversationId)
      .populate('participants.user', 'name email avatar');
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    const isMember = conversation.participants.some(
      p => p.user._id.toString() === socket.userId
    );
    
    if (!isMember) {
      throw new Error('User is not a member of this conversation');
    }
    
    // Create message with initial status
    const messageData = {
      sender: socket.userId,
      conversation: conversationId,
      content,
      messageType,
      status: 'sent',
      deliveredTo: [],
      readBy: []
    };
    
    if (replyTo) {
      messageData.replyTo = replyTo;
    }
    
    // Handle file info
    if (data.fileInfo) {
      messageData.fileInfo = data.fileInfo;
    }
    
    const message = new Message(messageData);
    await message.save();
    
    // Populate sender info
    await message.populate('sender', 'name email avatar');
    if (replyTo) {
      await message.populate('replyTo');
    }
    
    // Update conversation's last message
    conversation.lastMessage = {
      content: message.content,
      sender: message.sender._id,
      timestamp: message.createdAt,
      messageType: message.messageType
    };
    conversation.updatedAt = new Date();
    await conversation.save();
    
    // Emit conversation update to all participants
    // Populate the conversation with all necessary fields before emitting
    await conversation.populate('participants.user', 'name email avatar');
    
    console.log('🔔 Emitting conversation_updated event:', {
      conversationId,
      conversationIdType: typeof conversationId,
      conversationObjectId: conversation._id,
      conversationObjectIdType: typeof conversation._id,
      lastMessage: conversation.lastMessage,
      updatedAt: conversation.updatedAt,
      participantsCount: conversation.participants.length
    });
    
    this.io.to(`conversation_${conversationId}`).emit('conversation_updated', {
      conversation: conversation.toObject(),
      updateType: 'new_message'
    });
    
    // First, confirm message sent to sender with tempId mapping
    socket.emit('message_status_update', {
      messageId: message._id,
      tempId: tempId,
      status: 'sent',
      timestamp: message.createdAt
    });
    
    // Get all participants except sender
    const otherParticipants = conversation.participants
      .filter(p => p.user._id.toString() !== socket.userId);
    
    // Get online participants (excluding sender)
    const onlineParticipants = otherParticipants
      .filter(p => this.isUserOnline(p.user._id.toString()))
      .map(p => p.user._id.toString());
    
    
    // Emit to all users in the conversation
    this.io.to(`conversation_${conversationId}`).emit('new_message', {
      conversationId,
      message: message.toObject()
    });
    
    // Make hidden conversations reappear for all participants when new message arrives
    console.log(`🔄 SOCKET: Calling makeHiddenConversationReappear for conversation ${conversationId}, sender: ${socket.userId}`);
    await this.makeHiddenConversationReappear(conversationId, socket.userId);
    
    // Process delivery status for online users immediately
    if (onlineParticipants.length > 0) {
      // Process delivery immediately for better real-time experience
        await this.processMessageDelivery(message._id, onlineParticipants, socket.userId);
    } else {
    }
    
  }

  async processMessageDelivery(messageId, onlineUserIds, senderId) {
    const Message = require('../models/Message');
    
    try {
      
      // Update message with delivered status for online users
      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }
      
      const deliveredTimestamp = new Date();
      
      // Add each user to deliveredTo array (don't override existing)
      for (const userId of onlineUserIds) {
        const alreadyDelivered = message.deliveredTo.some(
          d => d.user.toString() === userId
        );
        
        if (!alreadyDelivered) {
          message.deliveredTo.push({
        user: userId,
            deliveredAt: deliveredTimestamp
          });
        }
      }
      
      // Update status to delivered if not already read
      if (message.status !== 'read') {
        message.status = 'delivered';
      }
      
        await message.save();
        
        // Notify sender about delivery
      const notificationSent = this.sendNotificationToUser(senderId, 'message_status_update', {
          messageId,
        status: message.status,
        deliveredTo: message.deliveredTo,
        timestamp: deliveredTimestamp
      });
      
      
      // IMMEDIATE: Mark as seen for users who are actively viewing the conversation
        const activeViewers = onlineUserIds.filter(userId => {
          const isViewingConversation = this.activeChats.get(userId) === message.conversation.toString();
        return isViewingConversation;
        });
        
        if (activeViewers.length > 0) {
        // Mark as seen immediately for active viewers
        await this.processMessageSeen(messageId, activeViewers, senderId);
      }
      
    } catch (error) {
      console.error('Error processing message delivery:', error);
    }
  }

  async processMessageSeen(messageId, userIds, senderId) {
    const Message = require('../models/Message');
    
    try {
      const message = await Message.findById(messageId);
      if (!message) return;
      
      const readBy = userIds.map(userId => ({
        user: userId,
        readAt: new Date()
      }));
      
      // Add to existing readBy array (avoid duplicates)
      const existingReadUserIds = message.readBy.map(s => s.user.toString());
      const newReadBy = readBy.filter(s => !existingReadUserIds.includes(s.user.toString()));
      
      if (newReadBy.length > 0) {
        message.readBy.push(...newReadBy);
        message.status = 'read';
        await message.save();
        
        // Notify sender about seen status
        this.sendNotificationToUser(senderId, 'message_status_update', {
          messageId,
          status: 'read',
          readBy: message.readBy.map(s => ({ user: s.user, readAt: s.readAt })),
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('Error processing message seen:', error);
    }
  }

  async handleMessageDelivered(socket, data) {
    const { messageId } = data;
    
    const Message = require('../models/Message');
    
    const message = await Message.findById(messageId);
    if (!message || message.sender.toString() === socket.userId) return;
    
    // Check if already delivered by this user
    const alreadyDelivered = message.deliveredTo.some(
      d => d.user.toString() === socket.userId
    );
    
    if (!alreadyDelivered) {
      message.deliveredTo.push({
        user: socket.userId,
        deliveredAt: new Date()
      });
      
      // Update status to delivered if it was just sent
      if (message.status === 'sent') {
        message.status = 'delivered';
      }
      
      await message.save();
      
      // Update user activity
      this.userLastActivity.set(socket.userId, new Date());
      
      // Notify sender
      this.sendNotificationToUser(message.sender.toString(), 'message_status_update', {
        messageId,
        status: message.status,
        deliveredBy: socket.userId,
        deliveredTo: message.deliveredTo.map(d => d.user),
        timestamp: new Date()
      });
      
    }
  }

  async handleMessageSeen(socket, data) {
    const { messageId } = data;
    
    const Message = require('../models/Message');
    
    const message = await Message.findById(messageId);
    if (!message || message.sender.toString() === socket.userId) return;
    
    // Check if already seen by this user
    const alreadySeen = message.readBy.some(
      s => s.user.toString() === socket.userId
    );
    
    if (!alreadySeen) {
      // Add to delivered list if not already there
      const alreadyDelivered = message.deliveredTo.some(
        d => d.user.toString() === socket.userId
      );
      
      if (!alreadyDelivered) {
        message.deliveredTo.push({
          user: socket.userId,
          deliveredAt: new Date()
        });
      }
      
      // Add to read list
      message.readBy.push({
        user: socket.userId,
        readAt: new Date()
      });
      
      message.status = 'read';
      await message.save();
      
      // Update user activity
      this.userLastActivity.set(socket.userId, new Date());
      
      // Notify sender
      this.sendNotificationToUser(message.sender.toString(), 'message_status_update', {
        messageId,
        status: 'read',
        readBy: message.readBy.map(s => ({ user: s.user, readAt: s.readAt })),
        timestamp: new Date()
      });
      
    }
  }

  async markUndeliveredMessagesAsDelivered(socket, conversationId) {
    const Message = require('../models/Message');
    
    try {
      // Find undelivered messages in conversation (not sent by current user)
      const undeliveredMessages = await Message.find({
        conversation: conversationId,
        sender: { $ne: socket.userId },
        'deliveredTo.user': { $ne: socket.userId },
        isDeleted: { $ne: true }
      });
      
      if (undeliveredMessages.length > 0) {
        const messageIds = undeliveredMessages.map(msg => msg._id);
        
        // Mark messages as delivered (add to deliveredTo array, don't override)
        const deliveredTimestamp = new Date();
        
        for (const messageId of messageIds) {
          const message = await Message.findById(messageId);
          if (message) {
        const alreadyDelivered = message.deliveredTo.some(
          d => d.user.toString() === socket.userId
        );
        
        if (!alreadyDelivered) {
          message.deliveredTo.push({
            user: socket.userId,
                deliveredAt: deliveredTimestamp
              });
              
              if (message.status !== 'read') {
                message.status = 'delivered';
              }
              
        await message.save();
            }
          }
        }

        // Emit delivery status updates to sender
        for (const message of undeliveredMessages) {
          const senderSocket = this.getUserSocket(message.sender.toString());
          if (senderSocket) {
            this.sendNotificationToUser(message.sender.toString(), 'message_status_update', {
          messageId: message._id,
              status: 'delivered',
              timestamp: deliveredTimestamp,
              deliveredTo: message.deliveredTo
            });
          }
        }

      }
    } catch (error) {
      console.error('Error marking messages as delivered:', error);
    }
  }

  async updateConversationLastRead(socket, conversationId) {
    const Conversation = require('../models/Conversation');
    
    try {
      const conversation = await Conversation.findById(conversationId);
      if (conversation) {
        await conversation.markAsRead(socket.userId);
      } else {
      }
    } catch (error) {
      console.error('Error updating conversation lastRead:', error);
    }
  }

  async makeHiddenConversationReappear(conversationId, senderId) {
    const Conversation = require('../models/Conversation');
    const Message = require('../models/Message');
    
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return;
      }
      
      // Find all participants who have hidden this conversation (excluding the sender)
      const hiddenParticipants = conversation.participants.filter(
        p => p.isHidden === true && p.user.toString() !== senderId
      );
      
      if (hiddenParticipants.length === 0) {
        return;
      }
      
      // Make conversation reappear for all hidden participants (except sender)
      for (const participant of hiddenParticipants) {
        participant.isHidden = false;
        participant.hiddenAt = null;
        
        // Don't clear the clearedFor array - keep previously cleared messages cleared
        // The user should only see new messages that arrive after the conversation reappears
        
        // CRITICAL: Invalidate sidebar cache for this user so they get fresh data
        await sidebarCache.invalidateUserSidebar(participant.user.toString());
        
        // ADDITIONAL: Also invalidate conversation-specific cache
        await sidebarCache.invalidateConversationCache(conversationId, [participant.user.toString()]);
        
        // Check if user is online before sending notification
        const isUserOnline = this.isUserOnline(participant.user.toString());
        
        // Get fresh conversation data to send with the event
        const freshConversation = await Conversation.findById(conversationId)
          .populate('participants.user', 'name email avatar status lastSeen isOnline')
          .populate('admin', 'name email avatar')
          .populate('admins', 'name email avatar')
          .populate('lastMessage.sender', 'name avatar');
        
        // Notify the user that the conversation has reappeared with full data
        const notificationSent = this.sendNotificationToUser(
          participant.user.toString(),
          'conversation_reappeared',
          {
            conversationId: conversation._id,
            senderId: senderId,
            timestamp: new Date(),
            conversation: freshConversation ? freshConversation.toObject() : null
          }
        );
        
        // If user is not online, store the notification for when they reconnect
        if (!isUserOnline) {
          // Store the reappeared conversation info for when user comes back online
          await this.storeOfflineNotification(participant.user.toString(), 'conversation_reappeared', {
            conversationId: conversation._id,
            senderId: senderId,
            timestamp: new Date(),
            conversation: freshConversation ? freshConversation.toObject() : null
          });
        }
      }
      
      await conversation.save();
    } catch (error) {
      console.error('Error making hidden conversation reappear:', error);
    }
  }

  async markConversationMessagesAsSeen(socket, conversationId) {
    const Message = require('../models/Message');
    
    try {
      // Find unread messages in conversation (not sent by current user)
      const unreadMessages = await Message.find({
        conversation: conversationId,
        sender: { $ne: socket.userId },
        isDeleted: { $ne: true }
      });
      
      // Filter out messages that are already read by this user
      const filteredUnreadMessages = unreadMessages.filter(message => {
        return !message.readBy.some(readEntry => 
          readEntry.user.toString() === socket.userId
        );
      });
      
      if (filteredUnreadMessages.length === 0) {
        return;
      }
      
      const readTimestamp = new Date();
      
      // Process messages in bulk for better performance
      const messageIds = filteredUnreadMessages.map(msg => msg._id);
      const senderIds = [...new Set(filteredUnreadMessages.map(msg => msg.sender.toString()))];
      
      // Bulk update all messages at once for better performance
      await Message.updateMany(
        { _id: { $in: messageIds } },
        {
          $addToSet: {
            deliveredTo: { user: socket.userId, deliveredAt: readTimestamp },
            readBy: { user: socket.userId, readAt: readTimestamp }
          },
          $set: { status: 'read' }
        }
      );
      
      // Create message updates for notifications
      const messageUpdates = filteredUnreadMessages.map(message => ({
        messageId: message._id,
        senderId: message.sender
      }));
      
      // Update user activity
      this.userLastActivity.set(socket.userId, readTimestamp);
      
      // Notify all senders about seen status
      const senderNotifications = new Map();
      messageUpdates.forEach(({ messageId, senderId }) => {
        if (!senderNotifications.has(senderId.toString())) {
          senderNotifications.set(senderId.toString(), []);
        }
        senderNotifications.get(senderId.toString()).push(messageId);
      });
      
      senderNotifications.forEach((messageIds, senderId) => {
        this.sendNotificationToUser(senderId, 'messages_seen_bulk', {
          messageIds,
          seenBy: socket.userId,
          conversationId,
          timestamp: readTimestamp
        });
      });
      
      
    } catch (error) {
      console.error('Error marking conversation messages as seen:', error);
    }
  }

  // ... rest of your existing methods remain the same ...

  async handleEditMessage(socket, data) {
    const { messageId, content } = data;
    
    const Message = require('../models/Message');
    
    // Find and verify ownership
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }
    
    if (message.sender.toString() !== socket.userId) {
      throw new Error('Unauthorized to edit this message');
    }
    
    // Check if message is too old to edit (15 minutes)
    const messageAge = Date.now() - message.createdAt.getTime();
    if (messageAge > 15 * 60 * 1000) {
      throw new Error('Message is too old to edit');
    }
    
    // Update message
    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();
    
    // Emit to all users in the conversation
    this.io.to(`conversation_${message.conversation}`).emit('message_edited', {
      messageId,
      content,
      editedAt: message.editedAt
    });
    
    console.log(`Message ${messageId} edited by ${socket.user.name}`);
  }

  async handleDeleteMessage(socket, data) {
    const { messageId } = data;
    
    const Message = require('../models/Message');
    
    // Find and verify ownership
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }
    
    if (message.sender.toString() !== socket.userId) {
      throw new Error('Unauthorized to delete this message');
    }
    
    const conversationId = message.conversation.toString();
    
    // Delete message
    await Message.findByIdAndDelete(messageId);
    
    // Emit to all users in the conversation
    this.io.to(`conversation_${conversationId}`).emit('message_deleted', {
      messageId,
      conversationId
    });
    
    console.log(`Message ${messageId} deleted by ${socket.user.name}`);
  }

  async handleReactToMessage(socket, data) {
    const { messageId, emoji } = data;
    
    const Message = require('../models/Message');
    
    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }
    
    // Initialize reactions array if not exists
    if (!message.reactions) {
      message.reactions = [];
    }
    
    // Check if user already reacted with this emoji
    const existingReactionIndex = message.reactions.findIndex(
      r => r.user.toString() === socket.userId && r.emoji === emoji
    );
    
    if (existingReactionIndex !== -1) {
      // Remove existing reaction (toggle off)
      message.reactions.splice(existingReactionIndex, 1);
    } else {
      // Add new reaction
      message.reactions.push({
        user: socket.userId,
        emoji,
        createdAt: new Date()
      });
    }
    
    await message.save();
    
    // Populate user info for reactions
    await message.populate('reactions.user', 'name email avatar');
    
    // Emit to all users in the conversation
    this.io.to(`conversation_${message.conversation}`).emit('message_reaction', {
      messageId,
      reactions: message.reactions
    });
    
    console.log(`Reaction ${emoji} ${existingReactionIndex !== -1 ? 'removed from' : 'added to'} message ${messageId} by ${socket.user.name}`);
  }

  handleTypingStart(socket, data) {
    const { conversationId } = data;
    
    // Update user activity
    this.userLastActivity.set(socket.userId, new Date());
    
    // Broadcast to others in the conversation (exclude sender)
    socket.to(`conversation_${conversationId}`).emit('typing_start', {
      userId: socket.userId,
      userName: socket.user.name,
      conversationId
    });
  }

  handleTypingStop(socket, data) {
    const { conversationId } = data;
    
    // Broadcast to others in the conversation (exclude sender)
    socket.to(`conversation_${conversationId}`).emit('typing_stop', {
      userId: socket.userId,
      userName: socket.user.name,
      conversationId
    });
  }

  async handleUpdateUserStatus(socket, data) {
    const { status } = data;
    
    const User = require('../models/User');
    
    // Update user status in database
    await User.findByIdAndUpdate(socket.userId, { status });
    
    // Update local user info
    socket.user.status = status;
    this.connectedUsers.get(socket.userId).userInfo.status = status;
    
    // Broadcast status update to all connected users
    this.io.emit('user_status_update', {
      userId: socket.userId,
      status
    });
    
    console.log(`User ${socket.user.name} updated status to ${status}`);
  }

  async updateUserOnlineStatus(userId, isOnline) {
    const User = require('../models/User');
    
    try {
      const updateData = isOnline 
        ? { isOnline: true }
        : { isOnline: false, lastSeen: new Date() };
        
      await User.findByIdAndUpdate(userId, updateData);
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  }

  broadcastUserOnline(userId, userInfo) {
    this.io.emit('user_online', {
      userId,
      user: {
        _id: userInfo._id,
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar,
        status: userInfo.status
      }
    });
  }

  broadcastUserOffline(userId) {
    this.io.emit('user_offline', {
      userId
    });
  }

  // Utility methods
  getConnectedUsers() {
    return Array.from(this.connectedUsers.entries()).map(([userId, data]) => ({
      userId,
      ...data
    }));
  }

  getUserSocket(userId) {
    const userConnection = this.connectedUsers.get(userId);
    return userConnection ? userConnection.socket : null;
  }

  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  getOnlineUserIds() {
    return Array.from(this.connectedUsers.keys());
  }

  // Send notification to specific user
  sendNotificationToUser(userId, event, data) {
    const socketId = this.getUserSocket(userId);
    if (socketId) {
      // Send directly to the socket instead of using rooms to avoid cross-user issues
      socketId.emit(event, data);
      return true;
    }
    return false;
  }

  // Send notification to conversation members
  sendNotificationToConversation(conversationId, event, data, excludeUserId = null) {
    if (excludeUserId) {
      // Send to all in conversation except the excluded user
      const excludeSocketId = this.getUserSocket(excludeUserId);
      if (excludeSocketId) {
        this.io.to(`conversation_${conversationId}`).except(excludeSocketId).emit(event, data);
      } else {
        this.io.to(`conversation_${conversationId}`).emit(event, data);
      }
    } else {
      this.io.to(`conversation_${conversationId}`).emit(event, data);
    }
  }

  // Store notification for offline user
  async storeOfflineNotification(userId, event, data) {
    if (!this.offlineNotifications.has(userId)) {
      this.offlineNotifications.set(userId, []);
    }
    
    const notifications = this.offlineNotifications.get(userId);
    notifications.push({
      event,
      data,
      timestamp: new Date()
    });
    
    // Keep only the last 10 notifications per user to prevent memory issues
    if (notifications.length > 10) {
      notifications.splice(0, notifications.length - 10);
    }
    
  }

  // Send pending offline notifications when user comes online
  async sendPendingOfflineNotifications(userId) {
    const notifications = this.offlineNotifications.get(userId);
    if (!notifications || notifications.length === 0) {
      return;
    }
    
    for (const notification of notifications) {
      this.sendNotificationToUser(userId, notification.event, notification.data);
    }
    
    // Clear the notifications after sending
    this.offlineNotifications.delete(userId);
  }
}

// Export singleton instance
module.exports = new SocketService();