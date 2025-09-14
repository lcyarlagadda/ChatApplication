import React, { useState } from 'react';
import { MessageSquare, Plus, X, Radio } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import ProfileModal from './Modals/ProfileModal';
import ForwardModal from './Modals/ForwardModal';
import CreateConversationModal from './Modals/CreateConversationModal';
import { formatMessageForForwarding, isFileMessage } from '../utils/fileHelpers';

const ChatLayout = ({
  messages,
  setMessages,
  typingUsers,
  onCreateDirectConversation,
  onCreateConversation,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onReactToMessage,
  onSendFile,
  onLoadMoreMessages,
  onTypingStart,
  onTypingStop,
  onDeleteConversation,
  onAddAdmin,
  onRemoveAdmin,
  onAddParticipant,
  onRemoveParticipant,
  onUpdateConversation,
  onClearChat,
  onBlockUser,
  onLeaveConversation,
  onConversationViewed
}) => {
  // Get state from context
  const {
    currentUser,
    conversations,
    updateConversations,
    activeChat,
    setActiveChat,
    onlineUsers,
    isDark,
  } = useUser();

  const [showProfile, setShowProfile] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  
  // Unified conversation modal state
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [conversationMode, setConversationMode] = useState('select'); // 'select', 'direct', 'group', 'broadcast'
  const [notification, setNotification] = useState(null);

  const handleImageClick = (imageUrl) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  const handleForward = (message) => {
    const formattedMessage = formatMessageForForwarding(message);
    setMessageToForward(formattedMessage);
    setShowForwardModal(true);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Enhanced forwarding function
  const onForward = async (selectedConversations, messageToForward) => {
    try {
      let successCount = 0;
      let totalCount = selectedConversations.length;
      const conversationUpdates = new Map();

      for (const conversation of selectedConversations) {
        try {
          let forwardedContent = '';
          let forwardedMessageType = 'text';
          
          if (messageToForward.isFile && messageToForward.originalMessage) {
            const originalMessage = messageToForward.originalMessage;
            
            if (isFileMessage(originalMessage)) {
              const fileUrl = originalMessage.content || originalMessage.fileInfo?.url;
              
              if (!fileUrl) {
                throw new Error('File URL not found');
              }

              try {
                const response = await fetch(fileUrl);
                
                if (!response.ok) {
                  throw new Error(`Failed to fetch file: ${response.status}`);
                }
                
                const blob = await response.blob();
                const fileInfo = originalMessage.fileInfo || originalMessage.file || {};
                const fileName = fileInfo.displayName || fileInfo.originalName || 'forwarded_file';
                const fileType = fileInfo.type || blob.type || 'application/octet-stream';
                
                const file = new File([blob], fileName, {
                  type: fileType
                });
                
                await onSendFile(conversation._id, file);
                forwardedContent = messageToForward.displayText || `📎 ${fileName}`;
                forwardedMessageType = originalMessage.messageType;
                successCount++;
                
              } catch (fetchError) {
                console.error('Failed to fetch/forward file:', fetchError);
                const fallbackContent = `📎 ${messageToForward.fileName || 'File'} (Original file could not be forwarded)`;
                await onSendMessage(conversation._id, fallbackContent);
                forwardedContent = fallbackContent;
                successCount++;
              }
            } else {
              forwardedContent = messageToForward.content || messageToForward.displayText || 'Message';
              await onSendMessage(conversation._id, forwardedContent);
              successCount++;
            }
          } else {
            forwardedContent = messageToForward.content || messageToForward.displayText || 'Message';
            await onSendMessage(conversation._id, forwardedContent);
            successCount++;
          }
          
          conversationUpdates.set(conversation._id, {
            content: forwardedContent,
            sender: currentUser,
            timestamp: new Date().toISOString(),
            messageType: forwardedMessageType,
          });
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Failed to forward to conversation ${conversation._id}:`, error);
        }
      }
      
      if (conversationUpdates.size > 0) {
        updateConversations(
          conversations.map(conv => {
            const update = conversationUpdates.get(conv._id);
            if (update) {
              return {
                ...conv,
                lastMessage: update,
                updatedAt: new Date().toISOString()
              };
            }
            return conv;
          })
        );
      }
      
      if (successCount === 0) {
        showNotification('Failed to forward message to any conversations', 'error');
      } else if (successCount < totalCount) {
        showNotification(
          `Message forwarded to ${successCount}/${totalCount} conversations`,
          'success'
        );
      } else {
        showNotification(
          `Message forwarded to ${successCount} conversation${successCount > 1 ? 's' : ''}`,
          'success'
        );
      }
      
    } catch (error) {
      console.error('Forward operation failed:', error);
      showNotification('Failed to forward message. Please try again.', 'error');
    }
  };

  const handleProfileClick = (user) => {
    setProfileUser(user);
    setShowProfile(true);
  };

  // Unified conversation handlers
  const handleStartConversation = (mode = 'select') => {
    setConversationMode(mode);
    setShowConversationModal(true);
  };

  const handleCreateConversation = async (participantIds, conversationName, conversationType, options = {}) => {
    try {
      await onCreateConversation(participantIds, conversationName, conversationType, options);
      
      const typeLabel = conversationType === 'broadcast' ? 'Channel' : 
                       conversationType === 'group' ? 'Group' : 'Conversation';
      
      showNotification(`${typeLabel} "${conversationName}" created successfully!`, 'success');
    } catch (error) {
      console.error('Failed to create conversation:', error);
      const typeLabel = conversationType === 'broadcast' ? 'channel' : 
                       conversationType === 'group' ? 'group' : 'conversation';
      showNotification(`Failed to create ${typeLabel}. Please try again.`, 'error');
    }
  };

  const handleCreateDirectConversation = async (userId) => {
    try {
      // Check if conversation already exists
      const existingConv = conversations.find(conv => 
        conv.type === 'direct' && 
        conv.participants.some(participant => 
          participant.user._id === userId
        )
      );

      if (existingConv) {
        setActiveChat(existingConv);
        return;
      }

      await onCreateDirectConversation(userId);
      showNotification('Direct conversation created successfully!', 'success');
    } catch (error) {
      console.error('Failed to create direct conversation:', error);
      showNotification('Failed to create conversation. Please try again.', 'error');
    }
  };

  const handleCloseConversationModal = () => {
    setShowConversationModal(false);
    setConversationMode('select');
  };

  return (
    <div className={`h-screen flex ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50'}`}>
      {notification && (
        <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg transition-all ${
          notification.type === 'success' 
            ? 'bg-green-100 border border-green-300 text-green-700' 
            : 'bg-red-100 border border-red-300 text-red-700'
        }`}>
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
      
      {/* Sidebar */}
      <Sidebar
        onStartConversation={handleStartConversation}
        onProfileClick={handleProfileClick}
        messages={messages}
        onDeleteConversation={onDeleteConversation}
      />

      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <ChatArea
            isDark={isDark}
            currentUser={currentUser}
            activeChat={activeChat}
            messages={messages[activeChat._id] || []}
            setMessages={setMessages}
            onlineUsers={onlineUsers}
            typingUsers={typingUsers}
            onProfileClick={handleProfileClick}
            onImageClick={handleImageClick}
            onForward={handleForward}
            onSendMessage={onSendMessage}
            onEditMessage={onEditMessage}
            onDeleteMessage={onDeleteMessage}
            onReactToMessage={onReactToMessage}
            onSendFile={onSendFile}
            onLoadMoreMessages={onLoadMoreMessages}
            onTypingStart={onTypingStart}
            onTypingStop={onTypingStop}
            onDeleteConversation = {onDeleteConversation}
            onAddAdmin={onAddAdmin}
            onRemoveAdmin={onRemoveAdmin}
            onAddParticipant={onAddParticipant}
            onRemoveParticipant={onRemoveParticipant}
            onUpdateConversation = {onUpdateConversation}
            onClearChat={onClearChat}
            onBlockUser={onBlockUser}
            onLeaveConversation={onLeaveConversation}
            onConversationViewed={onConversationViewed}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Welcome to ChatApp</h2>
              <p className="text-gray-500 mb-6">Select a conversation to start messaging</p>
              
              {/* Conversation Type Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                {/* Direct Message */}
                <div 
                  onClick={() => handleStartConversation('direct')}
                  className={`p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
                    isDark 
                      ? 'border-gray-600 hover:border-blue-500 hover:bg-gray-800' 
                      : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Direct Message</h3>
                  <p className="text-sm text-gray-500">Private one-on-one conversation</p>
                </div>

                {/* Group Chat */}
                <div 
                  onClick={() => handleStartConversation('group')}
                  className={`p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
                    isDark 
                      ? 'border-gray-600 hover:border-green-500 hover:bg-gray-800' 
                      : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Group Chat</h3>
                  <p className="text-sm text-gray-500">Collaborate with multiple people</p>
                </div>

                {/* Broadcast Channel */}
                <div 
                  onClick={() => handleStartConversation('broadcast')}
                  className={`p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:shadow-lg hover:scale-105 ${
                    isDark 
                      ? 'border-gray-600 hover:border-purple-500 hover:bg-gray-800' 
                      : 'border-gray-300 hover:border-purple-500 hover:bg-purple-50'
                  }`}
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Radio className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">Broadcast Channel</h3>
                  <p className="text-sm text-gray-500">One-way announcements to subscribers</p>
                </div>
              </div>

              <button
                onClick={() => handleStartConversation('select')}
                className="mt-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all transform hover:scale-105"
              >
                Start New Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unified Conversation Modal */}
      <CreateConversationModal
        isOpen={showConversationModal}
        mode={conversationMode}
        onClose={handleCloseConversationModal}
        onCreateConversation={handleCreateConversation}
        onCreateDirectConversation={handleCreateDirectConversation}
        isDark={isDark}
      />

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-4xl max-h-full">
            <img
              src={selectedImage}
              alt="Full size view"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {/* Other Modals */}
      {showProfile && profileUser && (
        <ProfileModal
          user={profileUser}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showForwardModal && messageToForward && (
        <ForwardModal
          message={messageToForward}
          conversations={conversations}
          activeChat={activeChat}
          isDark={isDark}
          currentUser={currentUser}
          onForward={onForward}
          onClose={() => setShowForwardModal(false)}
        />
      )}
    </div>
  );
};

export default ChatLayout;