// components/ChatApp.js - Complete updated version with fixed message status

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import LoginForm from "./Login/LoginForm";
import ChatLayout from "./ChatLayout";
import { useUser } from "../contexts/UserContext";
import { socketService } from "../services/socketService";
import sessionManager from "../utils/sessionManager";
import fileUploadService from "../utils/fileUpload";
import { CheckCircle } from "lucide-react";
import {
  createFileInfo,
  getFileTypeFromFile,
  validateFile,
} from "../utils/fileHelpers";
import ObjectId from "../utils/ObjectId";
import NotificationBubble from "./NotificationBubble";

const ChatApp = () => {
  const {
    // User state from context
    currentUser,
    setCurrentUser,
    isDark,
    setIsDark,
    conversations,
    updateConversations,
    showVerificationAlert,
    setShowVerificationAlert,
    activeChat,
    setActiveChat,
    onlineUsers,
    updateOnlineUsers,
    updateUserProfile,
    isLoading,
    setIsLoading,
    loginUser,
    logoutUser,
    refreshSessionInfo,
    error,
    clearError,
    fetchCompleteUserProfile,
    popupAlert,
    setPopupAlert,
  } = useUser();

  // Local state for chat-specific data
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [showLogin, setShowLogin] = useState(!currentUser);
  const [messageStatuses, setMessageStatuses] = useState({});
  const [notification, setNotification] = useState(null);
  const [messageNotifications, setMessageNotifications] = useState([]);

  // Update showLogin when currentUser changes
  useEffect(() => {
    setShowLogin(!currentUser);
  }, [currentUser]);

  // Initialize user data and socket connection when currentUser changes
  useEffect(() => {
    if (currentUser && currentUser.blockedUsers !== undefined) {
      console.log(
        "Current user with blocked users ready, initializing data..."
      );
      initializeUserData();
      connectSocket();
      
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } else if (currentUser && currentUser.blockedUsers === undefined) {
      console.log("Current user exists but missing blockedUsers, waiting...");
      // Don't initialize yet - wait for complete profile
    } else {
      console.log("No current user, disconnecting socket");
      disconnectSocket();
    }
  }, [currentUser?.blockedUsers]);

  useEffect(() => {
    if (currentUser?._id && currentUser.blockedUsers === undefined) {
      console.log(
        "User exists but blockedUsers missing, fetching complete profile..."
      );
      fetchCompleteUserProfile();
    }
  }, [currentUser?._id, currentUser?.blockedUsers]);

  // Setup socket event listeners
  useEffect(() => {
    if (currentUser && socketService.isSocketConnected()) {
      setupSocketListeners();
    }

    return () => {
      cleanupSocketListeners();
    };
  }, [currentUser, conversations, activeChat]);

  // Track user interactions to determine if they're actively using the app
  useEffect(() => {
    const trackUserInteraction = () => {
      window.lastUserInteraction = Date.now();
    };

    // Track various user interactions
    const events = ["click", "keypress", "scroll", "touchstart", "mousemove"];
    events.forEach((event) => {
      window.addEventListener(event, trackUserInteraction);
    });

    // Initial timestamp
    window.lastUserInteraction = Date.now();

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, trackUserInteraction);
      });
    };
  }, []);

  useEffect(() => {
    if (currentUser?._id && !currentUser?.blockedUsers) {
      console.log("Fetching user profile because blockedUsers is missing");
      fetchUserProfile();
    }
  }, [currentUser?._id]);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Notification management functions
  const addMessageNotification = (message, conversation, sender) => {
    // Only show notification if the chat is not currently open
    if (activeChat?._id === conversation._id) {
      return;
    }

    // Don't show notifications for messages sent by current user
    if (sender._id === currentUser._id) {
      return;
    }

    // Don't show popup notifications for system messages
    if (message.messageType === 'system') {
      return;
    }

    const notificationId = `${message._id}-${Date.now()}`;
    
    // Create message preview
    let messagePreview = message.content || '';
    if (message.messageType !== 'text' && message.fileInfo) {
      const fileName = message.fileInfo.displayName || message.fileInfo.originalName || 'File';
      const fileIcon = message.messageType === 'image' ? '🖼️' :
                      message.messageType === 'video' ? '🎥' :
                      message.messageType === 'audio' ? '🎵' :
                      message.messageType === 'pdf' ? '📄' : '📎';
      messagePreview = `${fileIcon} ${fileName}`;
    }

    // For group/broadcast conversations, add sender name
    if (conversation.type === 'group' || conversation.type === 'broadcast') {
      const senderName = sender.name || 'Someone';
      messagePreview = `${senderName}: ${messagePreview}`;
    }

    const newNotification = {
      id: notificationId,
      messageId: message._id,
      conversationId: conversation._id,
      conversation: conversation,
      sender: sender,
      messagePreview: messagePreview,
      timestamp: message.createdAt || new Date().toISOString()
    };

    setMessageNotifications(prev => [...prev, newNotification]);

    // Also show browser notification if permission is granted
    if ('Notification' in window && Notification.permission === 'granted') {
      const conversationName = conversation.name || sender.name || 'Unknown';
      new Notification(`New message from ${conversationName}`, {
        body: messagePreview,
        icon: '/favicon.ico',
        tag: conversation._id, // This will replace previous notifications for the same conversation
        requireInteraction: false
      });
    }
  };

  const dismissNotification = (notificationId) => {
    setMessageNotifications(prev => 
      prev.filter(notif => notif.id !== notificationId)
    );
  };

  // Add conversation notification function
  const addConversationNotification = (conversation, createdBy) => {
    // Don't show notification if the conversation was created by current user
    if (createdBy._id === currentUser._id) {
      return;
    }

    const notificationId = `conv-${conversation._id}-${Date.now()}`;
    
    // Create conversation preview
    let conversationPreview = '';
    if (conversation.type === 'group') {
      conversationPreview = `You were added to group "${conversation.name}"`;
    } else if (conversation.type === 'broadcast') {
      conversationPreview = `You were added to broadcast channel "${conversation.name}"`;
    } else {
      conversationPreview = `New conversation with ${createdBy.name}`;
    }

    const newNotification = {
      id: notificationId,
      conversationId: conversation._id,
      conversation: conversation,
      sender: createdBy,
      messagePreview: conversationPreview,
      timestamp: conversation.createdAt || new Date().toISOString(),
      type: 'conversation' // Mark as conversation notification
    };

    setMessageNotifications(prev => [...prev, newNotification]);

    // Also show browser notification if permission is granted
    if ('Notification' in window && Notification.permission === 'granted') {
      const conversationName = conversation.name || createdBy.name || 'Unknown';
      new Notification(`New conversation: ${conversationName}`, {
        body: conversationPreview,
        icon: '/favicon.ico',
        tag: `conv-${conversation._id}`, // This will replace previous notifications for the same conversation
        requireInteraction: false
      });
    }
  };

  const handleNotificationClick = (notification) => {
    // Find and set the conversation as active
    const conversation = conversations.find(conv => conv._id === notification.conversationId);
    if (conversation) {
      setActiveChat(conversation);
      // Mark conversation as viewed
      if (typeof handleConversationViewed === 'function') {
        handleConversationViewed(conversation._id);
      }
    }
  };


  const fetchUserProfile = async () => {
    try {
      const userProfileResponse = await sessionManager.authenticatedRequest(
        "/users/me/profile"
      );

      if (userProfileResponse.ok) {
        const userProfileData = await userProfileResponse.json();
        if (userProfileData.success) {
          console.log("Fresh user profile loaded:", userProfileData.user);
          setCurrentUser((prev) => ({
            ...prev,
            ...userProfileData.user,
            blockedUsers: userProfileData.user.blockedUsers || [],
          }));
          return userProfileData.user;
        }
      }
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
    }
    return null;
  };

  const connectSocket = () => {
    const session = sessionManager.getCurrentSession();
    if (session?.accessToken) {
      socketService.connect(session.accessToken, currentUser?._id);

      // Join user's personal room for notifications
      if (currentUser) {
        socketService.joinUserRoom(currentUser._id);
      }
      
      // Refresh unread counts when socket reconnects (in case user was offline)
      socketService.onConnect(() => {
        refreshUnreadCounts();
      });
    }
  };

  // Monitor socket connection health (less frequent)
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      // Only check if user is active and page is visible
      if (document.visibilityState === 'visible' && window.lastUserInteraction) {
        const health = socketService.getConnectionHealth();
        if (health.health === 'unhealthy') {
          console.warn('Socket connection is unhealthy, attempting refresh...');
          // The socket service will automatically handle reconnection
        }
      }
    }, 300000); // Check every 5 minutes (much less frequent)

    return () => clearInterval(healthCheckInterval);
  }, []);

  const disconnectSocket = () => {
    socketService.disconnect();
  };

  const setupSocketListeners = () => {
    // In ChatApp.js - Replace the entire setupSocketListeners function's onNewMessage handler

    socketService.onNewMessage((data) => {
      const { conversationId, message } = data;


      // Find the conversation to get full conversation data
      const conversation = conversations.find(conv => conv._id === conversationId);

      // SIMPLIFIED: Just check for duplicates by ID and add if not exists
      setMessages((prev) => {
        const existingMessages = prev[conversationId] || [];

        // Simple duplicate check
        const messageExists = existingMessages.some(
          (msg) => msg._id === message._id
        );

        if (messageExists) {
          return prev;
        }

        // Add new message
        return {
          ...prev,
          [conversationId]: [...existingMessages, message],
        };
      });

      // Show notification bubble if chat is not open and message is not from current user
      if (conversation && message.sender && message.sender._id !== currentUser._id) {
        addMessageNotification(message, conversation, message.sender);
      }

        // ALTERNATIVE APPROACH: Also update conversation directly in new message handler
        // This ensures the sidebar updates even if conversation_updated event fails
        updateConversations((prevConversations) =>
          prevConversations.map((conv) => {
            if (conv._id === conversationId) {
              // Create updated last message for sidebar
              let lastMessageContent = message.content;
              if (message.messageType !== 'text' && message.fileInfo) {
                const fileName = message.fileInfo.displayName || message.fileInfo.originalName || 'File';
                const fileIcon = message.messageType === 'image' ? '🖼️' :
                                message.messageType === 'video' ? '🎥' :
                                message.messageType === 'audio' ? '🎵' :
                                message.messageType === 'pdf' ? '📄' : '📎';
                lastMessageContent = `${fileIcon} ${fileName}`;
              }

              // Only increment unread count if message is not from current user AND conversation is not active
              const isFromCurrentUser = message.sender._id === currentUser._id;
              const isActiveConversation = activeChat?._id === conversationId;
              const currentUnreadCount = conv.unreadCount || 0;

              return {
                ...conv,
                lastMessage: {
                  content: lastMessageContent,
                  sender: message.sender._id,
                  timestamp: message.createdAt,
                  messageType: message.messageType,
                  fileInfo: message.fileInfo
                },
                updatedAt: message.createdAt,
                unreadCount: (isFromCurrentUser || isActiveConversation) ? currentUnreadCount : currentUnreadCount + 1
              };
            }
            return conv;
          })
        );
    });

    // Handle message status updates
    socketService.onMessageStatusUpdate((data) => {
      const { messageId, status, timestamp, deliveredTo, readBy } = data;

      // SIMPLIFIED: Just match by real message ID
      setMessages((prev) => {
        const updated = { ...prev };
        
        Object.keys(updated).forEach((conversationId) => {
          updated[conversationId] = updated[conversationId].map((msg) => {
            if (msg._id === messageId) {
              return {
                ...msg,
                status: status,
                statusTimestamp: timestamp,
                deliveredTo: deliveredTo || msg.deliveredTo || [],
                readBy: readBy || msg.readBy || [],
              };
            }
            return msg;
          });
        });
        
        return updated;
      });

      // Update message statuses tracking
      setMessageStatuses((prev) => ({
        ...prev,
        [messageId]: {
          status,
          timestamp,
          deliveredTo: deliveredTo || [],
          readBy: readBy || [],
        },
      }));
    });

    // Handle bulk messages seen
    socketService.onMessagesSeenBulk((data) => {
      const { messageIds, seenBy, conversationId, timestamp } = data;

      setMessages((prev) => {
        const updated = { ...prev };
        if (updated[conversationId]) {
          updated[conversationId] = updated[conversationId].map((msg) => {
            if (messageIds.includes(msg._id)) {
              return {
                ...msg,
                status: "read",
                statusTimestamp: timestamp,
                readBy: [
                  ...(msg.readBy || []),
                  { user: seenBy, readAt: timestamp },
                ],
              };
            }
            return msg;
          });
        }
        return updated;
      });

      // Update conversation unread count to 0 when messages are marked as seen
      updateConversations((prevConversations) => {
        return prevConversations.map((conv) => {
          if (conv._id === conversationId) {
            console.log(`🔍 Updating unread count to 0 for conversation ${conversationId}`);
            return {
              ...conv,
              unreadCount: 0,
              participants: conv.participants.map((p) => {
                if (p.user._id === currentUser._id) {
                  return {
                    ...p,
                    lastRead: timestamp
                  };
                }
                return p;
              })
            };
          }
          return conv;
        });
      });
    });

    // Message edited
    socketService.onMessageEdited((data) => {
      const { messageId, content, editedAt } = data;

      setMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((conversationId) => {
          updated[conversationId] = updated[conversationId].map((msg) =>
            msg._id === messageId
              ? {
                  ...msg,
                  content,
                  isEdited: true,
                  editedAt,
                }
              : msg
          );
        });
        return updated;
      });
    });

    // Message deleted
    // Message deleted
    socketService.onMessageDeleted((data) => {
      const { messageId, conversationId, newLastMessage } = data;

      // Update conversation's last message in sidebar if provided
      if (conversationId) {
        updateConversations(
          conversations.map((conv) => {
            if (conv._id === conversationId) {
              if (newLastMessage) {
                // Create proper last message content for sidebar
                let lastMessageContent = newLastMessage.content;
                if (newLastMessage.messageType !== "text") {
                  const fileName = newLastMessage.content;
                  const fileIcon =
                    newLastMessage.messageType === "image"
                      ? "🖼️"
                      : newLastMessage.messageType === "video"
                      ? "🎥"
                      : newLastMessage.messageType === "audio"
                      ? "🎵"
                      : newLastMessage.messageType === "pdf"
                      ? "📄"
                      : "📎";
                  lastMessageContent = `${fileIcon} ${fileName}`;
                }

                return {
                  ...conv,
                  lastMessage: {
                    content: lastMessageContent,
                    sender: newLastMessage.sender,
                    timestamp: newLastMessage.timestamp,
                    messageType: newLastMessage.messageType,
                    fileInfo: newLastMessage.fileInfo,
                  },
                  updatedAt: new Date().toISOString(),
                };
              } else {
                // No messages left in conversation
                return {
                  ...conv,
                  lastMessage: null,
                  updatedAt: new Date().toISOString(),
                };
              }
            }
            return conv;
          })
        );
      }

      setMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((convId) => {
          updated[convId] = updated[convId].filter(
            (msg) => msg._id !== messageId
          );
        });
        return updated;
      });
    });
    // Message reaction
    socketService.onMessageReaction((data) => {
      const { messageId, reactions } = data;

      setMessages((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((conversationId) => {
          updated[conversationId] = updated[conversationId].map((msg) =>
            msg._id === messageId ? { ...msg, reactions } : msg
          );
        });
        return updated;
      });
    });

    // Add this to your setupSocketListeners function:

    // New conversation created
    socketService.onConversationCreated((data) => {
      const { conversation, createdBy } = data;

      console.log("🔔 New conversation created:", {
        conversationId: conversation._id,
        conversationType: conversation.type,
        createdBy: createdBy?.name,
        conversationName: conversation.name
      });

      // Check if conversation already exists
      const existingConv = conversations.find(
        (conv) => conv._id === conversation._id
      );

      if (!existingConv) {
        const newConversation = {
          ...conversation,
          unreadCount: 0,
        };

        // Add to conversations list (at the beginning for newest first)
        updateConversations([newConversation, ...conversations]);

        // Initialize empty messages
        setMessages((prev) => ({
          ...prev,
          [conversation._id]: [],
        }));

        // Join the conversation room
        socketService.joinConversation(conversation._id);

        // Show notification bubble for new conversation
        if (createdBy) {
          addConversationNotification(conversation, createdBy);
        }
      }
    });

    // Conversation deleted
    socketService.onConversationDeleted((data) => {
      const { conversationId, deletedBy } = data;

      // Remove from conversations list
      updateConversations(
        conversations.filter((conv) => conv._id !== conversationId)
      );

      // Clear messages for this conversation
      setMessages((prev) => {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      });

      // Clear active chat if it's the deleted conversation
      if (activeChat?._id === conversationId) {
        setActiveChat(null);
      }

      // Show notification (only if deleted by someone else)
      if (deletedBy !== currentUser._id) {
        const conversation = conversations.find(
          (conv) => conv._id === conversationId
        );
        const conversationName =
          conversation?.type === "group" ? conversation.name : "Conversation";
        showNotification(`${conversationName} was deleted`, "success");
      }
    });

    // Typing indicators
    socketService.onTypingStart((data) => {
      const { userId, userName, conversationId } = data;

      if (conversationId === activeChat?._id && userId !== currentUser?._id) {
        setTypingUsers((prev) => new Set(prev).add(userName));
      }
    });

    socketService.onTypingStop((data) => {
      const { userId, userName, conversationId } = data;

      if (conversationId === activeChat?._id) {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userName);
          return newSet;
        });
      }
    });

    // User status updates
    socketService.onUserOnline((data) => {
      const { userId } = data;
      updateOnlineUsers([...onlineUsers, userId]);
    });

    socketService.onUserOffline((data) => {
      const { userId } = data;
      updateOnlineUsers([...onlineUsers]?.filter((id) => id !== userId));
    });

    socketService.onUserStatusUpdate((data) => {
      const { userId, status } = data;

      // Update user status in conversations
      updateConversations(
        conversations.map((conv) => ({
          ...conv,
          participants: conv.participants.map((participant) =>
            participant.user._id === userId
              ? { ...participant, user: { ...participant.user, status } }
              : participant
          ),
        }))
      );
    });

    // Handle user profile updates
    socketService.onUserProfileUpdate((data) => {
      const { userId, user } = data;
      console.log("🔔 User profile updated:", { userId, user });

      // Update user info in conversations
      updateConversations(
        conversations.map((conv) => ({
          ...conv,
          participants: conv.participants.map((participant) =>
            participant.user._id === userId
              ? { ...participant, user: { ...participant.user, ...user } }
              : participant
          ),
        }))
      );

      // Update current user if it's their own profile
      if (userId === currentUser?._id) {
        updateUserProfile(user);
      }
    });

    // Conversation updates
    // Replace the existing conversation update handler with this enhanced version:
    socketService.onConversationUpdate((data) => {
      const { conversation, updateType } = data;

      console.log("🔔 Conversation update received:", {
        conversationId: conversation._id,
        updateType,
        lastMessage: conversation.lastMessage,
        updatedAt: conversation.updatedAt
      });

      // Update conversation in state immediately
      updateConversations((prevConversations) => {
        const updatedConversations = prevConversations.map((conv) =>
          conv._id === conversation._id ? conversation : conv
        );
        
        const foundConv = prevConversations.find(conv => conv._id === conversation._id);
        console.log("🔄 Updating conversations state:", {
          conversationId: conversation._id,
          conversationIdType: typeof conversation._id,
          foundConversation: foundConv ? 'YES' : 'NO',
          foundConvId: foundConv?._id,
          foundConvIdType: typeof foundConv?._id,
          totalConversations: prevConversations.length,
          updatedConversations: updatedConversations.length,
          allConvIds: prevConversations.map(conv => ({ id: conv._id, type: typeof conv._id }))
        });
        
        return updatedConversations;
      });

      // Update active chat if it matches
      if (activeChat?._id === conversation._id) {
        setActiveChat(conversation);
      }

      // Show notifications for specific update types
      if (updateType === "new_message") {
        // Don't show notification for new messages as they're handled by the message notification system
        console.log("Conversation updated with new message:", conversation._id);
      } else if (updateType === "admin_added") {
        // Find the newly added admin
        const newAdmin = conversation.participants.find(
          (p) =>
            p.role === "admin" &&
            conversation.admins?.some((admin) => admin._id === p.user._id)
        );
        // Removed admin promotion notifications
      } else if (updateType === "admin_removed") {
        // Removed admin removal notifications
      } else if (updateType === "participant_added") {
        // Removed member joined notifications
      } else if (updateType === "participant_removed") {
        // Removed member left notifications
      } else if (updateType === "settings_updated") {
        // Removed settings updated notifications
      }
    });

    // In setupSocketListeners function, update these handlers:

    socketService.onUserBlocked((data) => {
      const { blockedUserId, blockedUser, timestamp } = data;

      console.log("Socket: User blocked event received", {
        blockedUserId,
        blockedUser,
      });

      // Update current user's blocked list in context
      setCurrentUser((prev) => {
        const currentBlockedUsers = prev.blockedUsers || [];
        const updatedBlockedUsers = currentBlockedUsers.includes(blockedUserId)
          ? currentBlockedUsers
          : [...currentBlockedUsers, blockedUserId];

        return {
          ...prev,
          blockedUsers: updatedBlockedUsers,
        };
      });

      // Update conversations to reflect blocked status
      updateConversations(
        conversations.map((conv) => {
          if (conv.type === "direct") {
            const otherParticipant = conv.participants.find(
              (p) => p.user._id === blockedUserId
            );
            if (otherParticipant) {
              return {
                ...conv,
                participants: conv.participants.map((p) =>
                  p.user._id === blockedUserId
                    ? {
                        ...p,
                        user: {
                          ...p.user,
                          isBlockedByCurrentUser: true,
                        },
                      }
                    : p
                ),
              };
            }
          }
          return conv;
        })
      );

      // Removed blocking notification
    });

    socketService.onUserUnblocked((data) => {
      const { unblockedUserId, unblockedUser, timestamp } = data;

      console.log("Socket: User unblocked event received", {
        unblockedUserId,
        unblockedUser,
      });

      // Update current user's blocked list in context
      setCurrentUser((prev) => {
        const updatedBlockedUsers = (prev.blockedUsers || []).filter(
          (id) => id !== unblockedUserId
        );

        return {
          ...prev,
          blockedUsers: updatedBlockedUsers,
        };
      });

      // Update conversations to reflect unblocked status
      updateConversations(
        conversations.map((conv) => {
          if (conv.type === "direct") {
            const otherParticipant = conv.participants.find(
              (p) => p.user._id === unblockedUserId
            );
            if (otherParticipant) {
              return {
                ...conv,
                participants: conv.participants.map((p) =>
                  p.user._id === unblockedUserId
                    ? {
                        ...p,
                        user: {
                          ...p.user,
                          isBlockedByCurrentUser: false,
                        },
                      }
                    : p
                ),
              };
            }
          }
          return conv;
        })
      );

      // Removed unblocking notification
    });

    socketService.onUserBlockedYou((data) => {
      const { blockedByUserId, blockedByUser, timestamp } = data;

      // Update conversations to show that current user is blocked
      updateConversations(
        conversations.map((conv) => {
          if (conv.type === "direct") {
            const otherParticipant = conv.participants.find(
              (p) => p.user._id === blockedByUserId
            );
            if (otherParticipant) {
              return {
                ...conv,
                participants: conv.participants.map((p) =>
                  p.user._id === blockedByUserId
                    ? {
                        ...p,
                        user: {
                          ...p.user,
                          hasBlockedCurrentUser: true,
                        },
                      }
                    : p
                ),
              };
            }
          }
          return conv;
        })
      );

      // Update activeChat if it's the conversation with the user who blocked us
      if (activeChat?.type === "direct") {
        const otherParticipant = activeChat.participants.find(
          (p) => p.user._id === blockedByUserId
        );
        if (otherParticipant) {
          setActiveChat({
            ...activeChat,
            participants: activeChat.participants.map((p) =>
              p.user._id === blockedByUserId
                ? {
                    ...p,
                    user: {
                      ...p.user,
                      hasBlockedCurrentUser: true,
                    },
                  }
                : p
            ),
          });
        }
      }

      // Removed "blocked you" notification
    });

    socketService.onUserUnblockedYou((data) => {
      const { unblockedByUserId, unblockedByUser, timestamp } = data;

      // Update conversations to show that current user is unblocked
      updateConversations(
        conversations.map((conv) => {
          if (conv.type === "direct") {
            const otherParticipant = conv.participants.find(
              (p) => p.user._id === unblockedByUserId
            );
            if (otherParticipant) {
              return {
                ...conv,
                participants: conv.participants.map((p) =>
                  p.user._id === unblockedByUserId
                    ? {
                        ...p,
                        user: {
                          ...p.user,
                          hasBlockedCurrentUser: false,
                        },
                      }
                    : p
                ),
              };
            }
          }
          return conv;
        })
      );

      // Update activeChat if it's the conversation with the user who unblocked us
      if (activeChat?.type === "direct") {
        const otherParticipant = activeChat.participants.find(
          (p) => p.user._id === unblockedByUserId
        );
        if (otherParticipant) {
          setActiveChat({
            ...activeChat,
            participants: activeChat.participants.map((p) =>
              p.user._id === unblockedByUserId
                ? {
                    ...p,
                    user: {
                      ...p.user,
                      hasBlockedCurrentUser: false,
                    },
                  }
                : p
            ),
          });
        }
      }

      // Removed "unblocked you" notification
    });

    // 🆕 CONVERSATION LEFT SOCKET EVENT
    socketService.onConversationLeft((data) => {
      const { conversationId, timestamp } = data;

      // Remove conversation from current user's list
      updateConversations(
        conversations.filter((conv) => conv._id !== conversationId)
      );

      // Clear messages for this conversation
      setMessages((prev) => {
        const updated = { ...prev };
        delete updated[conversationId];
        return updated;
      });

      // Clear active chat if it's the conversation we left
      if (activeChat?._id === conversationId) {
        setActiveChat(null);
      }

      // Removed "left conversation" notification
    });

    socketService.onAdminTransferred((data) => {
      const {
        conversationId,
        newAdminId,
        newAdminName,
        previousAdminName,
        conversation,
        timestamp,
      } = data;

      // Update conversation with new admin info
      updateConversations(
        conversations.map((conv) =>
          conv._id === conversationId ? conversation : conv
        )
      );

      // Update active chat if it matches
      if (activeChat?._id === conversationId) {
        setActiveChat(conversation);
      }

      // Removed admin transfer notifications
    });

    // 🆕 PROMOTED TO ADMIN SOCKET EVENT
    socketService.onPromotedToAdmin((data) => {
      const {
        conversationId,
        conversationName,
        conversationType,
        previousAdminName,
        timestamp,
      } = data;

      // Removed admin promotion notification
    });

    // 🆕 CONVERSATION CLEARED SOCKET EVENT
    socketService.onConversationCleared((data) => {
      const { conversationId, timestamp } = data;

      // Clear messages for this conversation locally
      setMessages((prev) => ({
        ...prev,
        [conversationId]: [],
      }));

      // Update conversation's last message
      updateConversations(
        conversations.map((conv) =>
          conv._id === conversationId
            ? {
                ...conv,
                lastMessage: null,
                updatedAt: new Date().toISOString(),
              }
            : conv
        )
      );

      // Removed chat cleared notification
    });

    // Handle conversation hidden
    socketService.onConversationHidden((data) => {
      const { conversationId } = data;
      
      // Hide conversation from sidebar
      updateConversations(prevConversations => 
        prevConversations.filter(conv => conv._id !== conversationId)
      );
      
      // Clear active chat if it's the hidden conversation
      if (activeChat?._id === conversationId) {
        setActiveChat(null);
      }
    });

    // Handle conversation reappeared
    socketService.onConversationReappeared((data) => {
      const { conversationId, senderId, conversation } = data;
      
      // IMMEDIATE: Use the conversation data sent directly in the socket event
      if (conversation) {
        
        // Add the conversation back to the list immediately
        updateConversations(prevConversations => {
          const exists = prevConversations.find(conv => conv._id === conversationId);
          if (exists) {
            // Update existing conversation
            return prevConversations.map(conv => 
              conv._id === conversationId ? { ...conv, ...conversation } : conv
            );
          } else {
            // Add new conversation to the top
            return [conversation, ...prevConversations];
          }
        });
        
        // Set as active chat immediately
        setActiveChat(conversation);
        
        // Fetch messages for the reappeared conversation
        fetchMessages(conversationId);
        
        return; // Success, exit early
      }
      
      // Fallback: If no conversation data in socket event, fetch it
      const handleConversationReappeared = async () => {
        try {
          // Try to get the conversation details
          const conversationResponse = await sessionManager.authenticatedRequest(`/conversations/${conversationId}`);
          if (conversationResponse.ok) {
            const conversationData = await conversationResponse.json();
            if (conversationData.success) {
              const reappearedConversation = conversationData.data;
              
              // Add the conversation back to the list immediately
              updateConversations(prevConversations => {
                const exists = prevConversations.find(conv => conv._id === conversationId);
                if (exists) {
                  // Update existing conversation
                  return prevConversations.map(conv => 
                    conv._id === conversationId ? { ...conv, ...reappearedConversation } : conv
                  );
                } else {
                  // Add new conversation to the top
                  return [reappearedConversation, ...prevConversations];
                }
              });
              
              // Set as active chat immediately
              setActiveChat(reappearedConversation);
              
              // Fetch messages for the reappeared conversation
              fetchMessages(conversationId);
              
              return; // Success, exit early
            }
          }
        } catch (error) {
          console.error('Error fetching conversation details:', error);
        }
        
        // Final fallback: Refresh the entire conversations list
        refreshConversationsList(conversationId);
      };
      
      // Execute fallback
      handleConversationReappeared();
    });

    // Handle conversation deleted
    socketService.onConversationDeleted((data) => {
      const { conversationId } = data;
      console.log(`FRONTEND: Received conversation_deleted event for conversation ${conversationId}`);
      
      // Clear messages for this conversation
      setMessages(prev => ({
        ...prev,
        [conversationId]: []
      }));
      
      // Hide conversation from sidebar
      updateConversations(prevConversations => 
        prevConversations.filter(conv => conv._id !== conversationId)
      );
      
      // Clear active chat if it's the deleted conversation
      if (activeChat?._id === conversationId) {
        setActiveChat(null);
      }
    });
  };

  const cleanupSocketListeners = () => {
    // Remove all listeners by calling off without callback (removes all listeners for that event)
    socketService.off("new_message");
    socketService.off("message_status_update");
    socketService.off("messages_seen_bulk");
    socketService.off("message_edited");
    socketService.off("message_deleted");
    socketService.off("message_reaction");
    socketService.off("typing_start");
    socketService.off("typing_stop");
    socketService.off("user_online");
    socketService.off("user_offline");
    socketService.off("user_status_update");
    socketService.off("user_profile_updated");
    socketService.off("conversation_updated");
    socketService.off("conversation_created");
    socketService.off("conversation_deleted");
    socketService.off("user_blocked");
    socketService.off("user_unblocked");
    socketService.off("user_blocked_you");
    socketService.off("user_unblocked_you");
    socketService.off("conversation_left");
    socketService.off("admin_transferred");
    socketService.off("promoted_to_admin");
    socketService.off("conversation_cleared");
  };

  const initializeUserData = async () => {
    if (!currentUser) {
      console.log("No current user for initialization");
      return;
    }

    if (currentUser.blockedUsers === undefined) {
      console.log("User missing blockedUsers, cannot initialize properly");
      return;
    }

    try {
      setIsLoading(true);
      console.log(
        "Initializing user data with blocked users:",
        currentUser.blockedUsers
      );

      // Fetch conversations
      const conversationsResponse = await sessionManager.authenticatedRequest(
        "/conversations"
      );

      if (!conversationsResponse.ok) {
        throw new Error(
          `HTTP ${conversationsResponse.status}: ${conversationsResponse.statusText}`
        );
      }

      const conversationsData = await conversationsResponse.json();
      console.log('Conversations response:', conversationsData);

      if (conversationsData.success && conversationsData.data) {
        // Fetch unread counts for all conversations
        let unreadCounts = {};
        try {
          const unreadCountsResponse = await sessionManager.authenticatedRequest(
            "/conversations/unread-counts"
          );
          
          if (unreadCountsResponse.ok) {
            const unreadCountsData = await unreadCountsResponse.json();
            console.log('Unread counts response:', unreadCountsData);
            if (unreadCountsData.success) {
              unreadCounts = unreadCountsData.data || {};
            }
          }
        } catch (error) {
          console.warn('Failed to fetch unread counts:', error);
          unreadCounts = {};
        }
        
        const conversationsWithUnread = (conversationsData.data || []).map(
          (conversation) => ({
            ...conversation,
            unreadCount: (unreadCounts && unreadCounts[conversation._id]) || 0,
          })
        );

        // Apply blocked status since we know we have complete user data
        const conversationsWithBlockedStatus = conversationsWithUnread.map(
          (conv) => ({
            ...conv,
            participants: (conv.participants || []).map((participant) => ({
              ...participant,
              user: {
                ...participant.user,
                isBlockedByCurrentUser: (currentUser.blockedUsers || []).includes(
                  participant.user._id
                ),
                hasBlockedCurrentUser:
                  participant.user.hasBlockedCurrentUser || false,
              },
            })),
          })
        );

        console.log("Setting conversations with blocked status applied");
        updateConversations(conversationsWithBlockedStatus);

        // Join conversation rooms
        conversationsWithUnread.forEach((conversation) => {
          socketService.joinConversation(conversation._id);
        });

        // Fetch messages - SIMPLIFIED without processedMessageIds tracking
        const messagesData = {};
        await Promise.all(
          conversationsWithUnread.map(async (conversation) => {
            try {
              console.log(
                `Loading messages for conversation: ${conversation._id}`
              );

              const messagesResponse =
                await sessionManager.authenticatedRequest(
                  `/messages/${conversation._id}?page=1&limit=50`
                );

              if (messagesResponse.ok) {
                const messagesResult = await messagesResponse.json();

                if (messagesResult.success) {
                  // Handle both possible response formats
                  const messages =
                    messagesResult.data || messagesResult.messages || [];
                  messagesData[conversation._id] = messages;

                  console.log(
                    `✅ Loaded ${messages.length} messages for ${conversation._id}`
                  );
                } else {
                  console.log(
                    `⚠️ No messages for ${conversation._id}:`,
                    messagesResult.message
                  );
                  messagesData[conversation._id] = [];
                }
              } else {
                console.error(
                  `❌ Failed to load messages for ${conversation._id}: ${messagesResponse.status}`
                );
                messagesData[conversation._id] = [];
              }
            } catch (error) {
              console.error(
                `Failed to fetch messages for conversation ${conversation._id}:`,
                error
              );
              messagesData[conversation._id] = [];
            }
          })
        );

        console.log(
          "Setting messages data for",
          Object.keys(messagesData).length,
          "conversations"
        );
        setMessages(messagesData);
      } else {
        console.error('Failed to load conversations:', conversationsData);
        updateConversations([]);
        setMessages({});
      }

      // Fetch online users
      try {
        const onlineUsersResponse = await sessionManager.authenticatedRequest(
          "/users/online"
        );
        if (onlineUsersResponse.ok) {
          const onlineUsersData = await onlineUsersResponse.json();
          if (onlineUsersData.success) {
            const onlineUserIds = onlineUsersData.onlineUsers.map(
              (user) => user._id
            );
            updateOnlineUsers(onlineUserIds);
          }
        }
      } catch (error) {
        console.error("Failed to fetch online users:", error);
      }
    } catch (error) {
      console.error("Failed to initialize user data:", error);
      showNotification(
        "Failed to load chat data. Please try refreshing the page.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUnreadCounts = async () => {
    try {
      const response = await sessionManager.authenticatedRequest("/conversations/unread-counts");
      if (response.ok) {
        const data = await response.json();
        console.log('Refresh unread counts response:', data);
        console.log('updateConversations function available:', !!updateConversations);
        if (data.success && updateConversations) {
          // Update conversations with fresh unread counts
          updateConversations((prevConversations) => {
            if (!prevConversations || !Array.isArray(prevConversations)) {
              console.warn('Invalid conversations data:', prevConversations);
              return prevConversations || [];
            }
            
            return prevConversations.map((conv) => {
              if (!conv || !conv._id) {
                console.warn('Invalid conversation data:', conv);
                return conv;
              }
              
              return {
                ...conv,
                unreadCount: (data.data && data.data[conv._id]) || 0
              };
            });
          });
        }
      }
    } catch (error) {
      console.error("Error refreshing unread counts:", error);
    }
  };

  const refreshConversationsList = async (reappearedConversationId = null) => {
    try {
      console.log("Refreshing conversations list...");
      
      // Fetch conversations
      const conversationsResponse = await sessionManager.authenticatedRequest("/conversations");
      if (!conversationsResponse.ok) {
        throw new Error(`HTTP ${conversationsResponse.status}: ${conversationsResponse.statusText}`);
      }

      const conversationsData = await conversationsResponse.json();
      if (conversationsData.success) {
        // Fetch unread counts for all conversations
        const unreadCountsResponse = await sessionManager.authenticatedRequest("/conversations/unread-counts");
        
        let unreadCounts = {};
        if (unreadCountsResponse.ok) {
          const unreadCountsData = await unreadCountsResponse.json();
          if (unreadCountsData.success) {
            unreadCounts = unreadCountsData.unreadCounts;
          }
        }
        
        const conversationsWithUnread = conversationsData.data.map((conversation) => ({
          ...conversation,
          unreadCount: unreadCounts[conversation._id] || 0,
        }));

        // Apply blocked status since we know we have complete user data
        const conversationsWithBlockedStatus = conversationsWithUnread.map((conv) => ({
          ...conv,
          participants: conv.participants.map((participant) => ({
            ...participant,
            user: {
              ...participant.user,
              isBlockedByCurrentUser: currentUser.blockedUsers.includes(participant.user._id),
              hasBlockedCurrentUser: participant.user.hasBlockedCurrentUser || false,
            },
          })),
        }));

        console.log("Setting refreshed conversations with blocked status applied");
        console.log(`FRONTEND: Refreshed conversations count: ${conversationsWithBlockedStatus.length}`);
        console.log(`FRONTEND: Refreshed conversations:`, conversationsWithBlockedStatus.map(c => ({ id: c._id, name: c.name || 'Direct', isHidden: c.participants.find(p => p.user._id === currentUser._id)?.isHidden })));
        updateConversations(conversationsWithBlockedStatus);
        
        // If this is a reappeared conversation, set it as active
        if (reappearedConversationId) {
          const reappearedConversation = conversationsWithBlockedStatus.find(conv => conv._id === reappearedConversationId);
          if (reappearedConversation) {
            console.log(`🎉 FRONTEND: Setting reappeared conversation as active: ${reappearedConversationId}`);
            setActiveChat(reappearedConversation);
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh conversations list:", error);
    }
  };

  const fetchConversationDetails = async (conversationId) => {
    try {
      const response = await sessionManager.authenticatedRequest(`/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Add the conversation back to the list
          updateConversations(prevConversations => {
            const exists = prevConversations.find(conv => conv._id === conversationId);
            if (exists) {
              return prevConversations.map(conv => 
                conv._id === conversationId ? data.conversation : conv
              );
            } else {
              return [data.conversation, ...prevConversations];
            }
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch conversation details:", error);
    }
  };

  // Handle active chat change - UPDATED: Only update UI, don't auto-mark as read
  useEffect(() => {
    if (activeChat && currentUser) {
      // Just update unread count to 0 for active conversation in UI
      // but don't send socket events yet (prevents auto-read on refresh)
      updateConversations(
        conversations.map((conv) =>
          conv._id === activeChat._id ? { ...conv, unreadCount: 0 } : conv
        )
      );

      // Clear notifications for the active chat
      setMessageNotifications(prev => 
        prev.filter(notif => notif.conversationId !== activeChat._id)
      );
    }
  }, [activeChat?._id, currentUser]);

  // NEW: Function to handle explicit conversation viewing (when user actually clicks/focuses)
  const handleConversationViewed = useCallback((conversationId) => {
    // Only call markConversationRead - this handles both viewing and marking as read
    // viewConversation is redundant since markConversationRead does the same work
    socketService.markConversationRead(conversationId);

    // Update user interaction timestamp
    window.lastUserInteraction = Date.now();
    
    // Also immediately reset unread count for this conversation
    updateConversations((prevConversations) => {
      return prevConversations.map((conv) => {
        if (conv._id === conversationId) {
          return {
            ...conv,
            unreadCount: 0
          };
        }
        return conv;
      });
    });
  }, [updateConversations]);

  const handleLogin = async (credentials) => {
    try {
      showNotification("", "success");
      const response = await loginUser(credentials);
      console.log("Loggingin user");
      if (response.success) {
        console.log("Loggingin user success");
        setShowLogin(false);
        // Refresh session info
        refreshSessionInfo();
      } else if (response.emailVerificationRequired) {
        console.log("Loggingin user email");
        // Show verification popup when signup requires verification
        setShowVerificationAlert(true);
        showNotification(
          "Account created! Please check your email for verification instructions.",
          "success"
        );
        console.log(
          "Account created! Please check your email for verification instructions."
        );

        // Hide the alert after 8 seconds
        setTimeout(() => {
          setShowVerificationAlert(false);
        }, 8000);
      }
    } catch (error) {
      console.error("Login error:", error);
      showNotification(
        error.message || "Login failed. Please try again.",
        "error"
      );
    }
  };

  const handleLogout = async () => {
    try {
      disconnectSocket();
      await logoutUser();
      setShowLogin(true);
      setMessages({});
      setTypingUsers(new Set());
      setMessageStatuses({});
      clearError();
    } catch (error) {
      console.error("Logout error:", error);
      // Still proceed with logout even if server call fails
      setShowLogin(true);
      setMessages({});
      setTypingUsers(new Set());
      setMessageStatuses({});
      clearError();
    }
  };

  const handleSendMessage = async (
    conversationId,
    messageContent,
    currentUser,
    replyTo = null
  ) => {
    try {
      // Generate real ObjectId on client
      const messageId = ObjectId.generate();


      // Update user interaction timestamp
      window.lastUserInteraction = Date.now();

      // Add message to UI immediately with real ID
      const newMessage = {
        _id: messageId, // Real ObjectId, not tempId
        sender: currentUser,
        conversation: conversationId,
        content: messageContent,
        messageType: "text",
        status: "sending",
        createdAt: new Date().toISOString(),
        replyTo: replyTo,
        deliveredTo: [],
        readBy: [],
      };

      setMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), newMessage],
      }));

      // Prepare message data for server
      const messageData = {
        _id: messageId, // Include client-generated ID
        content: messageContent,
        messageType: "text",
      };

      if (replyTo) {
        messageData.replyTo = replyTo;
      }

      // Send message using authenticated request
      const response = await sessionManager.authenticatedRequest(
        `/messages/${conversationId}`,
        {
          method: "POST",
          body: JSON.stringify(messageData),
        }
      );

      const result = await response.json();

      if (!result.success) {
        // Remove message on error
        setMessages((prev) => ({
          ...prev,
          [conversationId]: prev[conversationId].filter(
            (msg) => msg._id !== messageId
          ),
        }));
        throw new Error(result.message || "Failed to send message");
      }

      // Update message status to sent (only if not already updated by socket events)
      setMessages((prev) => ({
        ...prev,
        [conversationId]: prev[conversationId].map((msg) =>
          msg._id === messageId
            ? { 
                ...msg, 
                status: msg.status === "sending" ? "sent" : msg.status, // Don't override delivered/read
                createdAt: result.data.createdAt 
              }
            : msg
        ),
      }));
    } catch (error) {
      console.error("Failed to send message:", error);
      showNotification("Failed to send message. Please try again.", "error");
    }
  };

  const handleSendFileMessage = async (
    conversationId,
    file,
    replyTo = null
  ) => {
    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        // Removed file validation error notification
        return;
      }

      // Removed upload progress notification

      // Upload file to cloud storage
      const uploadResult = await fileUploadService.uploadFile(file);

      // Generate real ObjectId
      const messageId = ObjectId.generate();

      console.log("Sending file message with client-generated ID:", messageId);

      // Update user interaction timestamp
      window.lastUserInteraction = Date.now();

      // Determine message type
      const messageType = getFileTypeFromFile(file);
      const fileInfo = createFileInfo(file, uploadResult);

      // Add message to UI immediately with real ID
      const newMessage = {
        _id: messageId, // Real ObjectId
        sender: currentUser,
        conversation: conversationId,
        content: uploadResult.url,
        messageType: messageType,
        fileInfo: fileInfo,
        status: "sending",
        createdAt: new Date().toISOString(),
        replyTo: replyTo,
        deliveredTo: [],
        readBy: [],
      };

      setMessages((prev) => ({
        ...prev,
        [conversationId]: [...(prev[conversationId] || []), newMessage],
      }));

      // Create message data with client-generated ID
      const messageData = {
        _id: messageId, // Include client-generated ID
        content: uploadResult.url,
        messageType: messageType,
        fileInfo: fileInfo,
      };

      if (replyTo) {
        messageData.replyTo = replyTo._id;
      }

      // Send to backend
      const response = await sessionManager.authenticatedRequest(
        `/messages/${conversationId}`,
        {
          method: "POST",
          body: messageData,
        }
      );

      const result = await response.json();

      if (!result.success) {
        // Remove message on error
        setMessages((prev) => ({
          ...prev,
          [conversationId]: prev[conversationId].filter(
            (msg) => msg._id !== messageId
          ),
        }));
        throw new Error(result.message || "Failed to send file message");
      }

      // Update message status (only if not already updated by socket events)
      setMessages((prev) => ({
        ...prev,
        [conversationId]: prev[conversationId].map((msg) =>
          msg._id === messageId
            ? { 
                ...msg, 
                status: msg.status === "sending" ? "sent" : msg.status, // Don't override delivered/read
                createdAt: result.data.createdAt 
              }
            : msg
        ),
      }));
    } catch (error) {
      console.error("Failed to send file:", error);
      // Removed file upload error notification
    }
  };

  // Enhanced message sending for broadcast channels (optional - add if you want to restrict messaging)
  const handleSendMessageWrapper = async (
    conversationId,
    content,
    file = null,
    replyTo = null
  ) => {
    const targetConversationId = conversationId || activeChat?._id;

    if (!targetConversationId) return;

    // Check if it's a broadcast channel and user has permission
    const conversation = conversations.find(
      (conv) => conv._id === targetConversationId
    );
    if (conversation && conversation.type === "broadcast") {
      console.log(
        "admins",
        conversation.admin,
        conversation.admins,
        currentUser._id
      );
      
      // Check main admin - handle both string and object formats
      const mainAdminId = typeof conversation.admin === 'string' 
        ? conversation.admin 
        : conversation.admin?._id;
      
      const isMainAdmin = mainAdminId === currentUser._id;
      
      // Check admins array - handle mixed formats
      const isAdditionalAdmin = conversation.admins && Array.isArray(conversation.admins) &&
        conversation.admins.some((admin) => {
          const adminUserId = typeof admin === 'string' ? admin : admin?._id;
          return adminUserId === currentUser._id;
        });
      
      const isAdmin = isMainAdmin || isAdditionalAdmin;

      if (!isAdmin) {
        showNotification(
          "Only administrators can send messages in broadcast channels",
          "error"
        );
        return;
      }
    }

    // Proceed with normal message sending
    if (file) {
      await handleSendFileMessage(targetConversationId, file, replyTo);
    } else if (content?.trim()) {
      await handleSendMessage(
        targetConversationId,
        content.trim(),
        currentUser,
        replyTo
      );
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      // Update user interaction timestamp
      window.lastUserInteraction = Date.now();

      const response = await sessionManager.authenticatedRequest(
        `/messages/${messageId}`,
        {
          method: "PUT",
          body: JSON.stringify({ content: newContent }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to edit message");
      }
      // Socket listeners will handle the update
    } catch (error) {
      console.error("Failed to edit message:", error);
      showNotification("Failed to edit message. Please try again.", "error");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      window.lastUserInteraction = Date.now();

      // For client-generated IDs, check if it's a local message that hasn't been sent yet
      if (!messageId.match(/^[0-9a-fA-F]{24}$/)) {
        console.error("Invalid message ID format:", messageId);
        showNotification("Invalid message ID", "error");
        return;
      }

      const response = await sessionManager.authenticatedRequest(
        `/messages/${messageId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to delete message");
      }

      showNotification("Message deleted successfully", "success");

      // Note: Don't remove from local state here - let the socket event handle it
      // This ensures consistency across all clients
    } catch (error) {
      console.error("Failed to delete message:", error);
      showNotification("Failed to delete message. Please try again.", "error");
    }
  };

  const handleReactToMessage = async (messageId, emoji) => {
    try {
      // Update user interaction timestamp
      window.lastUserInteraction = Date.now();

      // Prepare the request body - emoji can be null to remove reaction
      const requestBody = emoji ? { emoji } : {};

      const response = await sessionManager.authenticatedRequest(
        `/messages/${messageId}/react`,
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || "Failed to react to message");
      }
      // Socket listeners will handle the update
    } catch (error) {
      console.error("Failed to react to message:", error);
      showNotification(
        "Failed to react to message. Please try again.",
        "error"
      );
    }
  };

  // Handle conversation deletion - always use soft delete for regular users
  const handleDeleteConversation = async (
    conversationId,
    deleteType = "forMe"
  ) => {
    try {
      // For regular users, always use soft delete (hide conversation)
      // Only admins can permanently delete groups/broadcasts
      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}/delete`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.success) {
        // Remove from local state when user deletes
        updateConversations(
          conversations.filter((conv) => conv._id !== conversationId)
        );

        // Clear messages for this conversation
        setMessages((prev) => {
          const updated = { ...prev };
          delete updated[conversationId];
          return updated;
        });

        // Clear active chat if it's the deleted conversation
        if (activeChat?._id === conversationId) {
          setActiveChat(null);
        }

        // Don't show notification for delete chat - it should be silent
      } else {
        throw new Error(result.message || "Failed to delete conversation");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      showNotification(
        error.message || "Failed to delete conversation",
        "error"
      );
      throw error;
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      console.log(`🔄 Fetching initial messages for conversation ${conversationId}`);
      
      const response = await sessionManager.authenticatedRequest(
        `/messages/${conversationId}?page=1&limit=50`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📥 Messages API response for ${conversationId}:`, result);
      
      if (result.success) {
        const messages = result.data || result.messages || [];
        console.log(`✅ Fetched ${messages.length} messages for conversation ${conversationId}`);
        console.log(`📋 Messages:`, messages.map(m => ({ id: m._id, content: m.content, sender: m.sender?.name || m.sender?._id })));
        
        // Replace messages completely for this conversation
        setMessages((prev) => {
          const updated = {
            ...prev,
            [conversationId]: messages
          };
          console.log(`💾 Updated messages state for ${conversationId}:`, updated[conversationId]?.length || 0, 'messages');
          return updated;
        });
      } else {
        console.error(`❌ Failed to fetch messages:`, result.message);
      }
    } catch (error) {
      console.error(`❌ Error fetching messages for conversation ${conversationId}:`, error);
    }
  };

  const loadMoreMessages = async (conversationId, requestedPage = 2) => {
    try {
      console.log(
        `Loading messages for conversation ${conversationId}, page ${requestedPage}`
      );

      const page = requestedPage;

      const response = await sessionManager.authenticatedRequest(
        `/messages/${conversationId}?page=${page}&limit=20`
      );

      if (!response.ok) {
        console.error(`HTTP Error: ${response.status} ${response.statusText}`);
        return 0;
      }

      const result = await response.json();

      if (result.success) {
        // Handle both possible response formats
        const messages = result.data || result.messages || [];

        console.log(`Loaded ${messages.length} messages for page ${page}`);

        if (messages.length > 0) {
          setMessages((prev) => {
            const existingMessages = prev[conversationId] || [];

            // If it's page 1 or existing messages are empty, replace completely
            if (page === 1 || existingMessages.length === 0) {
              console.log(
                `Replacing messages for conversation ${conversationId}`
              );
              return {
                ...prev,
                [conversationId]: messages,
              };
            }

            // Otherwise, prepend new messages (older messages at the beginning)
            console.log(
              `Prepending ${messages.length} messages to conversation ${conversationId}`
            );
            return {
              ...prev,
              [conversationId]: [...messages, ...existingMessages],
            };
          });

          return messages.length;
        } else {
          console.log(`No messages returned for page ${page}`);
          return 0;
        }
      } else {
        console.error("API returned success: false", result.message);
        return 0;
      }
    } catch (error) {
      console.error("Failed to load more messages:", error);
      return 0;
    }
  };

  const handleAddParticipant = async (
    conversationId,
    userId,
    role = "member"
  ) => {
    try {
      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}/participants`,
        {
          method: "POST",
          body: JSON.stringify({ userId, role }),
        }
      );

      const result = await response.json();

      if (result.success) {
        // Update conversation in state immediately
        updateConversations(
          conversations.map((conv) =>
            conv._id === conversationId ? result.data : conv
          )
        );

        // Update active chat if it matches
        if (activeChat?._id === conversationId) {
          setActiveChat(result.data);
        }

        showNotification("Participant added successfully", "success");
      } else {
        throw new Error(result.message || "Failed to add participant");
      }
    } catch (error) {
      console.error("Failed to add participant:", error);
      showNotification("Failed to add participant. Please try again.", "error");
      throw error;
    }
  };

  const handleRemoveParticipant = async (conversationId, participantId) => {
    try {
      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}/participants/${participantId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (result.success) {
        // Update conversation in state immediately
        updateConversations(
          conversations.map((conv) =>
            conv._id === conversationId ? result.data : conv
          )
        );

        // Update active chat if it matches
        if (activeChat?._id === conversationId) {
          setActiveChat(result.data);
        }

        // If current user was removed, handle it specially
        if (participantId === currentUser._id) {
          // Remove from conversations list
          updateConversations(
            conversations.filter((conv) => conv._id !== conversationId)
          );

          // Clear messages for this conversation
          setMessages((prev) => {
            const updated = { ...prev };
            delete updated[conversationId];
            return updated;
          });

          // Clear active chat if it's the removed conversation
          if (activeChat?._id === conversationId) {
            setActiveChat(null);
          }

          showNotification("You were removed from the conversation", "info");
        } else {
          showNotification("Participant removed successfully", "success");
        }
      } else {
        throw new Error(result.message || "Failed to remove participant");
      }
    } catch (error) {
      console.error("Failed to remove participant:", error);
      showNotification(
        "Failed to remove participant. Please try again.",
        "error"
      );
      throw error;
    }
  };

  const handleCreateConversation = async (
    participantIds,
    conversationName = null,
    conversationType = "group",
    options = {}
  ) => {
    try {
      setIsLoading(true);

      const requestBody = {
        participants: participantIds,
        name: conversationName,
        type: conversationType,
      };

      // Add additional options for enhanced conversation types
      if (options.description) {
        requestBody.description = options.description;
      }

      if (options.avatar) {
        requestBody.avatar = options.avatar;
      }

      // Handle admin assignments for groups and broadcast channels
      if (options.admins && options.admins.length > 0) {
        requestBody.admins = options.admins;
      }

      // Mark as broadcast if specified
      if (options.isBroadcast || conversationType === "broadcast") {
        requestBody.isBroadcast = true;
      }

      const response = await sessionManager.authenticatedRequest(
        "/conversations",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      const result = await response.json();

      if (result.success) {
        const newConversation = { ...result.data, unreadCount: 0 };

        // Add to conversations list (at the beginning for newest first)
        updateConversations([newConversation, ...conversations]);

        // Initialize empty messages for the new conversation
        setMessages((prev) => ({
          ...prev,
          [result.data._id]: [],
        }));

        // Set as active chat
        setActiveChat(newConversation);

        // Join the new conversation room
        socketService.joinConversation(result.data._id);

        console.log(
          `✅ ${
            conversationType === "broadcast"
              ? "Broadcast Channel"
              : conversationType === "group"
              ? "Group"
              : "Conversation"
          } created:`,
          result.data._id
        );

        showNotification(
          `${
            conversationType === "broadcast"
              ? "Broadcast Channel"
              : conversationType === "group"
              ? "Group"
              : "Conversation"
          } "${conversationName || "Chat"}" created successfully!`,
          "success"
        );
      } else {
        throw new Error(
          result.message || `Failed to create ${conversationType}`
        );
      }
    } catch (error) {
      console.error(`Failed to create ${conversationType}:`, error);
      showNotification(
        `Failed to create ${
          conversationType === "broadcast"
            ? "broadcast channel"
            : conversationType
        }. Please try again.`,
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleConversationUpdate = async (conversationId, updateData) => {
    try {
      // Update user interaction timestamp
      window.lastUserInteraction = Date.now();

      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      const result = await response.json();

      if (result.success) {
        // Update conversation in state immediately
        updateConversations(
          conversations.map((conv) =>
            conv._id === conversationId ? result.data : conv
          )
        );

        // Update active chat if it matches
        if (activeChat?._id === conversationId) {
          setActiveChat(result.data);
        }

        showNotification("Conversation updated successfully", "success");
        return result.data;
      } else {
        throw new Error(result.message || "Failed to update conversation");
      }
    } catch (error) {
      console.error("Failed to update conversation:", error);
      showNotification(
        error.message || "Failed to update conversation. Please try again.",
        "error"
      );
      throw error;
    }
  };

  const handleCreateDirectConversation = async (userId) => {
    try {
      const response = await sessionManager.authenticatedRequest(
        `/users/${userId}/conversation`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.success) {
        const existingConv = conversations.find(
          (conv) => conv._id === result.conversation._id
        );
        if (!existingConv) {
          const newConversation = { ...result.conversation, unreadCount: 0 };
          updateConversations([newConversation, ...conversations]);
          setMessages((prev) => ({
            ...prev,
            [result.conversation._id]: [],
          }));

          // Join the new conversation room
          socketService.joinConversation(result.conversation._id);
        }
        setActiveChat(result.conversation);
      }
    } catch (error) {
      console.error("Failed to create direct conversation:", error);
      showNotification(
        "Failed to create conversation. Please try again.",
        "error"
      );
    }
  };

  const handleAddAdmin = async (conversationId, userId) => {
    try {
      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}/admins`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();

      if (result.success) {
        // Update conversation in state immediately with full conversation data
        updateConversations(
          conversations.map((conv) =>
            conv._id === conversationId ? result.data : conv
          )
        );

        // Update active chat if it matches
        if (activeChat?._id === conversationId) {
          setActiveChat(result.data);
        }

        // Removed admin added success notification
      } else {
        throw new Error(result.message || "Failed to add admin");
      }
    } catch (error) {
      console.error("Failed to add admin:", error);
      // Removed admin add error notification
    }
  };

  const handleRemoveAdmin = async (conversationId, userId) => {
    try {
      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}/admins/${userId}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (result.success) {
        // Update conversation in state immediately with full conversation data
        updateConversations(
          conversations.map((conv) =>
            conv._id === conversationId ? result.data : conv
          )
        );

        // Update active chat if it matches
        if (activeChat?._id === conversationId) {
          setActiveChat(result.data);
        }

        // Removed admin removed success notification
      } else {
        throw new Error(result.message || "Failed to remove admin");
      }
    } catch (error) {
      console.error("Failed to remove admin:", error);
      // Removed admin remove error notification
    }
  };

  // Add these handlers in ChatApp.js around line 400-500

  const handleClearChat = async (conversationId) => {
    try {
      window.lastUserInteraction = Date.now();

      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}/clear`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.success) {
        // Clear messages for this conversation in local state
        setMessages((prev) => ({
          ...prev,
          [conversationId]: [], // Set to empty array
        }));

        // Update conversation's last message to null
        updateConversations(
          conversations.map((conv) =>
            conv._id === conversationId
              ? {
                  ...conv,
                  lastMessage: null,
                  updatedAt: new Date().toISOString(),
                }
              : conv
          )
        );

        showNotification("Chat cleared successfully for you", "success");
      } else {
        throw new Error(result.message || "Failed to clear chat");
      }
    } catch (error) {
      console.error("Failed to clear chat:", error);
      showNotification(
        error.message || "Failed to clear chat. Please try again.",
        "error"
      );
      throw error;
    }
  };

  const handleHideChat = async (conversationId) => {
    try {
      window.lastUserInteraction = Date.now();

      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}/hide`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.success) {
        // Hide conversation from the sidebar
        updateConversations(prevConversations => 
          prevConversations.filter(conv => conv._id !== conversationId)
        );
        
        // Clear active chat if it's the hidden conversation
        if (activeChat?._id === conversationId) {
          setActiveChat(null);
        }
        
        showNotification("Conversation hidden. It will reappear when someone sends a new message.", "success");
      } else {
        throw new Error(result.message || "Failed to hide conversation");
      }
    } catch (error) {
      console.error("Failed to hide conversation:", error);
      showNotification(
        error.message || "Failed to hide conversation. Please try again.",
        "error"
      );
      throw error;
    }
  };

  const handleDeleteChat = async (conversationId) => {
    try {
      window.lastUserInteraction = Date.now();

      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}/delete`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.success) {
        // Clear messages for this conversation in the frontend state
        setMessages(prev => ({
          ...prev,
          [conversationId]: []
        }));
        
        // Hide conversation from sidebar
        updateConversations(prevConversations => 
          prevConversations.filter(conv => conv._id !== conversationId)
        );
        
        // Clear active chat if it's the deleted conversation
        if (activeChat?._id === conversationId) {
          setActiveChat(null);
        }
        
        showNotification("Conversation deleted successfully. It will reappear when someone sends a new message.", "success");
      } else {
        throw new Error(result.message || "Failed to delete conversation");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      showNotification(
        error.message || "Failed to delete conversation. Please try again.",
        "error"
      );
      throw error;
    }
  };

  const handleBlockUser = async (userId) => {
    try {
      // Update user interaction timestamp
      window.lastUserInteraction = Date.now();

      console.log("ChatApp: handleBlockUser called for userId:", userId);

      // First get the current block status from backend
      const statusResponse = await sessionManager.authenticatedRequest(
        `/users/${userId}/block-status`
      );

      let isCurrentlyBlocked = false;
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        isCurrentlyBlocked = statusData.isBlocked; // Current user has blocked the target user
        console.log("Current block status from server:", statusData);
      } else {
        console.error("Failed to get block status:", statusResponse.status);
        // Fallback: check local user data
        isCurrentlyBlocked =
          currentUser?.blockedUsers?.includes(userId) || false;
      }

      // Determine the correct endpoint
      const endpoint = isCurrentlyBlocked ? "unblock" : "block";
      console.log(
        `Calling ${endpoint} for user ${userId}, currently blocked: ${isCurrentlyBlocked}`
      );

      const response = await sessionManager.authenticatedRequest(
        `/users/${userId}/${endpoint}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.success) {
        // Update current user's blocked list in context
        setCurrentUser((prev) => {
          const newBlockedUsers = isCurrentlyBlocked
            ? (prev.blockedUsers || []).filter((id) => id !== userId)
            : [...(prev.blockedUsers || []), userId];

          console.log("Updated current user blocked list:", newBlockedUsers);

          return {
            ...prev,
            blockedUsers: newBlockedUsers,
          };
        });

        // Update conversations to reflect blocked status
        updateConversations(
          conversations.map((conv) => {
            if (conv.type === "direct") {
              const otherParticipant = conv.participants.find(
                (p) => p.user._id === userId
              );
              if (otherParticipant) {
                return {
                  ...conv,
                  participants: conv.participants.map((p) =>
                    p.user._id === userId
                      ? {
                          ...p,
                          user: {
                            ...p.user,
                            isBlockedByCurrentUser: !isCurrentlyBlocked, // Toggle the status
                          },
                        }
                      : p
                  ),
                };
              }
            }
            return conv;
          })
        );

        const action =
          result.isBlocked !== undefined
            ? result.isBlocked
              ? "blocked"
              : "unblocked"
            : isCurrentlyBlocked
            ? "unblocked"
            : "blocked";

        // Removed block/unblock success notification

        return result;
      } else {
        throw new Error(result.message || "Failed to block/unblock user");
      }
    } catch (error) {
      console.error("Failed to block/unblock user:", error);
      showNotification(
        error.message || "Failed to block/unblock user. Please try again.",
        "error"
      );
      throw error;
    }
  };

  const handleLeaveConversation = async (conversationId) => {
    try {
      // Update user interaction timestamp
      window.lastUserInteraction = Date.now();

      const response = await sessionManager.authenticatedRequest(
        `/conversations/${conversationId}/leave`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (result.success) {
        // Remove conversation from local state
        updateConversations(
          conversations.filter((conv) => conv._id !== conversationId)
        );

        // Clear messages for this conversation
        setMessages((prev) => {
          const updated = { ...prev };
          delete updated[conversationId];
          return updated;
        });

        // Clear active chat if it's the conversation we left
        if (activeChat?._id === conversationId) {
          setActiveChat(null);
        }

        // Show different messages based on result
        if (result.conversationDeleted) {
          showNotification("Conversation deleted (no members left)", "info");
        } else if (result.adminTransferred) {
          showNotification(
            `Left conversation successfully. ${result.newAdmin?.name} is now the administrator.`,
            "success"
          );
        } else {
          showNotification("Left conversation successfully", "success");
        }
      } else {
        throw new Error(result.message || "Failed to leave conversation");
      }
    } catch (error) {
      console.error("Failed to leave conversation:", error);
      showNotification(
        error.message || "Failed to leave conversation. Please try again.",
        "error"
      );
      throw error;
    }
  };
  const handleUpdateUserStatus = async (status) => {
    try {
      // Send via Socket.IO for real-time updates
      socketService.updateUserStatus(status);

      // Also send via HTTP for persistence
      const response = await sessionManager.authenticatedRequest(
        "/users/status",
        {
          method: "PUT",
          body: JSON.stringify({ status }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setCurrentUser((prev) => ({ ...prev, status }));
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      showNotification("Failed to update status. Please try again.", "error");
    }
  };

  // Handle typing indicators
  const handleTypingStart = (conversationId) => {
    if (conversationId) {
      // Update user interaction timestamp
      window.lastUserInteraction = Date.now();
      socketService.startTyping(conversationId);
    }
  };

  const handleTypingStop = (conversationId) => {
    if (conversationId) {
      socketService.stopTyping(conversationId);
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? "bg-gray-900 text-white" : "bg-gray-50"
        }`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login form
  if (showLogin) {
    return (
      <div>
        {error && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg">
            {error}
            <button
              onClick={clearError}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Single Top-Centered Green Popup */}
        {popupAlert.show && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999] max-w-md mx-4">
            <div className="bg-green-50 border-l-4 border-green-400 p-6 rounded-lg shadow-2xl">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm text-green-800 font-medium">
                    {popupAlert.message}
                  </p>
                </div>
                <button
                  onClick={() => setPopupAlert({ show: false, message: "" })}
                  className="ml-3 flex-shrink-0 text-green-500 hover:text-green-700 bg-green-100 hover:bg-green-200 rounded-full w-6 h-6 flex items-center justify-center"
                >
                  <span className="text-sm font-bold leading-none">×</span>
                </button>
              </div>
            </div>
          </div>
        )}
        <LoginForm
          onLogin={handleLogin}
          isDark={isDark}
          setIsDark={setIsDark}
          showVerificationAlert={showVerificationAlert}
        />
      </div>
    );
  }

  // Show main chat application
  return (
    <div>
      {notification && notification.message !== "" && (
        <div
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg transition-all ${
            notification.type === "success"
              ? "bg-green-100 border border-green-300 text-green-700"
              : "bg-red-100 border border-red-300 text-red-700"
          }`}
        >
          <div className="flex items-center space-x-2">
            <span>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-current hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Message Notification Bubbles */}
      <NotificationBubble
        notifications={messageNotifications}
        onNotificationClick={handleNotificationClick}
        onDismiss={dismissNotification}
        isDark={isDark}
      />

      <ChatLayout
        messages={messages}
        setMessages={setMessages}
        messageStatuses={messageStatuses}
        typingUsers={typingUsers}
        setTypingUsers={setTypingUsers}
        onLogout={handleLogout}
        onSendMessage={handleSendMessageWrapper}
        onCreateConversation={handleCreateConversation}
        onCreateDirectConversation={handleCreateDirectConversation}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        onReactToMessage={handleReactToMessage}
        onDeleteConversation={handleDeleteConversation}
        onSendFile={handleSendFileMessage}
        onLoadMoreMessages={loadMoreMessages}
        onUpdateUserStatus={handleUpdateUserStatus}
        onTypingStart={handleTypingStart}
        onTypingStop={handleTypingStop}
        onConversationViewed={handleConversationViewed}
        onAddAdmin={handleAddAdmin}
        onRemoveAdmin={handleRemoveAdmin}
        onAddParticipant={handleAddParticipant}
        onRemoveParticipant={handleRemoveParticipant}
        onUpdateConversation={handleConversationUpdate}
        onClearChat={handleClearChat}
        onHideChat={handleHideChat}
        onDeleteChat={handleDeleteChat}
        onBlockUser={handleBlockUser}
        onLeaveConversation={handleLeaveConversation}
      />
    </div>
  );
};

export default ChatApp;
