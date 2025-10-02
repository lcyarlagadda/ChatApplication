// routes/conversations.js - UPDATED VERSION with proper socket events for immediate updates

const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const sidebarCache = require('../services/sidebarCacheService');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Cache management endpoint
router.post('/cache/clear', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    await sidebarCache.invalidateUserSidebar(userId);
    
    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache'
    });
  }
});

// Clear all cache data (for debugging)
router.post('/cache/clear-all', auth, async (req, res) => {
  try {
    // Clear sidebar cache
    await sidebarCache.invalidateUserSidebar(req.user._id);
    
    // Clear unread counts
    const unreadCounts = await sidebarCache.getAllUnreadCounts(req.user._id);
    for (const [conversationId, count] of Object.entries(unreadCounts)) {
      await sidebarCache.delete('unread', `${req.user._id}:${conversationId}`);
    }
    
    res.json({
      success: true,
      message: 'All cache cleared successfully'
    });
  } catch (error) {
    console.error('Clear all cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear all cache'
    });
  }
});

// Get unread counts for user
router.get('/unread-counts', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const unreadCounts = await sidebarCache.getAllUnreadCounts(userId);
    
    res.json({
      success: true,
      data: unreadCounts
    });
  } catch (error) {
    console.error('Get unread counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread counts'
    });
  }
});

// Get online users
router.get('/online-users', auth, async (req, res) => {
  try {
    const onlineUsers = await sidebarCache.getAllOnlineUsers();
    
    res.json({
      success: true,
      data: onlineUsers,
      count: onlineUsers.length
    });
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get online users'
    });
  }
});

// Get online users count only
router.get('/online-users/count', auth, async (req, res) => {
  try {
    const count = await sidebarCache.getOnlineUsersCount();
    
    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Get online users count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get online users count'
    });
  }
});

// Check if specific user is online
router.get('/online-users/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const isOnline = await sidebarCache.isUserOnline(userId);
    const userInfo = isOnline ? await sidebarCache.getOnlineUserInfo(userId) : null;
    
    res.json({
      success: true,
      isOnline,
      userInfo
    });
  } catch (error) {
    console.error('Check user online status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check user online status'
    });
  }
});

// Debug endpoint to check cache data structure
router.get('/debug/cache', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const cachedSidebar = await sidebarCache.getUserSidebar(userId);
    const onlineUserIds = await sidebarCache.getOnlineUserIds();
    const unreadCounts = await sidebarCache.getAllUnreadCounts(userId);
    
    res.json({
      success: true,
      debug: {
        cachedSidebarType: typeof cachedSidebar,
        isArray: Array.isArray(cachedSidebar),
        cachedSidebarLength: cachedSidebar ? cachedSidebar.length : 0,
        onlineUserIds,
        unreadCounts,
        sampleCachedData: cachedSidebar && cachedSidebar.length > 0 ? cachedSidebar[0] : null
      }
    });
  } catch (error) {
    console.error('Debug cache error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to debug cache'
    });
  }
});


// In your conversation list endpoint
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Check cache first
    const cachedSidebar = await sidebarCache.getUserSidebar(userId);
    console.log(`🔍 Cached sidebar data type:`, typeof cachedSidebar, Array.isArray(cachedSidebar));
    if (cachedSidebar && Array.isArray(cachedSidebar)) {
      // Validate cached data structure before returning
      const validatedCachedData = cachedSidebar.map(conv => {
        if (conv && conv.participants) {
          // Ensure participants have proper structure
          conv.participants = conv.participants.map(participant => {
            if (participant && participant.user) {
              // Ensure user object has all required properties
              if (!participant.user.isOnline) participant.user.isOnline = false;
              if (!participant.user.name) participant.user.name = 'Unknown User';
              if (!participant.user.email) participant.user.email = '';
              if (!participant.user.avatar) participant.user.avatar = '';
              if (!participant.user.status) participant.user.status = 'offline';
              if (!participant.user.lastSeen) participant.user.lastSeen = null;
              if (!participant.user._id) {
                console.warn('Participant user missing _id:', participant);
                return null; // Skip invalid participants
              }
              return participant;
            }
            return participant;
          }).filter(p => p !== null); // Remove null participants
        }
        return conv;
      });
      
      return res.json({
        success: true,
        data: validatedCachedData
      });
    }

    // Cache miss - fetch from database
    console.log(`🔄 Fetching sidebar data from DB for user ${userId}`);
    
    // Clear any potentially corrupted cache data
    await sidebarCache.invalidateUserSidebar(userId);
    
    const user = await User.findById(userId).populate('blockedUsers');
    
    // Get cached unread counts for all conversations
    const cachedUnreadCounts = await sidebarCache.getAllUnreadCounts(userId);
    console.log(`📊 Using cached unread counts:`, cachedUnreadCounts);
    
    // Get online user IDs for status display
    const onlineUserIds = await sidebarCache.getOnlineUserIds();
    console.log(`👥 Online users:`, onlineUserIds);
    
    const conversations = await Conversation.find({
      'participants.user': userId
    })
    .populate({
      path: 'participants.user',
      select: 'name email avatar status lastSeen isOnline blockedUsers'
    })
    .select('+participants.isHidden +participants.hiddenAt')
    .populate('admin', 'name email avatar') 
    .populate('admins', 'name email avatar')
    .populate({
      path: 'lastMessage',
      select: 'content messageType file sender createdAt clearedFor',
      populate: {
        path: 'sender',
        select: 'name avatar'
      }
    })
    .sort({ updatedAt: -1 });

    // Add blocked status to conversations and handle cleared messages
    const conversationsWithBlockStatus = await Promise.all(conversations.map(async (conv) => {
      const convObj = conv.toObject();
      
      // Check if this conversation is hidden for the current user
      const currentUserParticipant = convObj.participants.find(p => p.user._id.toString() === userId.toString());
      if (currentUserParticipant && currentUserParticipant.isHidden) {
        // Check if user left the conversation (has leftAt timestamp)
        if (currentUserParticipant.leftAt) {
          console.log(`CONVERSATION FILTER: User ${userId} - Conversation ${convObj._id} is left (leftAt: ${currentUserParticipant.leftAt}), keeping visible`);
          // Keep the conversation but mark it as left
          convObj.userLeft = true;
          convObj.leftAt = currentUserParticipant.leftAt;
        } else {
          console.log(`CONVERSATION FILTER: User ${userId} - Conversation ${convObj._id} is hidden (isHidden: ${currentUserParticipant.isHidden}, hiddenAt: ${currentUserParticipant.hiddenAt}), filtering out`);
          return null; // Skip this conversation for the current user (regular hidden conversation)
        }
      } else if (currentUserParticipant) {
        console.log(`CONVERSATION FILTER: User ${userId} - Conversation ${convObj._id} is visible (isHidden: ${currentUserParticipant.isHidden}, hiddenAt: ${currentUserParticipant.hiddenAt})`);
      }
      
      if (convObj.type === 'direct') {
        const otherParticipant = convObj.participants.find(p => p.user._id.toString() !== userId.toString());
        
        if (otherParticipant) {
          const otherUser = otherParticipant.user;
          
          // Check if current user blocked other user
          const currentUserBlockedOther = user.blockedUsers?.some(blockedId => blockedId.toString() === otherUser._id.toString());
          
          // Check if other user blocked current user
          const otherUserBlockedCurrent = otherUser.blockedUsers?.some(blockedId => blockedId.toString() === userId.toString());
          
          // Add blocked status to other user object
          otherParticipant.user.isBlockedByCurrentUser = currentUserBlockedOther;
          otherParticipant.user.hasBlockedCurrentUser = otherUserBlockedCurrent;
        }
      }
      
      // Check if all messages in this conversation have been cleared for this user
      const Message = require('../models/Message');
      const remainingMessages = await Message.countDocuments({
        conversation: convObj._id,
        clearedFor: { $ne: userId }
      });
      
      // If no messages remain for this user, set lastMessage to null
      if (remainingMessages === 0) {
        convObj.lastMessage = null;
      } else if (convObj.lastMessage && convObj.lastMessage.clearedFor && convObj.lastMessage.clearedFor.some(clearedUserId => clearedUserId.toString() === userId.toString())) {
        // If the last message specifically has been cleared, set it to null
        convObj.lastMessage = null;
      }
      
      // Add unread count using cached value if available, otherwise calculate from DB
      const cachedUnreadCount = cachedUnreadCounts[convObj._id.toString()];
      if (cachedUnreadCount !== undefined) {
        convObj.unreadCount = cachedUnreadCount;
        console.log(`📊 Using cached unread count for conversation ${convObj._id}: ${cachedUnreadCount}`);
      } else {
        // Fallback to database calculation and cache the result
        const dbUnreadCount = await conv.getUnreadCount(userId);
        convObj.unreadCount = dbUnreadCount;
        await sidebarCache.cacheUnreadCount(userId, convObj._id.toString(), dbUnreadCount);
        console.log(`📊 Calculated and cached unread count for conversation ${convObj._id}: ${dbUnreadCount}`);
      }
      
      // Add online status to participants
      if (convObj.participants && convObj.participants.length > 0) {
        convObj.participants.forEach(participant => {
          if (participant && participant.user && participant.user._id) {
            const participantId = participant.user._id.toString();
            participant.user.isOnline = onlineUserIds.includes(participantId);
            
            // Ensure user object has all required properties
            if (!participant.user.name) participant.user.name = 'Unknown User';
            if (!participant.user.email) participant.user.email = '';
            if (!participant.user.avatar) participant.user.avatar = '';
            if (!participant.user.status) participant.user.status = 'offline';
            if (!participant.user.lastSeen) participant.user.lastSeen = null;
          }
        });
      }
      
      return convObj;
    }));

    // Filter out null values (hidden conversations)
    const filteredConversations = conversationsWithBlockStatus.filter(conv => conv !== null);

    // Cache the sidebar data
    await sidebarCache.cacheUserSidebar(userId, filteredConversations);

    res.json({
      success: true,
      data: filteredConversations
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching conversations'
    });
  }
});

// GET /api/conversations/unread-counts - Get unread counts for all conversations
router.get('/unread-counts', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all conversations where user is a participant
    const conversations = await Conversation.find({
      'participants.user': userId
    }).select('_id participants');


    if (conversations.length === 0) {
      return res.json({
        success: true,
        unreadCounts: {}
      });
    }

    // Calculate unread counts for each conversation
    const unreadCounts = {};
    
    await Promise.all(conversations.map(async (conv) => {
      const count = await conv.getUnreadCount(userId);
      unreadCounts[conv._id.toString()] = count;
    }));


    res.json({
      success: true,
      unreadCounts,
      totalConversations: conversations.length,
      conversationsWithUnread: Object.values(unreadCounts).filter(count => count > 0).length
    });

  } catch (error) {
    console.error('Get unread counts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching unread counts'
    });
  }
});

// GET /api/conversations/:id - Get specific conversation
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const conversation = await Conversation.findById(id)
      .populate('participants.user', 'name email avatar status lastSeen isOnline')
      .populate('admin', 'name email avatar')
      .populate('admins', 'name email avatar')
      .populate('lastMessage.sender', 'name avatar');
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    // Check if user is participant
    if (!conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation'
      });
    }
    
    const unreadCount = await conversation.getUnreadCount(userId);
    
    res.json({
      success: true,
      data: {
        ...conversation.toObject(),
        unreadCount
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
      error: error.message
    });
  }
});

// POST /api/conversations - Create new conversation (FIXED)
router.post('/', async (req, res) => {
  try {
    const { type, name, description, participants, avatar, admins = [], isBroadcast } = req.body;
    const userId = req.user.id;
    
    // Validation
    if (!type || !['direct', 'group', 'broadcast'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Valid conversation type is required (direct, group, or broadcast)'
      });
    }
    
    if ((type === 'group' || type === 'broadcast') && !name?.trim()) {
      return res.status(400).json({
        success: false,
        message: `${type === 'broadcast' ? 'Channel' : 'Group'} name is required`
      });
    }
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one participant is required'
      });
    }

    // Validate that all participants exist
    const validParticipants = await User.find({
      _id: { $in: participants }
    }).select('_id name email');

    if (validParticipants.length !== participants.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more participants not found'
      });
    }

    let conversation;

    // Handle direct conversations
    if (type === 'direct') {
      if (participants.length !== 1) {
        return res.status(400).json({
          success: false,
          message: 'Direct conversation requires exactly one other participant'
        });
      }
      
      const otherUserId = participants[0];
      
      // Check if direct conversation already exists
      conversation = await Conversation.findOrCreateDirect(userId, otherUserId);
      
      // Emit Socket.IO events
      if (req.socketService) {
        // Get creator info
        const creator = await User.findById(userId).select('name email avatar');
        
        req.socketService.sendNotificationToUser(userId, 'conversation_created', {
          conversation: conversation.toObject(),
          createdBy: creator
        });
        req.socketService.sendNotificationToUser(otherUserId, 'conversation_created', {
          conversation: conversation.toObject(),
          createdBy: creator
        });
      }
      
      return res.status(201).json({
        success: true,
        data: conversation,
        message: 'Direct conversation created successfully'
      });
    }

    // Handle group conversations
    if (type === 'group') {
      conversation = await Conversation.createGroup(userId, participants, name.trim(), {
        description: description?.trim() || '',
        avatar: avatar || '👥',
        admins: Array.isArray(admins) ? admins : []
      });
      
      await conversation.populate([
        { path: 'participants.user', select: 'name email avatar status lastSeen isOnline' },
        { path: 'admin', select: 'name email avatar' },
        { path: 'admins', select: 'name email avatar' }
      ]);
      
      // Create system message
      const systemMessage = new Message({
        conversation: conversation._id,
        sender: userId,
        content: `${req.user.name} created the group "${name.trim()}"`,
        messageType: 'system'
      });
      await systemMessage.save();
      await systemMessage.populate('sender', 'name avatar');
      
      // Update conversation's last message
      await conversation.updateLastMessage({
        content: systemMessage.content,
        _id: systemMessage._id,
        sender: systemMessage.sender._id,
        timestamp: systemMessage.createdAt,
        messageType: 'system'
      });
    }

    // Handle broadcast conversations
    if (type === 'broadcast') {
      conversation = await Conversation.createBroadcast(userId, participants, name.trim(), {
        description: description?.trim() || '',
        avatar: avatar || '📢',
        admins: Array.isArray(admins) ? admins : []
      });
      
      await conversation.populate([
        { path: 'participants.user', select: 'name email avatar status lastSeen isOnline' },
        { path: 'admin', select: 'name email avatar' },
        { path: 'admins', select: 'name email avatar' }
      ]);
      
      // Create system message
      const systemMessage = new Message({
        conversation: conversation._id,
        sender: userId,
        content: `${req.user.name} created the broadcast channel "${name.trim()}"`,
        messageType: 'system'
      });
      await systemMessage.save();
      await systemMessage.populate('sender', 'name avatar');
      
      // Update conversation's last message
      await conversation.updateLastMessage({
        content: systemMessage.content,
        _id: systemMessage._id,
        sender: systemMessage.sender._id,
        timestamp: systemMessage.createdAt,
        messageType: 'system'
      });
    }

    // Emit Socket.IO event to all participants
    if (req.socketService && conversation) {
      // Get creator info
      const creator = await User.findById(userId).select('name email avatar');
      
      conversation.participants.forEach(participant => {
        req.socketService.sendNotificationToUser(
          participant.user._id.toString(), 
          'conversation_created', 
          { 
            conversation: conversation.toObject(),
            createdBy: creator
          }
        );
      });
    }
    
    res.status(201).json({
      success: true,
      data: conversation,
      message: `${type === 'broadcast' ? 'Broadcast channel' : 'Group'} created successfully`
    });

  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/users/:userId/conversation - Create direct conversation (for frontend compatibility)
router.post('/users/:userId/conversation', async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.user.id;
    
    if (otherUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create conversation with yourself'
      });
    }
    
    // Check if other user exists
    const otherUser = await User.findById(otherUserId).select('name email avatar');
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Find or create direct conversation
    const conversation = await Conversation.findOrCreateDirect(currentUserId, otherUserId);
    
    // Emit Socket.IO events
    if (req.socketService) {
      // Get creator info
      const creator = await User.findById(currentUserId).select('name email avatar');
      
      req.socketService.sendNotificationToUser(currentUserId, 'conversation_created', {
        conversation: conversation.toObject(),
        createdBy: creator
      });
      req.socketService.sendNotificationToUser(otherUserId, 'conversation_created', {
        conversation: conversation.toObject(),
        createdBy: creator
      });
    }
    
    res.status(201).json({
      success: true,
      conversation: conversation,
      message: 'Direct conversation created successfully'
    });
    
  } catch (error) {
    console.error('Error creating direct conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/conversations/:id/admins - Add admin to group/broadcast (ENHANCED with immediate socket updates)
router.post('/:id/admins', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const currentUserId = req.user.id;
    
    const conversation = await Conversation.findById(id)
      .populate('participants.user', 'name email avatar')
      .populate('admin', 'name email avatar')
      .populate('admins', 'name email avatar');
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    if (conversation.type === 'direct') {
      return res.status(400).json({
        success: false,
        message: 'Cannot add admins to direct conversations'
      });
    }
    
    // Check if current user is admin
    if (!conversation.isAdmin(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can add other admins'
      });
    }
    
    // Check if user is a participant
    if (!conversation.isParticipant(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User must be a participant to become an admin'
      });
    }
    
    // Check if user is already an admin
    if (conversation.isAdmin(userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already an admin'
      });
    }
    
    // Add to admins array
    if (!conversation.admins) {
      conversation.admins = [];
    }
    conversation.admins.push(userId);
    
    // Update participant role
    const participant = conversation.participants.find(p => p.user._id.toString() === userId);
    if (participant) {
      participant.role = 'admin';
    }
    
    await conversation.save();
    
    // Re-populate after save to get updated data
    await conversation.populate([
      { path: 'participants.user', select: 'name email avatar status lastSeen isOnline' },
      { path: 'admin', select: 'name email avatar' },
      { path: 'admins', select: 'name email avatar' }
    ]);
    
    // Removed admin promotion system message creation
    
    // ENHANCED: Emit Socket.IO events for immediate updates
    if (req.socketService) {
      // Removed admin added notification broadcast
      
      // Removed system message socket event

      // Make hidden conversations reappear for all participants when system message arrives
      await req.socketService.makeHiddenConversationReappear(id, req.user.id);
    }
    
    // Invalidate sidebar cache for all participants
    const participantIds = conversation.participants.map(p => p.user._id.toString());
    await sidebarCache.invalidateConversationMetadata(conversation._id.toString(), participantIds);
    
    res.json({
      success: true,
      data: conversation,
      message: 'Admin added successfully'
    });
  } catch (error) {
    console.error('Error adding admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add admin',
      error: error.message
    });
  }
});

// DELETE /api/conversations/:id/admins/:adminId - Remove admin (ENHANCED with immediate socket updates)
router.delete('/:id/admins/:adminId', async (req, res) => {
  try {
    const { id, adminId } = req.params;
    const currentUserId = req.user.id;
    
    const conversation = await Conversation.findById(id)
      .populate('participants.user', 'name email avatar')
      .populate('admin', 'name email avatar')
      .populate('admins', 'name email avatar');
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    // Check if current user is admin
    if (!conversation.isAdmin(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can remove other admins'
      });
    }
    
    // Cannot remove the main admin
    if (conversation.admin.toString() === adminId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the main administrator'
      });
    }
    
    // Remove from admins array
    conversation.admins = conversation.admins.filter(user => user._id.toString() !== adminId);
    
    // Update participant role
    const participant = conversation.participants.find(p => p.user._id.toString() === adminId);
    if (participant) {
      participant.role = 'member';
    }
    
    await conversation.save();
    
    // Re-populate after save to get updated data
    await conversation.populate([
      { path: 'participants.user', select: 'name email avatar status lastSeen isOnline' },
      { path: 'admin', select: 'name email avatar' },
      { path: 'admins', select: 'name email avatar' }
    ]);
    
    // Get user info for system message
    const removedAdmin = await User.findById(adminId);
    
    // Create system message
    const systemMessage = new Message({
      conversation: conversation._id,
      sender: currentUserId,
      content: `${req.user.name} removed ${removedAdmin.name} from administrators`,
      messageType: 'system'
    });
    await systemMessage.save();
    await systemMessage.populate('sender', 'name avatar');
    
    // Update conversation's last message
    await conversation.updateLastMessage({
      content: systemMessage.content,
      _id: systemMessage._id,
      sender: systemMessage.sender._id,
      timestamp: systemMessage.createdAt,
      messageType: 'system'
    });
    
    // ENHANCED: Emit Socket.IO events for immediate updates
    if (req.socketService) {
      // Removed admin removed notification broadcast
      
      // Also send the new system message
      req.socketService.sendNotificationToConversation(
        id,
        'new_message',
        { 
          conversationId: id,
          message: systemMessage.toObject()
        }
      );

      // Make hidden conversations reappear for all participants when system message arrives
      await req.socketService.makeHiddenConversationReappear(id, req.user.id);
    }
    
    // Invalidate sidebar cache for all participants
    const participantIds = conversation.participants.map(p => p.user._id.toString());
    await sidebarCache.invalidateConversationMetadata(conversation._id.toString(), participantIds);
    
    res.json({
      success: true,
      data: conversation,
      message: 'Admin removed successfully'
    });
  } catch (error) {
    console.error('Error removing admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove admin',
      error: error.message
    });
  }
});

// PUT /api/conversations/:id - Update conversation
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, avatar } = req.body;
    const userId = req.user.id;
    
    const conversation = await Conversation.findById(id)
      .populate('participants.user', 'name email avatar status lastSeen isOnline')
      .populate('admin', 'name email avatar')
      .populate('admins', 'name email avatar');
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    // Check if user is admin
    if (!conversation.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update conversation settings'
      });
    }
    
    // Update fields
    const updates = [];
    if (name && name.trim() !== conversation.name) {
      conversation.name = name.trim();
      updates.push(`changed the ${conversation.type === 'broadcast' ? 'channel' : 'group'} name to "${name.trim()}"`);
    }
    if (description !== undefined && description.trim() !== conversation.description) {
      conversation.description = description.trim();
      updates.push('updated the description');
    }
    if (avatar && avatar !== conversation.avatar) {
      conversation.avatar = avatar;
      updates.push('changed the avatar');
    }
    
    await conversation.save();
    
    // Create system message for updates
    if (updates.length > 0) {
      const systemMessage = new Message({
        conversation: conversation._id,
        sender: userId,
        content: `${req.user.name} ${updates.join(' and ')}`,
        messageType: 'system'
      });
      await systemMessage.save();
      await systemMessage.populate('sender', 'name avatar');
      
      // Update conversation's last message
      await conversation.updateLastMessage({
        content: systemMessage.content,
        _id: systemMessage._id,
        sender: systemMessage.sender._id,
        timestamp: systemMessage.createdAt,
        messageType: 'system'
      });
      
      // Send system message via socket
      if (req.socketService) {
        req.socketService.sendNotificationToConversation(
          id,
          'new_message',
          { 
            conversationId: id,
            message: systemMessage.toObject()
          }
        );

        // Make hidden conversations reappear for all participants when system message arrives
        await req.socketService.makeHiddenConversationReappear(id, req.user.id);
      }
    }
    
    // Emit Socket.IO event for conversation update
    if (req.socketService) {
      req.socketService.sendNotificationToConversation(
        id,
        'conversation_updated',
        { 
          conversation: conversation.toObject(),
          updateType: 'settings_updated'
        }
      );
    }
    
    // Invalidate sidebar cache for all participants
    const participantIds = conversation.participants.map(p => p.user._id.toString());
    await sidebarCache.invalidateConversationMetadata(conversation._id.toString(), participantIds);
    
    res.json({
      success: true,
      data: conversation,
      message: 'Conversation updated successfully'
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conversation',
      error: error.message
    });
  }
});

// Helper function to clear chat for a user
const clearChatForUser = async (conversationId, userId) => {
  console.log(`🧹 CLEAR CHAT: Clearing messages for user ${userId} in conversation ${conversationId}`);
  
  // First, let's see how many messages exist in this conversation
  const totalMessages = await Message.countDocuments({ conversation: conversationId });
  console.log(`🧹 CLEAR CHAT: Total messages in conversation: ${totalMessages}`);
  
  // Check how many are already cleared for this user
  const alreadyCleared = await Message.countDocuments({ 
    conversation: conversationId,
    clearedFor: userId 
  });
  console.log(`🧹 CLEAR CHAT: Messages already cleared for user ${userId}: ${alreadyCleared}`);
  
  // Add user to clearedFor array in all messages instead of deleting them
  const result = await Message.updateMany(
    { 
      conversation: conversationId,
      clearedFor: { $ne: userId } // Only update messages not already cleared for this user
    },
    { 
      $addToSet: { clearedFor: userId }
    }
  );
  
  console.log(`🧹 CLEAR CHAT: Updated ${result.modifiedCount} messages for user ${userId}`);
  console.log(`🧹 CLEAR CHAT: Matched ${result.matchedCount} messages, acknowledged: ${result.acknowledged}`);

  // Update the participant's lastRead timestamp
  const conversation = await Conversation.findById(conversationId);
  const participant = conversation.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant) {
    participant.lastRead = new Date();
    await conversation.save();
    console.log(`🧹 CLEAR CHAT: Updated lastRead timestamp for user ${userId}`);
  }
};

// Delete conversation (user-specific) - first clears chat, then hides conversation
router.post('/:conversationId/delete', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Find the conversation
    const conversation = await Conversation.findById(conversationId).populate('participants.user');
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(
      p => p.user._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this conversation'
      });
    }

    console.log(`🗑️ DELETE CHAT: User ID type: ${typeof userId}, value: ${userId}`);
    await clearChatForUser(conversationId, userId);

    // Step 2: Hide the conversation for this user
    const participant = conversation.participants.find(
      p => p.user._id.toString() === userId.toString()
    );
    
    if (participant) {
      participant.isHidden = true;
      participant.hiddenAt = new Date();
      participant.lastRead = new Date(); // Mark as read to prevent unread notifications
      await conversation.save();
      
    }

    if (req.socketService) {
      req.socketService.sendNotificationToUser(userId.toString(), 'conversation_deleted', {
        conversationId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully. It will reappear when someone sends a new message.'
    });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting conversation'
    });
  }
});

// DELETE /api/conversations/:id - Delete conversation permanently (ADMIN ONLY for groups/broadcasts)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const conversation = await Conversation.findById(id);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    // For direct conversations, redirect to soft delete
    if (conversation.type === 'direct') {
      return res.status(400).json({
        success: false,
        message: 'Direct conversations cannot be permanently deleted. Use the soft delete endpoint instead.'
      });
    }
    
    // For groups/broadcasts, only admin can permanently delete
    if (!conversation.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can permanently delete this conversation'
      });
    }
    
    // Get conversation data before deletion for socket event
    const conversationData = {
      _id: conversation._id,
      type: conversation.type,
      name: conversation.name,
      participants: conversation.participants
    };
    
    // Emit Socket.IO event to all participants before deletion
    if (req.socketService) {
      conversation.participants.forEach(participant => {
        req.socketService.sendNotificationToUser(
          participant.user.toString(),
          'conversation_deleted',
          { 
            conversationId: id, 
            deletedBy: userId,
            conversationType: conversation.type 
          }
        );
      });
    }
    
    // Delete all messages in conversation
    await Message.deleteMany({ conversation: id });
    
    // Delete conversation
    await Conversation.findByIdAndDelete(id);

    
    res.json({
      success: true,
      message: `${conversation.type === 'broadcast' ? 'Broadcast channel' : 'Group'} deleted permanently`,
      conversationId: id,
      deletedBy: userId
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation',
      error: error.message
    });
  }
});

// POST /api/conversations/:id/participants - Add participant to group/broadcast (ENHANCED)
router.post('/:id/participants', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: newParticipantId, role = 'member' } = req.body;
    const currentUserId = req.user.id;
    
    const conversation = await Conversation.findById(id)
      .populate('participants.user', 'name email avatar status lastSeen isOnline')
      .populate('admin', 'name email avatar')
      .populate('admins', 'name email avatar');
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    if (conversation.type === 'direct') {
      return res.status(400).json({
        success: false,
        message: 'Cannot add participants to direct conversations'
      });
    }
    
    // Check if user is admin
    if (!conversation.isAdmin(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can add participants'
      });
    }
    
    // Check if user is already a participant
    if (conversation.isParticipant(newParticipantId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a participant'
      });
    }
    
    // Add participant
    await conversation.addParticipant(newParticipantId, role);
    await conversation.populate([
      { path: 'participants.user', select: 'name email avatar status lastSeen isOnline' },
      { path: 'admin', select: 'name email avatar' },
      { path: 'admins', select: 'name email avatar' }
    ]);
    
    // Get new participant info
    const newParticipant = await User.findById(newParticipantId);
    
    // Create system message
    const systemMessage = new Message({
      conversation: conversation._id,
      sender: currentUserId,
      content: `${req.user.name} added ${newParticipant.name} to the ${conversation.type === 'broadcast' ? 'channel' : 'group'}`,
      messageType: 'system'
    });
    await systemMessage.save();
    await systemMessage.populate('sender', 'name avatar');
    
    // Update conversation's last message
    await conversation.updateLastMessage({
      content: systemMessage.content,
      _id: systemMessage._id,
      sender: systemMessage.sender._id,
      timestamp: systemMessage.createdAt,
      messageType: 'system'
    });
    
    // ENHANCED: Emit Socket.IO events for immediate updates
    if (req.socketService) {
      // Notify all current participants about the new member
      conversation.participants.forEach(participant => {
        req.socketService.sendNotificationToUser(
          participant.user._id.toString(),
          'conversation_updated',
          { 
            conversation: conversation.toObject(),
            updateType: 'participant_added'
          }
        );
      });
      
      // Notify the new participant they were added
      // Get the user who added the participant (current user)
      const addedBy = await User.findById(currentUserId).select('name email avatar');
      
      req.socketService.sendNotificationToUser(newParticipantId, 'conversation_created', {
        conversation: conversation.toObject(),
        createdBy: addedBy
      });
      
      // Send system message
      req.socketService.sendNotificationToConversation(
        id,
        'new_message',
        { 
          conversationId: id,
          message: systemMessage.toObject()
        }
      );

      // Make hidden conversations reappear for all participants when system message arrives
      await req.socketService.makeHiddenConversationReappear(id, req.user.id);
    }
    
    res.json({
      success: true,
      data: conversation,
      message: 'Participant added successfully'
    });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add participant',
      error: error.message
    });
  }
});

// DELETE /api/conversations/:id/participants/:participantId - Remove participant (ENHANCED)
router.delete('/:id/participants/:participantId', async (req, res) => {
  try {
    const { id, participantId } = req.params;
    const currentUserId = req.user.id;
    
    const conversation = await Conversation.findById(id)
      .populate('participants.user', 'name email avatar status lastSeen isOnline')
      .populate('admin', 'name email avatar')
      .populate('admins', 'name email avatar');
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    if (conversation.type === 'direct') {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove participants from direct conversations'
      });
    }
    
    // Check permissions (admin can remove anyone, users can remove themselves)
    const isAdmin = conversation.isAdmin(currentUserId);
    if (!isAdmin && currentUserId !== participantId) {
      return res.status(403).json({
        success: false,
        message: 'You can only remove yourself or be removed by an administrator'
      });
    }
    
    // Cannot remove main admin
    if (conversation.admin && conversation.admin.toString() === participantId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the main administrator'
      });
    }
    
    // Get participant info before removing
    const participant = await User.findById(participantId);
    
    // Remove participant
    await conversation.removeParticipant(participantId);
    await conversation.populate([
      { path: 'participants.user', select: 'name email avatar status lastSeen isOnline' },
      { path: 'admin', select: 'name email avatar' },
      { path: 'admins', select: 'name email avatar' }
    ]);
    
    // Create system message
    const action = currentUserId === participantId ? 'left' : 'was removed from';
    const systemMessage = new Message({
      conversation: conversation._id,
      sender: currentUserId,
      content: `${participant.name} ${action} the ${conversation.type === 'broadcast' ? 'channel' : 'group'}`,
      messageType: 'system'
    });
    await systemMessage.save();
    await systemMessage.populate('sender', 'name avatar');
    
    // Update conversation's last message
    await conversation.updateLastMessage({
      content: systemMessage.content,
      _id: systemMessage._id,
      sender: systemMessage.sender._id,
      timestamp: systemMessage.createdAt,
      messageType: 'system'
    });
    
    // ENHANCED: Emit Socket.IO events for immediate updates
    if (req.socketService) {
      // Notify remaining participants
      conversation.participants.forEach(participant => {
        req.socketService.sendNotificationToUser(
          participant.user._id.toString(),
          'conversation_updated',
          { 
            conversation: conversation.toObject(),
            updateType: 'participant_removed'
          }
        );
      });
      
      // Notify the removed participant
      req.socketService.sendNotificationToUser(participantId, 'conversation_deleted', {
        conversationId: id,
        isRemoved: currentUserId !== participantId
      });
      
      // Send system message to remaining participants
      req.socketService.sendNotificationToConversation(
        id,
        'new_message',
        { 
          conversationId: id,
          message: systemMessage.toObject()
        }
      );

      // Make hidden conversations reappear for all participants when system message arrives
      await req.socketService.makeHiddenConversationReappear(id, req.user.id);
    }
    
    res.json({
      success: true,
      data: conversation,
      message: currentUserId === participantId ? 'Left conversation successfully' : 'Participant removed successfully'
    });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove participant',
      error: error.message
    });
  }
});

// POST /api/conversations/:id/read - Mark conversation as read
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const conversation = await Conversation.findById(id);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    if (!conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation'
      });
    }
    
    // Mark conversation as read
    await conversation.markAsRead(userId);
    
    // Mark all unread messages as read
    const participant = conversation.participants.find(p => p.user.toString() === userId);
    const lastRead = participant ? participant.lastRead : new Date(0);
    
    await Message.updateMany(
      {
        conversation: id,
        sender: { $ne: userId },
        createdAt: { $gt: lastRead },
        isDeleted: { $ne: true }
      },
      {
        $addToSet: {
          readBy: {
            user: userId,
            readAt: new Date()
          }
        },
        status: 'read'
      }
    );
    
    // Invalidate sidebar cache for this user (unread count changed)
    await sidebarCache.invalidateUserConversationRead(userId, conversationId);
    
    // Reset unread count to 0 in cache
    await sidebarCache.resetUnreadCount(userId, conversationId);
    
    res.json({
      success: true,
      message: 'Conversation marked as read'
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark conversation as read',
      error: error.message
    });
  }
});

// GET /api/conversations/:id/participants - Get conversation participants
router.get('/:id/participants', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const conversation = await Conversation.findById(id)
      .populate('participants.user', 'name email avatar status lastSeen isOnline')
      .populate('admin', 'name email avatar')
      .populate('admins', 'name email avatar');
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }
    
    if (!conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not a participant in this conversation'
      });
    }
    
    res.json({
      success: true,
      data: {
        participants: conversation.participants,
        admin: conversation.admin,
        admins: conversation.admins || [],
        type: conversation.type
      }
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participants',
      error: error.message
    });
  }
});


// ENHANCED: Clear chat messages for one user only
router.post('/:conversationId/clear', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Verify user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const isParticipant = conversation.participants.some(
      p => p.user.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to clear this conversation'
      });
    }

    // NEW: Add user to clearedFor array in all messages instead of deleting them
    await Message.updateMany(
      { 
        conversation: conversationId,
        clearedFor: { $ne: userId } // Only update messages not already cleared for this user
      },
      { 
        $addToSet: { clearedFor: userId }
      }
    );

    // Update the participant's lastRead timestamp and check if conversation should show as empty
    const participant = conversation.participants.find(
      p => p.user.toString() === userId.toString()
    );
    
    if (participant) {
      participant.lastRead = new Date();
      
      await conversation.save();
    }

    // Emit socket event to notify only this user
    if (req.socketService) {
      req.socketService.sendNotificationToUser(userId.toString(), 'conversation_cleared', {
        conversationId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Chat cleared successfully for you'
    });

  } catch (error) {
    console.error('Clear chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while clearing chat'
    });
  }
});

// Hide conversation (user-specific) - makes it reappear when new messages arrive
router.post('/:conversationId/hide', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // Find the conversation
    const conversation = await Conversation.findById(conversationId).populate('participants.user');
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(
      p => p.user._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to hide this conversation'
      });
    }

    // Mark conversation as hidden for this user
    const participant = conversation.participants.find(
      p => p.user._id.toString() === userId.toString()
    );
    
    if (participant) {
      participant.isHidden = true;
      participant.hiddenAt = new Date();
      await conversation.save();
    }

    // Emit socket event to notify only this user
    if (req.socketService) {
      req.socketService.sendNotificationToUser(userId.toString(), 'conversation_hidden', {
        conversationId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: 'Conversation hidden. It will reappear when someone sends a new message.'
    });

  } catch (error) {
    console.error('Hide conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while hiding conversation'
    });
  }
});

// ENHANCED: Leave conversation with socket events
router.post('/:conversationId/leave', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const user = req.user;

    const conversation = await Conversation.findById(conversationId)
      .populate('participants.user', 'name email avatar status lastSeen isOnline')
      .populate('admin', 'name email avatar')
      .populate('admins', 'name email avatar');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Can't leave direct conversations
    if (conversation.type === 'direct') {
      return res.status(400).json({
        success: false,
        message: 'Cannot leave direct conversations'
      });
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(
      p => p.user._id.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(400).json({
        success: false,
        message: 'You are not a participant in this conversation'
      });
    }

    // Check if user is the main admin
    const isMainAdmin = conversation.admin && conversation.admin._id.toString() === userId.toString();
    
    if (isMainAdmin && conversation.participants.length > 1) {
      // If main admin is leaving and there are other participants
      // Transfer admin role to another admin or the first participant
      let newAdmin = null;
      let transferReason = '';
      
      if (conversation.admins && conversation.admins.length > 0) {
        // Find another admin who is not the leaving user
        const availableAdmin = conversation.admins.find(adminId => adminId.toString() !== userId.toString());
        if (availableAdmin) {
          newAdmin = availableAdmin;
          transferReason = 'existing_admin';
        }
      }
      
      if (!newAdmin) {
        // No other admins, promote the first remaining participant
        const remainingParticipant = conversation.participants.find(
          p => p.user._id.toString() !== userId.toString()
        );
        if (remainingParticipant) {
          newAdmin = remainingParticipant.user._id;
          transferReason = 'promoted_participant';
        }
      }
      
      if (newAdmin) {
        // Get the new admin user info for system message
        const newAdminUser = await User.findById(newAdmin);
        
        conversation.admin = newAdmin;
        
        // Make sure new admin is in admins array
        if (!conversation.admins) {
          conversation.admins = [];
        }
        if (!conversation.admins.some(adminId => adminId.toString() === newAdmin.toString())) {
          conversation.admins.push(newAdmin);
        }
        
        // Update participant role
        const newAdminParticipant = conversation.participants.find(
          p => p.user._id.toString() === newAdmin.toString()
        );
        if (newAdminParticipant) {
          newAdminParticipant.role = 'admin';
        }
        
      }
    }

    // Remove user from participants (mark as left instead of removing)
    await conversation.removeParticipant(userId);

    // If conversation becomes empty, delete it
    if (conversation.participants.length === 0) {
      // Emit socket event before deletion
      if (req.socketService) {
        req.socketService.sendNotificationToUser(userId.toString(), 'conversation_deleted', {
          conversationId,
          reason: 'left_empty_conversation',
          timestamp: new Date()
        });
      }

      await Conversation.findByIdAndDelete(conversationId);
      await Message.deleteMany({ conversation: conversationId });

      return res.json({
        success: true,
        message: 'Left conversation successfully (conversation deleted as it became empty)',
        conversationDeleted: true
      });
    } else {
      await conversation.save();

      // Re-populate conversation data
      await conversation.populate([
        { path: 'participants.user', select: 'name email avatar status lastSeen isOnline' },
        { path: 'admin', select: 'name email avatar' },
        { path: 'admins', select: 'name email avatar' }
      ]);

      // Create system message
      const systemMessage = new Message({
        conversation: conversationId,
        sender: userId,
        content: `${user.name} left the ${conversation.type === 'broadcast' ? 'channel' : 'group'}`,
        messageType: 'system'
      });
      await systemMessage.save();
      await systemMessage.populate('sender', 'name avatar');

      // Create admin transfer system message if applicable
      let adminTransferMessage = null;
      if (isMainAdmin && conversation.admin) {
        const newAdminUser = await User.findById(conversation.admin);
        adminTransferMessage = new Message({
          conversation: conversationId,
          sender: userId,
          content: `${newAdminUser.name} is now the administrator`,
          messageType: 'system'
        });
        await adminTransferMessage.save();
        await adminTransferMessage.populate('sender', 'name avatar');
      }

      // Update conversation's last message (use admin transfer message if it exists)
      const lastMessage = adminTransferMessage || systemMessage;
      await conversation.updateLastMessage({
        content: lastMessage.content,
        _id: lastMessage._id,
        sender: lastMessage.sender._id,
        timestamp: lastMessage.createdAt,
        messageType: 'system'
      });

      // ENHANCED: Emit Socket.IO events
      if (req.socketService) {
        // Notify the user who left
        req.socketService.sendNotificationToUser(userId.toString(), 'conversation_left', {
          conversationId,
          timestamp: new Date()
        });

        // Notify remaining participants
        conversation.participants.forEach(participant => {
          req.socketService.sendNotificationToUser(
            participant.user._id.toString(),
            'conversation_updated',
            { 
              conversation: conversation.toObject(),
              updateType: 'participant_left',
              leftUserId: userId.toString(),
              leftUserName: user.name
            }
          );
        });

        // Send system message to remaining participants
        req.socketService.sendNotificationToConversation(
          conversationId,
          'new_message',
          { 
            conversationId,
            message: systemMessage.toObject()
          }
        );

        // Make hidden conversations reappear for all participants when system message arrives
        await req.socketService.makeHiddenConversationReappear(conversationId, userId);

        // Send admin transfer message if applicable
        if (adminTransferMessage) {
          req.socketService.sendNotificationToConversation(
            conversationId,
            'new_message',
            { 
              conversationId,
              message: adminTransferMessage.toObject()
            }
          );

          // Make hidden conversations reappear for all participants when admin transfer message arrives
          await req.socketService.makeHiddenConversationReappear(conversationId, userId);
        }

        // If admin was transferred, notify about admin change
        if (isMainAdmin && conversation.admin) {
          const newAdminUser = await User.findById(conversation.admin);
          conversation.participants.forEach(participant => {
            req.socketService.sendNotificationToUser(
              participant.user._id.toString(),
              'admin_transferred',
              { 
                conversationId,
                newAdminId: conversation.admin._id.toString(),
                newAdminName: newAdminUser.name,
                previousAdminId: userId.toString(),
                previousAdminName: user.name,
                conversation: conversation.toObject(),
                timestamp: new Date()
              }
            );
          });

          // Also notify the new admin specifically
          req.socketService.sendNotificationToUser(
            conversation.admin._id.toString(),
            'promoted_to_admin',
            {
              conversationId,
              conversationName: conversation.name,
              conversationType: conversation.type,
              previousAdminName: user.name,
              timestamp: new Date()
            }
          );
        }
      }
    }

    res.json({
      success: true,
      message: 'Left conversation successfully',
      conversationDeleted: false,
      adminTransferred: isMainAdmin && conversation.admin ? true : false,
      newAdmin: isMainAdmin && conversation.admin ? conversation.admin : null
    });

  } catch (error) {
    console.error('Leave conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while leaving conversation'
    });
  }
});

module.exports = router;