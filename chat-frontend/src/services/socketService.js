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
      console.log("Joining room", userId);
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
      console.log("User actively viewed conversation", conversationId);
    }
  }

  // Send a new message
  sendMessage(conversationId, messageData) {
    if (this.socket && conversationId && messageData) {
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
      console.log("Conversation explicitly marked as read", conversationId);
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
      console.log("typing start", conversationId)
    }
  }

  stopTyping(conversationId) {
    if (this.socket && conversationId) {
      this.socket.emit('typing_stop', { conversationId });
      console.log("typing stop", conversationId)
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
      console.log("new message listener added");
    }
  }

  // Message status updates
  onMessageStatusUpdate(callback) {
    if (this.socket) {
      this.socket.on('message_status_update', callback);
      console.log("message_status_update listener added");
    }
  }

  onMessagesSeenBulk(callback) {
    if (this.socket) {
      this.socket.on('messages_seen_bulk', callback);
      console.log("messages_seen_bulk listener added");
    }
  }

  onMessageEdited(callback) {
    if (this.socket) {
      this.socket.on('message_edited', callback);
      console.log("message_edited listener added");
    }
  }

  onMessageDeleted(callback) {
    if (this.socket) {
      this.socket.on('message_deleted', callback);
      console.log("message_deleted listener added");
    }
  }

  onConversationCreated(callback) {
    if (this.socket) {
      this.socket.on('conversation_created', callback);
      console.log('conversation_created listener added');
    }
  }

  onConversationDeleted(callback) {
    if (this.socket) {
      this.socket.on('conversation_deleted', callback);
      console.log('conversation_deleted listener added');
    }
  }

  onMessageReaction(callback) {
    if (this.socket) {
      this.socket.on('message_reaction', callback);
      console.log("message_reaction listener added");
    }
  }

  onTypingStart(callback) {
    if (this.socket) {
      this.socket.on('typing_start', callback);
      console.log("typing_start listener added");
    }
  }

  onTypingStop(callback) {
    if (this.socket) {
      this.socket.on('typing_stop', callback);
      console.log("typing_stop listener added");
    }
  }

  onUserStatusUpdate(callback) {
    if (this.socket) {
      this.socket.on('user_status_update', callback);
      console.log("user_status_update listener added");
    }
  }

  onUserOnline(callback) {
    if (this.socket) {
      this.socket.on('user_online', callback);
      console.log("user_online listener added");
    }
  }

  onUserOffline(callback) {
    if (this.socket) {
      this.socket.on('user_offline', callback);
      console.log("user_offline listener added");
    }
  }

  onConversationUpdate(callback) {
    if (this.socket) {
      this.socket.on('conversation_updated', callback);
      console.log("conversation_updated listener added");
    }
  }

  onUserBlocked(callback) {
    if (this.socket) {
      this.socket.on('user_blocked', callback);
      console.log("user_blocked listener added");
    }
  }

  onUserUnblocked(callback) {
    if (this.socket) {
      this.socket.on('user_unblocked', callback);
      console.log("user_unblocked listener added");
    }
  }

  onUserBlockedYou(callback) {
    if (this.socket) {
      this.socket.on('user_blocked_you', callback);
      console.log("user_blocked_you listener added");
    }
  }

  onUserUnblockedYou(callback) {
    if (this.socket) {
      this.socket.on('user_unblocked_you', callback);
      console.log("user_unblocked_you listener added");
    }
  }

  onConversationLeft(callback) {
    if (this.socket) {
      this.socket.on('conversation_left', callback);
      console.log("conversation_left listener added");
    }
  }

  onAdminTransferred(callback) {
    if (this.socket) {
      this.socket.on('admin_transferred', callback);
      console.log("admin_transferred listener added");
    }
  }

  onPromotedToAdmin(callback) {
    if (this.socket) {
      this.socket.on('promoted_to_admin', callback);
      console.log("promoted_to_admin listener added");
    }
  }

  onConversationCleared(callback) {
    if (this.socket) {
      this.socket.on('conversation_cleared', callback);
      console.log("conversation_cleared listener added");
    }
  }

  onAdminRemoved(callback) {
    if (this.socket) {
      this.socket.on('admin_removed', callback);
      console.log("admin_removed listener added");
    }
  }

  on(eventName, callback) {
    if (this.socket && eventName && callback) {
      this.socket.on(eventName, callback);
      console.log(`${eventName} listener added`);
    }
  }

  // Remove event listeners
  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
      console.log(`${event} listener removed`);
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