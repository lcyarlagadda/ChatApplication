// ===== ChatArea.js =====
import React, { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ConfirmationModal from './Modals/ConfirmationModal';
import { Trash2, UserX, LogOut } from 'lucide-react';

const ChatArea = ({
  messages,
  typingUsers,
  onProfileClick,
  onImageClick,
  onForward,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReactToMessage,
  onLoadMoreMessages,
  onTypingStart,
  onTypingStop,
  onUpdateConversation,
  onDeleteConversation,
  onAddParticipant,
  onRemoveParticipant,
  onAddAdmin,
  onRemoveAdmin,
  onConversationViewed,
  onClearChat,
  onBlockUser, // This is the actual block function from ChatApp
  onLeaveConversation
}) => {
  const {
    currentUser,
    activeChat,
    onlineUsers,
    isDark,
    conversations
  } = useUser();

  const [replyingTo, setReplyingTo] = useState(null);
  
  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState({
    isOpen: false,
    type: 'default',
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
    icon: null,
    details: null
  });

  // Modal helper functions
  const showConfirmationModal = (config) => {
    setConfirmationModal({
      isOpen: true,
      type: config.type || 'default',
      title: config.title,
      message: config.message,
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      onConfirm: config.onConfirm,
      icon: config.icon || null,
      details: config.details || null
    });
  };

  const hideConfirmationModal = () => {
    setConfirmationModal(prev => ({ ...prev, isOpen: false }));
  };

  // Get block status helper function
  const getBlockedStatus = (userId) => {
    const conversation = conversations.find(conv => 
      conv.type === 'direct' && conv.participants.some(p => p.user._id === userId)
    );
    
    const otherUser = conversation?.participants?.find(p => p.user._id === userId)?.user;
    const isCurrentlyBlocked = currentUser?.blockedUsers?.includes(userId);
    
    return {
      otherUser,
      isCurrentlyBlocked,
      conversation
    };
  };

  // Enhanced confirmation handlers
  const handleClearChat = async (conversationId) => {
    const conversation = conversations.find(conv => conv._id === conversationId);
    const conversationName = conversation?.name || 
      conversation?.participants?.find(p => p.user._id !== currentUser._id)?.user?.name || 
      'this chat';
    
    showConfirmationModal({
      type: 'warning',
      title: 'Clear Chat',
      message: `Clear all messages in "${conversationName}"?`,
      details: 'This action cannot be undone. All messages, files, and media will be permanently deleted from this chat.',
      confirmText: 'Clear Chat',
      cancelText: 'Keep Messages',
      icon: Trash2,
      onConfirm: async () => {
        try {
          await onClearChat(conversationId);
          hideConfirmationModal();
        } catch (error) {
          console.error('Failed to clear chat:', error);
          hideConfirmationModal();
        }
      }
    });
  };

  // This function shows confirmation and calls the actual block function
  const handleBlockUser = async (userId) => {
    console.log('ChatArea: Block user confirmation requested for:', userId);
    
    const { otherUser, isCurrentlyBlocked } = getBlockedStatus(userId);
    
    if (!otherUser) {
      console.error('User not found');
      return;
    }

    console.log('Block status check:', {
      userId,
      otherUserName: otherUser.name,
      isCurrentlyBlocked,
      currentUserBlockedUsers: currentUser?.blockedUsers
    });

    showConfirmationModal({
      type: isCurrentlyBlocked ? 'info' : 'danger',
      title: isCurrentlyBlocked ? 'Unblock User' : 'Block User',
      message: isCurrentlyBlocked 
        ? `Unblock ${otherUser.name}?`
        : `Block ${otherUser.name}?`,
      details: isCurrentlyBlocked
        ? 'They will be able to send you messages and see when you\'re online.'
        : 'They won\'t be able to send you messages or see when you\'re online. You can unblock them anytime.',
      confirmText: isCurrentlyBlocked ? 'Unblock' : 'Block User',
      cancelText: 'Cancel',
      icon: UserX,
      onConfirm: async () => {
        try {
          console.log('Confirmation accepted, calling onBlockUser with:', userId);
          await onBlockUser(userId); // Call the actual block function from ChatApp
          hideConfirmationModal();
        } catch (error) {
          console.error('Failed to block/unblock user:', error);
          hideConfirmationModal();
        }
      }
    });
  };

  const handleLeaveConversation = async (conversationId) => {
    const conversation = conversations.find(conv => conv._id === conversationId);
    const conversationName = conversation?.name || 'this conversation';
    const conversationType = conversation?.type === 'broadcast' ? 'channel' : 'group';
    
    // Check if user is the only admin
    const isOnlyAdmin = conversation?.admins?.length === 1 && 
                        conversation.admins[0]._id === currentUser._id &&
                        conversation.participants?.length > 1;

    let warningMessage = `You won't be able to see new messages unless someone adds you back.`;
    
    if (isOnlyAdmin) {
      warningMessage = `You are the only administrator. Leaving will make this ${conversationType} without any admin. Consider promoting someone else first.`;
    }

    showConfirmationModal({
      type: 'warning',
      title: `Leave ${conversationType === 'channel' ? 'Channel' : 'Group'}`,
      message: `Leave "${conversationName}"?`,
      details: warningMessage,
      confirmText: `Leave ${conversationType === 'channel' ? 'Channel' : 'Group'}`,
      cancelText: 'Stay',
      icon: LogOut,
      onConfirm: async () => {
        try {
          await onLeaveConversation(conversationId);
          hideConfirmationModal();
        } catch (error) {
          console.error(`Failed to leave ${conversationType}:`, error);
          hideConfirmationModal();
        }
      }
    });
  };

  const handleShowDeleteConfirmation = () => {
    // Handle different conversation types
    if (activeChat?.type === 'direct') {
      const otherUser = activeChat.participants?.find(p => p.user._id !== currentUser._id)?.user;
      const userName = otherUser?.name || 'Unknown User';
      
      showConfirmationModal({
        type: 'danger',
        title: 'Delete Chat',
        message: `Delete chat with ${userName}?`,
        details: 'This will permanently delete this conversation and all its messages. The other person will also lose access to this chat history.',
        confirmText: 'Delete Chat',
        cancelText: 'Keep Chat',
        icon: Trash2,
        onConfirm: async () => {
          try {
            await onDeleteConversation(activeChat._id);
            hideConfirmationModal();
          }
          catch{
            console.error(`Failed to delete conversation`);
            hideConfirmationModal();
          }
        }
      });
    } else {
      // Group/Broadcast logic
      const conversationType = activeChat?.type === 'broadcast' ? 'channel' : 'group';
      const conversationName = activeChat?.name || `this ${conversationType}`;
      
      showConfirmationModal({
        type: 'danger',
        title: `Delete ${conversationType === 'channel' ? 'Channel' : 'Group'}`,
        message: `Delete "${conversationName}"?`,
        details: `This will permanently delete the ${conversationType} and all its messages for everyone. This action cannot be undone.`,
        confirmText: `Delete ${conversationType === 'channel' ? 'Channel' : 'Group'}`,
        cancelText: 'Keep',
        icon: Trash2,
        onConfirm: async () => {
          try {
            await onDeleteConversation(activeChat._id);
            hideConfirmationModal();
          } catch (error) {
            console.error('Failed to delete conversation:', error);
            hideConfirmationModal();
          }
        }
      });
    }
  };

  // Handle reply
  const handleReply = (message) => {
    setReplyingTo(message);
  };

  // Handle send message
  const handleSendMessage = async (content, file = null, replyTo = null) => {
    try {
      if (!activeChat) {
        console.error('No active chat selected');
        return;
      }

      await onSendMessage(activeChat._id, content, file, replyTo);
      
      if (replyTo) {
        setReplyingTo(null);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  // Effect to handle conversation viewing
  useEffect(() => {
    if (activeChat && onConversationViewed) {
      onConversationViewed(activeChat._id);
    }
  }, [activeChat?._id, onConversationViewed]);

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p>No chat selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        isDark={isDark}
        currentUser={currentUser}
        activeChat={activeChat}
        onlineUsers={onlineUsers}
        onProfileClick={onProfileClick}
        onUpdateConversation={onUpdateConversation}
        onDeleteConversation={onDeleteConversation}
        onAddParticipant={onAddParticipant}
        onRemoveParticipant={onRemoveParticipant}
        onAddAdmin={onAddAdmin}
        onRemoveAdmin={onRemoveAdmin}
        onClearChat={handleClearChat}
        onBlockUser={handleBlockUser} // This shows confirmation and calls actual block
        onLeaveConversation={handleLeaveConversation}
        onShowDeleteConfirmation={handleShowDeleteConfirmation}
      />

      <div className="flex-1 flex flex-col min-h-0">
        <MessageList
          isDark={isDark}
          currentUser={currentUser}
          activeChat={activeChat}
          messages={messages || []}
          typingUsers={typingUsers}
          onImageClick={onImageClick}
          onForward={onForward}
          onReply={handleReply}
          onEditMessage={onEditMessage}
          onDeleteMessage={onDeleteMessage}
          onReactToMessage={onReactToMessage}
          onLoadMoreMessages={onLoadMoreMessages}
        />
      </div>

      <MessageInput
        isDark={isDark}
        currentUser={currentUser}
        activeChat={activeChat}
        onSendMessage={handleSendMessage}
        replyingTo={replyingTo}
        setReplyingTo={setReplyingTo}
        onTypingStart={() => onTypingStart(activeChat._id)}
        onTypingStop={() => onTypingStop(activeChat._id)}
        onBlockUser={handleBlockUser}
      />

      {/* Confirmation Modal */}
      {confirmationModal.isOpen && (
        <ConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={hideConfirmationModal}
          onConfirm={confirmationModal.onConfirm}
          title={confirmationModal.title}
          message={confirmationModal.message}
          confirmText={confirmationModal.confirmText}
          cancelText={confirmationModal.cancelText}
          type={confirmationModal.type}
          icon={confirmationModal.icon}
          details={confirmationModal.details}
          isDark={isDark}
        />
      )}
    </div>
  );
};

export default ChatArea;