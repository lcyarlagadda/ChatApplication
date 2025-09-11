import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp } from 'lucide-react';
import Message from './Message';

const MessageList = ({
  isDark,
  currentUser,
  activeChat,
  messages,
  typingUsers,
  onImageClick,
  onForward,
  onReply,
  onEditMessage,
  onDeleteMessage,
  onReactToMessage,
  onLoadMoreMessages
}) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const messageRefs = useRef(new Map()); // Store refs to individual messages
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // Helper function to normalize user ID
  const getUserId = (user) => {
    if (typeof user === 'string') return user;
    return user?._id || user?.id;
  };

  // Listen for scroll to message events from search
  useEffect(() => {
    const handleScrollToMessage = (event) => {
      const { messageId } = event.detail;
      scrollToMessage(messageId);
    };

    window.addEventListener('scrollToMessage', handleScrollToMessage);
    return () => {
      window.removeEventListener('scrollToMessage', handleScrollToMessage);
    };
  }, [messages]);

  // Function to scroll to a specific message
  const scrollToMessage = async (messageId) => {
    // Set highlight immediately when search is triggered
    setHighlightedMessageId(messageId);
    
    // First, check if the message is already loaded
    let messageElement = messageRefs.current.get(messageId);
    
    if (messageElement) {
      // Message is already visible, scroll to it
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Keep highlight for 3 seconds
      setTimeout(() => setHighlightedMessageId(null), 3000);
      return;
    }

    // Check if message exists in current messages array
    const messageExists = messages.some(msg => msg._id === messageId);
    
    if (messageExists) {
      // Message exists but ref not set, wait for render
      let retries = 0;
      const maxRetries = 10;
      
      const checkForElement = () => {
        retries++;
        messageElement = messageRefs.current.get(messageId);
        
        if (messageElement) {
          messageElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          setTimeout(() => setHighlightedMessageId(null), 3000);
        } else if (retries < maxRetries) {
          setTimeout(checkForElement, 200);
        } else {
          setHighlightedMessageId(null);
        }
      };
      
      setTimeout(checkForElement, 100);
      return;
    }
  
    
    let attempts = 0;
    const maxAttempts = 5;
    
    const loadAndSearch = async () => {
      while (attempts < maxAttempts) {
        
        const newMessagesCount = await loadMoreMessages();
        
        if (newMessagesCount === 0) {
          setHighlightedMessageId(null);
          break;
        }
        
        attempts++;
        
        // Wait for new messages to render
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Check if message is now available
        const messageInArray = messages.some(msg => msg._id === messageId);
        if (messageInArray) {
          
          // Wait a bit more for refs to be set
          setTimeout(() => {
            const element = messageRefs.current.get(messageId);
            if (element) {
              element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
              setTimeout(() => setHighlightedMessageId(null), 3000);
            } else {
              setHighlightedMessageId(null);
            }
          }, 500);
          return;
        }
      }
      setHighlightedMessageId(null);
    };
    
    loadAndSearch();
  };

  // Store message refs
  const setMessageRef = (messageId, element) => {
    if (element) {
      messageRefs.current.set(messageId, element);
    } else {
      messageRefs.current.delete(messageId);
    }
  };

  // Auto-scroll to bottom on new messages and initial render
  useEffect(() => {
    if (messagesContainerRef.current && !highlightedMessageId) {
      const container = messagesContainerRef.current;
      const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 50;
      
      // Only auto-scroll if user is already at the bottom or if it's a new conversation
      if (isScrolledToBottom || messages.length <= 1) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [messages, highlightedMessageId]);

  // Scroll to bottom on initial render and when activeChat changes
  useEffect(() => {
    // Clear message refs when chat changes
    messageRefs.current.clear();
    setHighlightedMessageId(null);
    
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, 100);

    return () => clearTimeout(timer);
  }, [activeChat]);

  // Also scroll immediately when component first mounts
  useEffect(() => {
    if (messages.length > 0 && !highlightedMessageId) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [messages.length, highlightedMessageId]);

  // Reset pagination when chat changes
  useEffect(() => {
    setPage(1);
    setHasMoreMessages(true);
  }, [activeChat]);

  useEffect(() => {
    // Reset pagination when messages are cleared or significantly reduced
    if (!messages || messages.length === 0) {
      console.log('Messages cleared - resetting pagination');
      setPage(1);
      setHasMoreMessages(true);
      setLoading(false);
      messageRefs.current.clear();
      setHighlightedMessageId(null);
    }
  }, [messages?.length]);

  // Handle scroll events
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const isScrolledToBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 100;
    
    setShowScrollButton(!isScrolledToBottom);

    // Load more messages when scrolled to top
    if (container.scrollTop === 0 && hasMoreMessages && !loading) {
      loadMoreMessages();
    }
  };

  // Load more messages
const loadMoreMessages = async () => {
  if (!onLoadMoreMessages || loading || !hasMoreMessages) return 0;

  setLoading(true);
  try {
    // Start from page 2 for additional loads, page 1 for initial/cleared state
    const nextPage = messages.length === 0 ? 1 : page + 1;
    console.log(`MessageList: Loading page ${nextPage}, current page: ${page}, messages count: ${messages.length}`);
    
    const newMessagesCount = await onLoadMoreMessages(activeChat._id, nextPage);
    
    if (newMessagesCount === 0) {
      setHasMoreMessages(false);
      console.log('No more messages to load');
    } else {
      setPage(nextPage);
      console.log(`Loaded ${newMessagesCount} messages, updated page to ${nextPage}`);
    }
    return newMessagesCount;
  } catch (error) {
    console.error('Failed to load more messages:', error);
    return 0;
  } finally {
    setLoading(false);
  }
};


  // Scroll to bottom with smooth animation
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Enhanced scroll to specific message function (can be called externally)
  const scrollToSpecificMessage = (messageId) => {
    scrollToMessage(messageId);
  };

  // Expose scroll function via ref (optional)
  useEffect(() => {
    if (typeof onLoadMoreMessages === 'function') {
      // Attach scroll function to window for external access
      window.scrollToMessage = scrollToSpecificMessage;
    }
    
    return () => {
      if (window.scrollToMessage) {
        delete window.scrollToMessage;
      }
    };
  }, []);

  // Get message element by ID (helper function)
  const getMessageElement = (messageId) => {
    return messageRefs.current.get(messageId);
  };

  // Check if message is in view
  const isMessageInView = (messageId) => {
    const element = messageRefs.current.get(messageId);
    if (!element || !messagesContainerRef.current) return false;
    
    const container = messagesContainerRef.current;
    const rect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    return (
      rect.top >= containerRect.top &&
      rect.bottom <= containerRect.bottom
    );
  };

  // Format typing users
  const getTypingText = () => {
    if (!typingUsers || typingUsers.size === 0) return '';
    
    const typingArray = Array.from(typingUsers);
    if (typingArray.length === 1) {
      return `${typingArray[0]} is typing...`;
    } else if (typingArray.length === 2) {
      return `${typingArray[0]} and ${typingArray[1]} are typing...`;
    } else {
      return `${typingArray[0]} and ${typingArray.length - 1} others are typing...`;
    }
  };

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = [];
    let currentDate = null;
    let currentGroup = null;

    messages.forEach(message => {
      const messageDate = new Date(message.createdAt || message.timestamp).toDateString();
      
      if (messageDate !== currentDate) {
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentDate = messageDate;
        currentGroup = {
          date: messageDate,
          messages: [message]
        };
      } else {
        currentGroup.messages.push(message);
      }
    });

    if (currentGroup) {
      groups.push(currentGroup);
    }

    return groups;
  };

  const messageGroups = groupMessagesByDate(messages || []);

  return (
    <div className="flex-1 flex flex-col relative h-full">
      {/* Custom scrollbar styles and highlight styles */}
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: ${isDark ? '#4B5563 #1F2937' : '#D1D5DB #F9FAFB'};
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDark ? '#1F2937' : '#F9FAFB'};
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark ? '#4B5563' : '#D1D5DB'};
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? '#6B7280' : '#9CA3AF'};
        }

        /* Target message bubbles directly for gold color change only */
        .highlighted-message div[class*="bg-gradient-to-r"],
        .highlighted-message div[class*="bg-gray-700"],
        .highlighted-message div[class*="bg-gray-200"] {
          background: linear-gradient(135deg, #42a5f5ff, #64b5f6ff, #90caf9ff) !important;
          color: white !important;
          transition: background 0.3s ease !important;
        }
      `}</style>

      {/* Messages container with visible scrollbar */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
        onScroll={handleScroll}
      >
        {/* Load more indicator */}
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading more messages...</p>
          </div>
        )}

        {/* No more messages indicator */}
        {!hasMoreMessages && messages && messages.length > 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">No more messages</p>
          </div>
        )}

        {/* Empty state */}
        {(!messages || messages.length === 0) && !loading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          </div>
        )}

        {/* Message groups */}
        {messageGroups.map((group, groupIndex) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center justify-center my-4">
              <div className={`px-3 py-1 rounded-full text-xs ${
                isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'
              }`}>
                {new Date(group.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
            </div>

            {/* Messages in this group */}
            {group.messages.map((message, index) => {
              // Calculate ownership more robustly
              const messageSenderId = getUserId(message.sender);
              const currentUserId = getUserId(currentUser);
              const isOwn = messageSenderId === currentUserId;
              const isHighlighted = highlightedMessageId === message._id;
              
              return (
                <div
                  key={message._id || message.id || index}
                  ref={(el) => setMessageRef(message._id, el)}
                  className={isHighlighted ? 'highlighted-message' : ''}
                  id={`message-${message._id}`}
                >
                  <Message
                    message={message}
                    isOwn={isOwn}
                    currentUser={currentUser}
                    activeChat={activeChat}
                    messages={messages}
                    isDark={isDark}
                    onImageClick={onImageClick}
                    onForward={onForward}
                    onDeleteMessage={onDeleteMessage}
                    onEditMessage={onEditMessage}
                    onReply={onReply}
                    onReactToMessage={onReactToMessage}
                  />
                </div>
              );
            })}
          </div>
        ))}
        
        {/* Typing indicator */}
        {typingUsers && typingUsers.size > 0 && (
          <div className="flex justify-start mb-4">
            <div className={`px-4 py-2 rounded-2xl ${
              isDark ? 'bg-gray-700' : 'bg-gray-200'
            }`}>
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-500 ml-2">
                  {getTypingText()}
                </span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button with enhanced styling */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className={`absolute bottom-6 right-6 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-10 ${
            isDark ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-white hover:bg-gray-50 text-gray-700'
          } border border-gray-200 dark:border-gray-600`}
          title="Scroll to bottom"
        >
          <ChevronUp className="w-5 h-5 transform rotate-180" />
          {/* Unread indicator on scroll button */}
          {messages.length > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          )}
        </button>
      )}
    </div>
  );
};

export default MessageList;