// services/socketService.js - Frontend with explicit conversation viewing and block/unblock events
import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(token) {
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
    });

    this.setupEventListeners();
    return this.socket;
  }

  setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.reconnectAttempts = 0;
      console.log("Disconnecting socket");
    }
  }

  // Join user to their personal room for notifications
  joinUserRoom(userId) {
    if (this.socket && userId) {
      this.socket.emit('join_user_room', userId);
    }
  }

  // Join a conversation room (no auto-read)
  joinConversation(conversationId) {
    if (this.socket && conversationId) {
      this.socket.emit('join_conversation', conversationId);
      console.log("Joining convo", conversationId);
    }
  }

  // Leave a conversation room
  leaveConversation(conversationId) {
    if (this.socket && conversationId) {
      this.socket.emit('leave_conversation', conversationId);
      console.log("Leaving room", conversationId);
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
        console.log('🔔 SOCKET: Received conversation_reappeared event:', data);
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