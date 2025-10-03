// services/socketService.js - Frontend with explicit conversation viewing and block/unblock events
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.heartbeatInterval = null;
    this.lastHeartbeat = null;
    this.heartbeatTimeout = null;
    this.currentToken = null;
    this.connectionHealth = 'unknown'; // 'healthy', 'unhealthy', 'unknown'
    this.isMonitoring = false;
    this.rejoinRooms = new Set(); // Track rooms to rejoin on reconnect
    this.currentUserId = null; // Track current user ID
  }

  async connect(token, userId = null) {
    this.currentToken = token;
    this.currentUserId = userId;
    
    if (this.socket?.connected) {
      return this.socket;
    }

    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
    
    this.socket = io(serverUrl, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: 20000,
      forceNew: true, // Force new connection
      // Optimized ping settings for better stability
      pingInterval: 25000, // Send ping every 25 seconds (default is 25s)
      pingTimeout: 60000, // Wait 60 seconds for pong (default is 20s)
      pingTimeoutRetries: 3, // Retry ping timeout 3 times before disconnecting
    });

    this.setupEventListeners();
    this.startHealthMonitoring();
    return this.socket;
  }

  // Refresh JWT token and reconnect
  async refreshTokenAndReconnect() {
    try {
      console.log('Refreshing JWT token and reconnecting...');
      
      // Import sessionManager dynamically to avoid circular dependencies
      const sessionManager = (await import('../utils/sessionManager')).default;
      const newToken = await sessionManager.refreshAccessToken();
      
      if (newToken) {
        console.log('Token refreshed successfully, reconnecting...');
        await this.connect(newToken, this.currentUserId);
        return true;
      } else {
        console.error('Failed to refresh token');
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionHealth = 'healthy';
      this.lastHeartbeat = Date.now();
      
      // Rejoin user room and tracked conversations on reconnect
      this.rejoinRoomsOnConnect();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
      this.connectionHealth = 'unhealthy';
      this.stopHealthMonitoring();
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      this.connectionHealth = 'unhealthy';
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.connectionHealth = 'unhealthy';
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.connectionHealth = 'unhealthy';
    });

    // Handle heartbeat response from server
    this.socket.on('pong', () => {
      console.log('Socket heartbeat received');
      this.lastHeartbeat = Date.now();
      this.connectionHealth = 'healthy';
      if (this.heartbeatTimeout) {
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = null;
      }
    });

    // Handle server-initiated refresh
    this.socket.on('socket_refresh_required', () => {
      console.log('Server requested socket refresh');
      this.refreshConnection();
    });

    // Handle authentication errors (token expired)
    this.socket.on('connect_error', async (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      this.connectionHealth = 'unhealthy';
      
      // If it's an authentication error, try to refresh token
      if (error.message && error.message.includes('Authentication')) {
        console.log('Authentication error detected, attempting token refresh...');
        const refreshSuccess = await this.refreshTokenAndReconnect();
        if (refreshSuccess) {
          return; // Successfully refreshed, don't increment attempts
        }
      }
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.connectionHealth = 'unhealthy';
      }
    });
  }

  disconnect() {
    this.stopHealthMonitoring();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      this.connectionHealth = 'unknown';
      this.currentToken = null;
      console.log("Disconnecting socket");
    }
  }

  // Start health monitoring with optimized heartbeat
  startHealthMonitoring() {
    if (this.isMonitoring) return; // Prevent duplicate monitoring
    
    this.isMonitoring = true;
    this.stopHealthMonitoring(); // Clear any existing monitoring
    
    // Heartbeat every 2 minutes (much less frequent)
    this.heartbeatInterval = setInterval(() => {
      // Only send heartbeat if user is likely active (page visible, recent activity)
      if (document.visibilityState === 'visible' && this.isUserActive()) {
        this.sendHeartbeat();
      }
    }, 120000); // 2 minutes
  }

  // Check if user is active (simple heuristic)
  isUserActive() {
    // Check if page is visible and has been interacted with recently
    const lastActivity = window.lastUserInteraction || 0;
    const timeSinceActivity = Date.now() - lastActivity;
    return document.visibilityState === 'visible' && timeSinceActivity < 300000; // 5 minutes
  }

  // Stop health monitoring
  stopHealthMonitoring() {
    this.isMonitoring = false;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  // Send heartbeat to server
  sendHeartbeat() {
    if (!this.socket || !this.isConnected) return;

    console.log('Sending socket heartbeat');
    this.socket.emit('ping');

    // Set timeout for heartbeat response (30 seconds - more lenient)
    this.heartbeatTimeout = setTimeout(() => {
      console.warn('Socket heartbeat timeout - connection may be stale');
      this.connectionHealth = 'unhealthy';
      // Only refresh if user is actually active
      if (this.isUserActive()) {
        this.refreshConnection();
      }
    }, 30000);
  }

  // Refresh the socket connection
  refreshConnection() {
    console.log('Refreshing socket connection...');
    
    if (this.socket) {
      this.socket.disconnect();
    }
    
    // Wait a moment before reconnecting
    setTimeout(() => {
      if (this.currentToken) {
        this.connect(this.currentToken);
      }
    }, 1000);
  }

  // Get connection health status
  getConnectionHealth() {
    return {
      isConnected: this.isConnected,
      health: this.connectionHealth,
      lastHeartbeat: this.lastHeartbeat,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  // Join user to their personal room for notifications
  joinUserRoom(userId) {
    if (this.socket && userId) {
      this.socket.emit('join_user_room', userId);
      this.rejoinRooms.add(`user_${userId}`);
    }
  }

  // Join a conversation room (no auto-read)
  joinConversation(conversationId) {
    if (this.socket && conversationId) {
      this.socket.emit('join_conversation', conversationId);
      this.rejoinRooms.add(`conversation_${conversationId}`);
      console.log("Joining convo", conversationId);
    }
  }

  // Leave a conversation room
  leaveConversation(conversationId) {
    if (this.socket && conversationId) {
      this.socket.emit('leave_conversation', conversationId);
      this.rejoinRooms.delete(`conversation_${conversationId}`);
      console.log("Leaving room", conversationId);
    }
  }

  // Rejoin all tracked rooms on reconnect
  rejoinRoomsOnConnect() {
    if (!this.socket || !this.isConnected) return;
    
    console.log('Rejoining rooms after reconnect:', Array.from(this.rejoinRooms));
    
    // Rejoin user room
    if (this.currentUserId) {
      this.joinUserRoom(this.currentUserId);
    }
    
    // Rejoin all tracked conversation rooms
    for (const room of this.rejoinRooms) {
      if (room.startsWith('conversation_')) {
        const conversationId = room.replace('conversation_', '');
        this.joinConversation(conversationId);
      }
    }
  }

  // NEW: Explicitly notify when user views/focuses on a conversation
  viewConversation(conversationId) {
    if (this.socket && conversationId) {
      this.socket.emit('conversation_viewed', { conversationId });
    }
  }

  // Send a new message
  sendMessage(conversationId, messageData) {
    if (this.socket && conversationId && messageData) {
      console.log("🔍 Sending message:", { conversationId, content: messageData.content, messageType: messageData.messageType });
      this.socket.emit('send_message', {
        conversationId,
        ...messageData
      });
      console.log("Sending message", messageData);
    }
  }

  // Mark message as delivered
  markMessageDelivered(messageId) {
    if (this.socket && messageId) {
      this.socket.emit('message_delivered', { messageId });
      console.log("Message delivered", messageId);
    }
  }

  // Mark message as seen
  markMessageSeen(messageId) {
    if (this.socket && messageId) {
      this.socket.emit('message_seen', { messageId });
      console.log("Message seen", messageId);
    }
  }

  // Mark all messages in conversation as read (explicit action)
  markConversationRead(conversationId) {
    if (this.socket && conversationId) {
      this.socket.emit('mark_conversation_read', { conversationId });
    }
  }

  // Edit a message
  editMessage(messageId, newContent) {
    if (this.socket && messageId && newContent) {
      this.socket.emit('edit_message', {
        messageId,
        content: newContent
      });
      console.log("edit message", newContent);
    }
  }

  // Delete a message
  deleteMessage(messageId) {
    if (this.socket && messageId) {
      this.socket.emit('delete_message', { messageId });
      console.log("delete message", messageId);
    }
  }

  // React to a message
  reactToMessage(messageId, emoji) {
    if (this.socket && messageId && emoji) {
      this.socket.emit('react_to_message', {
        messageId,
        emoji
      });
      console.log("react", emoji)
    }
  }

  // Typing indicators
  startTyping(conversationId) {
    if (this.socket && conversationId) {
      this.socket.emit('typing_start', { conversationId });
    }
  }

  stopTyping(conversationId) {
    if (this.socket && conversationId) {
      this.socket.emit('typing_stop', { conversationId });
    }
  }

  // Update user status
  updateUserStatus(status) {
    if (this.socket && status) {
      this.socket.emit('update_status', { status });
      console.log("update status", status)
    }
  }

  // 🆕 NEW METHODS FOR NOTIFICATIONS TO USERS/CONVERSATIONS
  sendNotificationToUser(userId, eventName, data) {
    if (this.socket && userId && eventName) {
      this.socket.emit('send_notification_to_user', {
        userId,
        eventName,
        data
      });
      console.log(`Sending notification to user ${userId}:`, eventName, data);
    }
  }

  sendNotificationToConversation(conversationId, eventName, data) {
    if (this.socket && conversationId && eventName) {
      this.socket.emit('send_notification_to_conversation', {
        conversationId,
        eventName,
        data
      });
      console.log(`Sending notification to conversation ${conversationId}:`, eventName, data);
    }
  }

  // Event listeners setup
  onNewMessage(callback) {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }

  // Message status updates
  onMessageStatusUpdate(callback) {
    if (this.socket) {
      this.socket.on('message_status_update', (data) => {
        callback(data);
      });
    }
  }

  onMessagesSeenBulk(callback) {
    if (this.socket) {
      this.socket.on('messages_seen_bulk', (data) => {
        callback(data);
      });
    }
  }

  onMessageEdited(callback) {
    if (this.socket) {
      this.socket.on('message_edited', callback);
    }
  }

  onMessageDeleted(callback) {
    if (this.socket) {
      this.socket.on('message_deleted', callback);
    }
  }

  onConversationCreated(callback) {
    if (this.socket) {
      this.socket.on('conversation_created', callback);
    }
  }

  onConnect(callback) {
    if (this.socket) {
      this.socket.on('connect', callback);
    }
  }

  onConversationDeleted(callback) {
    if (this.socket) {
      this.socket.on('conversation_deleted', callback);
    }
  }

  onMessageReaction(callback) {
    if (this.socket) {
      this.socket.on('message_reaction', callback);
    }
  }

  onTypingStart(callback) {
    if (this.socket) {
      this.socket.on('typing_start', callback);
    }
  }

  onTypingStop(callback) {
    if (this.socket) {
      this.socket.on('typing_stop', callback);
    }
  }

  onUserStatusUpdate(callback) {
    if (this.socket) {
      this.socket.on('user_status_update', callback);
    }
  }

  onUserOnline(callback) {
    if (this.socket) {
      this.socket.on('user_online', callback);
    }
  }

  onUserOffline(callback) {
    if (this.socket) {
      this.socket.on('user_offline', callback);
    }
  }

  onUserProfileUpdate(callback) {
    if (this.socket) {
      this.socket.on('user_profile_updated', callback);
    }
  }

  onConversationUpdate(callback) {
    if (this.socket) {
      this.socket.on('conversation_updated', callback);
    }
  }

  onUserBlocked(callback) {
    if (this.socket) {
      this.socket.on('user_blocked', callback);
    }
  }

  onUserUnblocked(callback) {
    if (this.socket) {
      this.socket.on('user_unblocked', callback);
    }
  }

  onUserBlockedYou(callback) {
    if (this.socket) {
      this.socket.on('user_blocked_you', callback);
    }
  }

  onUserUnblockedYou(callback) {
    if (this.socket) {
      this.socket.on('user_unblocked_you', callback);
    }
  }

  onConversationLeft(callback) {
    if (this.socket) {
      this.socket.on('conversation_left', callback);
    }
  }

  onAdminTransferred(callback) {
    if (this.socket) {
      this.socket.on('admin_transferred', callback);
    }
  }

  onPromotedToAdmin(callback) {
    if (this.socket) {
      this.socket.on('promoted_to_admin', callback);
    }
  }

  onConversationCleared(callback) {
    if (this.socket) {
      this.socket.on('conversation_cleared', callback);
    }
  }

  onConversationHidden(callback) {
    if (this.socket) {
      this.socket.on('conversation_hidden', callback);
    }
  }

  onConversationReappeared(callback) {
    if (this.socket) {
      this.socket.on('conversation_reappeared', (data) => {
        callback(data);
      });
    }
  }

  onConversationDeleted(callback) {
    if (this.socket) {
      this.socket.on('conversation_deleted', callback);
    }
  }

  onAdminRemoved(callback) {
    if (this.socket) {
      this.socket.on('admin_removed', callback);
    }
  }

  on(eventName, callback) {
    if (this.socket && eventName && callback) {
      this.socket.on(eventName, callback);
    }
  }

  // Remove event listeners
  off(event, callback) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        // Remove all listeners for this event if no callback provided
        this.socket.removeAllListeners(event);
      }
    }
  }

  // Get connection status
  isSocketConnected() {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;