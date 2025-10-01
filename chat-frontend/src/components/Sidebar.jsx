import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  Sun, 
  Moon, 
  LogOut, 
  Hash, 
  Crown, 
  Plus, 
  Trash2, 
  MessageSquare, 
  User, 
  Calendar, 
  X, 
  Filter, 
  Users, 
  UserPlus, 
  Radio,
  Settings,
  UserX,
  Shield,
  Bell
} from "lucide-react";
import { formatTime } from "../utils/helpers";
import { getSidebarPreviewText, shouldShowMessageSender } from "../utils/fileHelpers";
import { useUser } from "../contexts/UserContext";
import DeleteModal from "./Modals/DeleteModal";
import sessionManager from "../utils/sessionManager";

const Sidebar = ({ 
  onProfileClick, 
  onStartConversation, 
  onConversationViewed, 
  onDeleteConversation, 
  messages 
}) => {
  const { 
    currentUser, 
    conversations, 
    activeChat, 
    setActiveChat, 
    onlineUsers, 
    isDark, 
    toggleDarkMode,
    logoutUser 
  } = useUser();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(null);
  const [showNewChatMenu, setShowNewChatMenu] = useState(false);
  
  // Enhanced search state
  const [searchResults, setSearchResults] = useState([]);
  const [searchMode, setSearchMode] = useState("all"); // "all", "users", "messages"
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const searchTimeoutRef = useRef(null);

  // Load search history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('chat_search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load search history:', error);
      }
    }
  }, []);

  // Helper function to get blocked status
const getBlockedStatus = (conversation, currentUser) => {
  if (conversation.type !== 'direct') return { isBlocked: false };
  
  const otherUser = conversation.participants?.find(p => p.user._id !== currentUser._id)?.user;
  if (!otherUser) return { isBlocked: false };
  
  const currentUserBlockedOther = currentUser.blockedUsers?.includes(otherUser._id) || 
                                  otherUser.isBlockedByCurrentUser === true;
  const otherUserBlockedCurrent = otherUser.hasBlockedCurrentUser === true;
  
  return {
    isBlocked: currentUserBlockedOther || otherUserBlockedCurrent,
    blockedByCurrentUser: currentUserBlockedOther,
    blockedByOtherUser: otherUserBlockedCurrent
  };
};

  const isUserAdmin = (conversation, userId) => {
    if (!conversation || !userId) return false;
    
    // Check main admin - handle both string and object formats
    const mainAdminId = typeof conversation.admin === 'string' 
      ? conversation.admin 
      : conversation.admin?._id;
    
    if (mainAdminId === userId) return 'main';
    
    // Check admins array - handle mixed formats
    if (conversation.admins && Array.isArray(conversation.admins)) {
      const isAdditionalAdmin = conversation.admins.some((admin) => {
        const adminUserId = typeof admin === 'string' ? admin : admin?._id;
        return adminUserId === userId;
      });
      if (isAdditionalAdmin) return 'admin';
    }
    
    return false;
  };

  // Save search history to localStorage
  const saveSearchHistory = (query) => {
    if (!query.trim() || query.length < 2) return;
    
    const newHistory = [query, ...searchHistory.filter(item => item !== query)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('chat_search_history', JSON.stringify(newHistory));
  };

  // Get user from conversation participants
  const getUserFromConversation = (conversation, searchQuery) => {
    if (conversation.type === "group" || conversation.type === "broadcast") {
      // For group chats and broadcasts, find the participant that matches the search
      const matchingParticipant = conversation.participants.find(p => 
        p.user._id !== currentUser._id && 
        (p.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         p.user.email?.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      return matchingParticipant?.user || null;
    } else {
      // For direct chats, return the other user
      const otherParticipant = conversation.participants.find(
        participant => participant.user._id !== currentUser._id
      );
      return otherParticipant?.user || null;
    }
  };

  // Advanced search function
  const performAdvancedSearch = async (query, mode = "all") => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const results = [];

    try {
      // Search users/conversations
      if (mode === "all" || mode === "users") {
        const userResults = conversations.filter((conversation) => {
          const searchTerm = query.toLowerCase();

          // Search by conversation name (for groups/broadcasts)
          if (conversation.name?.toLowerCase().includes(searchTerm)) {
            return true;
          }

          // Search by participant names and emails
          return conversation.participants?.some(p => 
            p.user._id !== currentUser._id && (
              p.user?.name?.toLowerCase().includes(searchTerm) ||
              p.user?.email?.toLowerCase().includes(searchTerm)
            )
          );
        });

        userResults.forEach(conv => {
          const matchedUser = getUserFromConversation(conv, query);
          results.push({
            type: 'user',
            conversation: conv,
            user: matchedUser,
            matchType: 'name',
            preview: getLastMessagePreview(conv),
            isOnline: matchedUser ? [...onlineUsers].includes(matchedUser._id) : false
          });
        });
      }

      // Search messages within conversations
      if (mode === "all" || mode === "messages") {
        const messageSearchPromises = conversations.map(async (conversation) => {
          try {
            // Search in current loaded messages first
            const conversationMessages = messages[conversation._id] || [];
            const localMatches = conversationMessages.filter(message => {
              const searchTerm = query.toLowerCase();
              
              // Search message content
              if (message.content?.toLowerCase().includes(searchTerm)) return true;
              
              // Search file names
              if (message.fileInfo?.displayName?.toLowerCase().includes(searchTerm)) return true;
              if (message.fileInfo?.originalName?.toLowerCase().includes(searchTerm)) return true;
              
              return false;
            });

            // Add local matches
            localMatches.forEach(message => {
              results.push({
                type: 'message',
                conversation: conversation,
                message: message,
                matchType: 'content',
                preview: getMessagePreview(message, query),
                user: message.sender
              });
            });

            // Also search server for more comprehensive results
            if (query.length >= 3) {
              try {
                const response = await sessionManager.authenticatedRequest(
                  `/messages/search?q=${encodeURIComponent(query)}&conversationId=${conversation._id}&limit=3`
                );
                
                if (response.ok) {
                  const searchData = await response.json();
                  if (searchData.success && searchData.messages) {
                    searchData.messages.forEach(message => {
                      // Avoid duplicates from local search
                      const isDuplicate = results.some(r => 
                        r.type === 'message' && r.message._id === message._id
                      );
                      
                      if (!isDuplicate) {
                        results.push({
                          type: 'message',
                          conversation: conversation,
                          message: message,
                          matchType: 'server',
                          preview: message.highlightedContent || getMessagePreview(message, query),
                          user: message.sender
                        });
                      }
                    });
                  }
                }
              } catch (error) {
                console.error('Server message search failed:', error);
              }
            }

          } catch (error) {
            console.error(`Failed to search messages in conversation ${conversation._id}:`, error);
          }
        });

        await Promise.all(messageSearchPromises);
      }

      // Sort results by relevance and recency
      results.sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.type === 'user' ? 
          a.user?.name?.toLowerCase() === query.toLowerCase() ||
          a.conversation?.name?.toLowerCase() === query.toLowerCase() :
          a.message.content?.toLowerCase() === query.toLowerCase();
        const bExact = b.type === 'user' ?
          b.user?.name?.toLowerCase() === query.toLowerCase() ||
          b.conversation?.name?.toLowerCase() === query.toLowerCase() :
          b.message.content?.toLowerCase() === query.toLowerCase();
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;

        // Then by type (users first, then messages)
        if (a.type !== b.type) {
          return a.type === 'user' ? -1 : 1;
        }

        // Then by recency
        const aTime = a.type === 'user' ? 
          new Date(a.conversation.updatedAt || a.conversation.createdAt || 0) :
          new Date(a.message.createdAt || 0);
        const bTime = b.type === 'user' ?
          new Date(b.conversation.updatedAt || b.conversation.createdAt || 0) :
          new Date(b.message.createdAt || 0);
        
        return bTime - aTime;
      });

      // Remove duplicates
      const uniqueResults = [];
      const seenConversations = new Set();
      const seenMessages = new Set();

      results.forEach(result => {
        if (result.type === 'user') {
          if (!seenConversations.has(result.conversation._id)) {
            seenConversations.add(result.conversation._id);
            uniqueResults.push(result);
          }
        } else {
          const messageKey = `${result.message._id}-${result.conversation._id}`;
          if (!seenMessages.has(messageKey)) {
            seenMessages.add(messageKey);
            uniqueResults.push(result);
          }
        }
      });

      setSearchResults(uniqueResults.slice(0, 15));
      saveSearchHistory(query);

    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performAdvancedSearch(searchQuery, searchMode);
      }, 300);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchMode, conversations, messages]);

  // Get message preview with highlighted search term
  const getMessagePreview = (message, searchTerm) => {
    let content = message.content || '';
    
    if (message.fileInfo) {
      const fileName = message.fileInfo.displayName || message.fileInfo.originalName || 'File';
      content = `📎 ${fileName}`;
    }

    // Highlight search term
    if (searchTerm && content.toLowerCase().includes(searchTerm.toLowerCase())) {
      const regex = new RegExp(`(${searchTerm})`, 'gi');
      return content.replace(regex, '**$1**');
    }

    return content.length > 60 ? content.substring(0, 60) + '...' : content;
  };

  // Handle search result click
  const handleSearchResultClick = (result) => {
    if (result.type === 'user') {
      handleConversationClick(result.conversation);
    } else if (result.type === 'message') {
      setActiveChat(result.conversation);
      setSearchQuery('');
      setSearchResults([]);
      
      if (typeof onConversationViewed === 'function') {
        onConversationViewed(result.conversation._id);
      }

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('scrollToMessage', { 
          detail: { messageId: result.message._id } 
        }));
      }, 100);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchFilters(false);
  };

  // Get other user in direct conversation
  const getOtherUser = (conversation) => {
    if (conversation.type !== "direct") return null;

    const otherParticipant = conversation.participants.find(
      (participant) => participant.user._id !== currentUser?._id
    );

    return otherParticipant ? otherParticipant.user : null;
  };

  // Get conversation display info
  const getConversationInfo = (conversation) => {
    if (conversation.type === "group") {
      return {
        name: conversation.name || "Group Chat",
        avatar: conversation.avatar || "👥",
        status: conversation.userLeft 
          ? "You left this group"
          : `${conversation.participants.length} members`,
        isGroup: true,
        isBroadcast: false,
        isOnline: false
      };
    } else if (conversation.type === "broadcast") {
      return {
        name: conversation.name || "Broadcast Channel",
        avatar: conversation.avatar || "📢",
        status: `${conversation.participants.length} subscribers`,
        isGroup: false,
        isBroadcast: true,
        isOnline: false
      };
    } else {
      const otherUser = getOtherUser(conversation);
      if (!otherUser) {
        return {
          name: "Unknown User",
          avatar: "👤",
          status: "Offline",
          isGroup: false,
          isBroadcast: false,
          isOnline: false
        };
      }

      const isOnline = [...onlineUsers].includes(otherUser._id);
      const blockedStatus = getBlockedStatus(conversation, currentUser);

      return {
        name: otherUser.name,
        avatar: otherUser.avatar || otherUser.name?.charAt(0).toUpperCase() || "👤",
        status: conversation.userLeft 
          ? "You left this group"
          : blockedStatus.isBlocked 
            ? (blockedStatus.blockedByCurrentUser ? "Blocked" : "Blocked you")
            : isOnline 
              ? "Online" 
              : otherUser.lastSeen 
                ? `Last seen ${formatTime(otherUser.lastSeen)}` 
                : "Offline",
        isGroup: false,
        isBroadcast: false,
        isOnline: !blockedStatus.isBlocked && isOnline,
      };
    }
  };

  // Get message sender info - but exclude system messages
  const getMessageSender = (conversation) => {
    if (!conversation.lastMessage || !conversation.lastMessage.sender) return null;
    
    // Don't return sender for system messages
    if (conversation.lastMessage.messageType === 'system') {
      return null;
    }

    if (conversation.type === "group" || conversation.type === "broadcast") {
      const senderParticipant = conversation.participants.find(
        (participant) =>
          participant.user._id === conversation.lastMessage.sender._id ||
          participant.user._id === conversation.lastMessage.sender
      );
      
      if (senderParticipant) {
        return senderParticipant.user;
      }
      
      return typeof conversation.lastMessage.sender === 'object' 
        ? conversation.lastMessage.sender 
        : null;
    }

    return typeof conversation.lastMessage.sender === 'object' 
      ? conversation.lastMessage.sender 
      : null;
  };

  // Enhanced function to get the preview text for the last message
// Enhanced function to get the preview text for the last message
const getLastMessagePreview = (conversation) => {
  if (!conversation.lastMessage) {
    return "No messages yet";
  }

  const message = conversation.lastMessage;
  
  // Handle system messages differently - don't show sender name
  if (message.messageType === 'system') {
    return message.content || "System message";
  }
  
  // Get the preview text from the helper
  const previewText = getSidebarPreviewText(message);
  
  // For group and broadcast conversations, add sender name
  if (conversation.type === "group" || conversation.type === "broadcast") {
    const messageSender = getMessageSender(conversation);
    
    if (messageSender && shouldShowMessageSender(message, conversation.type)) {
      const senderName = messageSender._id === currentUser?._id 
        ? "You" 
        : messageSender.name?.split(" ")[0] || "Someone";
      
      return `${senderName}: ${previewText}`;
    }
  }
  
  return previewText;
};

  // Filter conversations - show all when not searching
  const displayedConversations = searchQuery.trim() && searchResults.length > 0 
    ? [] 
    : conversations;

  // Sort conversations by activity (most recent first)
  const sortedConversations = [...displayedConversations].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0);
    const bTime = new Date(b.updatedAt || b.createdAt || 0);
    return bTime - aTime;
  });

  // Handle logout
  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Enhanced conversation click handler
  const handleConversationClick = (conversation) => {
    setActiveChat(conversation);
    
    if (typeof onConversationViewed === 'function') {
      onConversationViewed(conversation._id);
    }
  };

  // Handle delete conversation
  const handleDeleteConversation = (e, conversation) => {
    e.stopPropagation();
    setConversationToDelete(conversation);
    setShowDeleteModal(true);
  };

  // Handle modal confirm
  const handleDeleteConfirm = async () => {
    if (!conversationToDelete) return;
    
    try {
      await onDeleteConversation(conversationToDelete._id);
      setShowDeleteModal(false);
      setConversationToDelete(null);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      alert('Failed to delete conversation. Please try again.');
    }
  };

  // Handle modal cancel
  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setConversationToDelete(null);
  };

  // Check if user can delete conversation
  const canDeleteConversation = (conversation) => {
    if (conversation.type === 'group' || conversation.type === 'broadcast') {
      // Use the robust admin checking logic
      const adminStatus = isUserAdmin(conversation, currentUser?._id);
      return adminStatus === 'main' || adminStatus === 'admin';
    } else {
      return true;
    }
  };

  // Get total unread count across all conversations
  const totalUnreadCount = conversations.reduce((total, conv) => {
    // Don't count unread messages from blocked conversations
    const blockedStatus = getBlockedStatus(conv, currentUser);
    if (blockedStatus.isBlocked) return total;
    
    // Use the unreadCount from backend API instead of calculating
    return total + (conv.unreadCount || 0);
  }, 0);

  // Handle new chat menu
  const handleNewChatClick = () => {
    setShowNewChatMenu(!showNewChatMenu);
  };

  const handleMenuOptionClick = (mode) => {
    setShowNewChatMenu(false);
    onStartConversation(mode);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showNewChatMenu && !event.target.closest('.new-chat-menu')) {
        setShowNewChatMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNewChatMenu]);

  return (
    <>
      <div className={`w-80 flex flex-col ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border-r`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div
              className="flex items-center space-x-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors"
              onClick={() => onProfileClick(currentUser)}
            >
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-lg font-semibold">
                    {currentUser?.avatar || currentUser?.name?.charAt(0).toUpperCase() || "👤"}
                  </span>
                </div>
                {totalUnreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">
                      {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                    </span>
                  </div>
                )}
              </div>
              <div>
                <h2 className="font-semibold">{currentUser?.name || "User"}</h2>
                <p className="text-sm text-gray-500 capitalize">
                  {currentUser?.status || "Online"}
                </p>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={toggleDarkMode}
                className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${isDark ? 'text-yellow-400' : 'text-gray-600'}`}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              {/* New Chat Menu */}
              <div className="relative new-chat-menu">
                <button
                  onClick={handleNewChatClick}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                  title="Start new conversation"
                >
                  <Plus className={`w-5 h-5 transition-all ${showNewChatMenu ? 'rotate-45' : ''} group-hover:text-blue-500`} />
                </button>
                
                {/* Dropdown Menu */}
                {showNewChatMenu && (
                  <div className={`absolute right-0 top-full mt-2 w-52 rounded-lg shadow-lg border z-50 ${
                    isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
                  }`}>
                    <div className="py-2">
                      <button
                        onClick={() => handleMenuOptionClick('direct')}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center space-x-3 ${
                          isDark ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>Direct Message</span>
                      </button>
                      <button
                        onClick={() => handleMenuOptionClick('group')}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center space-x-3 ${
                          isDark ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        <span>Create Group</span>
                      </button>
                      <button
                        onClick={() => handleMenuOptionClick('broadcast')}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center space-x-3 ${
                          isDark ? 'text-white' : 'text-gray-700'
                        }`}
                      >
                        <Radio className="w-4 h-4" />
                        <span>Broadcast Channel</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Enhanced Search */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations and messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-10 pr-10 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    : "bg-gray-50 border-gray-300"
                }`}
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {(searchQuery || searchResults.length > 0) && (
                <button
                  onClick={() => setShowSearchFilters(!showSearchFilters)}
                  className={`absolute right-8 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors ${
                    showSearchFilters ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Filter className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Search Filters */}
            {showSearchFilters && (
              <div className={`p-3 rounded-lg border ${
                isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex space-x-2 text-xs">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'users', label: 'Conversations' },
                    { key: 'messages', label: 'Messages' }
                  ].map((mode) => (
                    <button
                      key={mode.key}
                      onClick={() => setSearchMode(mode.key)}
                      className={`px-2 py-1 rounded transition-colors ${
                        searchMode === mode.key
                          ? 'bg-blue-500 text-white'
                          : isDark
                          ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search History */}
            {!searchQuery && searchHistory.length > 0 && (
              <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Recent: {searchHistory.slice(0, 3).map((term, index) => (
                  <button
                    key={index}
                    onClick={() => setSearchQuery(term)}
                    className="ml-1 px-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>


        {/* Search Results or Conversations */}
        <div className="flex-1 overflow-y-auto">
          {isSearching && (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Searching...</p>
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="p-4 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No results found</p>
              <p className="text-xs mt-1">Try different keywords</p>
            </div>
          )}

          {/* Search Results */}
          {searchQuery && searchResults.length > 0 && (
            <div className="p-2">
              <div className="text-xs text-gray-500 px-2 py-1 mb-2">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </div>
              {searchResults.map((result, index) => (
                <div
                  key={`${result.type}-${index}`}
                  onClick={() => handleSearchResultClick(result)}
                  className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg mb-1 transition-colors ${
                    activeChat?._id === result.conversation._id ? 'bg-blue-50 dark:bg-gray-600' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="relative flex-shrink-0">
                      {result.type === 'user' ? (
                        <>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            result.conversation.type === 'broadcast'
                              ? 'bg-gradient-to-r from-purple-500 to-pink-600'
                              : result.conversation.type === 'group'
                              ? 'bg-gradient-to-r from-green-500 to-teal-600'
                              : 'bg-gradient-to-r from-blue-500 to-purple-600'
                          }`}>
                            <span className="text-white text-sm font-semibold">
                              {result.conversation.avatar || result.conversation.name?.charAt(0).toUpperCase() || 
                               result.user?.avatar || result.user?.name?.charAt(0).toUpperCase() || "👤"}
                            </span>
                          </div>
                          {result.isOnline && result.conversation.type === 'direct' && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                          )}
                        </>
                      ) : (
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mt-1">
                          <MessageSquare className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          result.type === 'user' 
                            ? result.conversation.type === 'broadcast'
                              ? 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                              : result.conversation.type === 'group'
                              ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                            : 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                        }`}>
                          {result.type === 'user' ? 
                            result.conversation.type === 'broadcast' ? 'Channel' :
                            result.conversation.type === 'group' ? 'Group' : 'User'
                            : 'Message'
                          }
                        </span>
                        {result.type === 'user' && result.isOnline && result.conversation.type === 'direct' && (
                          <span className="text-xs text-green-500 font-medium">Online</span>
                        )}
                      </div>
                      
                      {result.type === 'user' ? (
                        <>
                          <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate" title={result.conversation.name || result.user?.name || 'Unknown'}>
                            {(() => {
                              const name = result.conversation.name || result.user?.name || 'Unknown';
                              return name.length > 20 ? `${name.substring(0, 20)}...` : name;
                            })()}
                          </h4>
                          {result.conversation.type === 'direct' && result.user?.email && (
                            <p className="text-xs text-gray-500 truncate">
                              {result.user.email}
                            </p>
                          )}
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                            Latest: {result.preview}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate" title={result.user?.name || 'Unknown User'}>
                              {(() => {
                                const name = result.user?.name || 'Unknown User';
                                return name.length > 20 ? `${name.substring(0, 20)}...` : name;
                              })()}
                            </h4>
                            <span className="text-xs text-gray-400">in</span>
                            <span className="text-xs text-gray-500 truncate" title={getConversationInfo(result.conversation).name}>
                              {(() => {
                                const name = getConversationInfo(result.conversation).name;
                                return name.length > 20 ? `${name.substring(0, 20)}...` : name;
                              })()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mb-1">
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {formatTime(result.message.createdAt)}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-200">
                            {result.preview.split('**').map((part, i) => 
                              i % 2 === 1 ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-600 px-1 rounded">{part}</mark> : part
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Regular Conversations */}
          {!searchQuery && sortedConversations.length === 0 && (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No conversations yet</p>
              <p className="text-sm mt-1">Start a new conversation to get started!</p>
            </div>
          )}

          {!searchQuery && sortedConversations.map((conversation) => {
            const convInfo = getConversationInfo(conversation);
            const messageSender = getMessageSender(conversation);
            const unreadCount = conversation.unreadCount || 0; // Use backend unread count
            const isActive = activeChat?._id === conversation._id;
            const lastMessagePreview = getLastMessagePreview(conversation);
            const blockedStatus = getBlockedStatus(conversation, currentUser);

            return (
              <div
                key={conversation._id}
                onClick={() => handleConversationClick(conversation)}
                className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors group ${
                  isActive ? "bg-blue-50 dark:bg-gray-700 border-r-4 border-r-blue-500" : ""
                }`}
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar with blocked/online indicator */}
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      convInfo.isBroadcast
                        ? "bg-gradient-to-r from-purple-500 to-pink-600"
                        : convInfo.isGroup
                        ? "bg-gradient-to-r from-green-500 to-teal-600"
                        : "bg-gradient-to-r from-blue-500 to-purple-600"
                    }`}>
                      <span className="text-white text-lg font-semibold">
                        {convInfo.avatar}
                      </span>
                    </div>

                    {/* Show blocked indicator instead of online indicator for direct chats */}
                    {conversation.type === 'direct' && blockedStatus.isBlocked ? (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                        <UserX className="w-2.5 h-2.5 text-white" />
                      </div>
                    ) : conversation.type === 'direct' && convInfo.isOnline ? (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                    ) : null}

                    {/* Broadcast indicator */}
                    {convInfo.isBroadcast && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                        <Radio className="w-2 h-2 text-white" />
                      </div>
                    )}

                    {/* Group indicator */}
                    {convInfo.isGroup && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <Hash className="w-2 h-2 text-white" />
                      </div>
                    )}

                    {/* Hide unread count if blocked */}
                    {unreadCount > 0 && !blockedStatus.isBlocked && (
                      <div className="absolute -top-2 -right-2 min-w-5 h-5 bg-red-500 rounded-full flex items-center justify-center px-1">
                        <span className="text-white text-xs font-bold">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Conversation info with blocked status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className={`font-semibold flex items-center space-x-1 ${
                        unreadCount > 0 && !blockedStatus.isBlocked ? 'text-gray-900 dark:text-white' : ''
                      }`}>
                        <span className="text-black-800 dark:text-green-800 truncate min-w-0 flex-1" title={convInfo.name}>
                          {convInfo.name && convInfo.name.length > 20 
                            ? `${convInfo.name.substring(0, 20)}...` 
                            : convInfo.name}
                        </span>
                        {/* Show blocked icon next to name */}
                        {conversation.type === 'direct' && blockedStatus.isBlocked && (
                          <UserX className="w-3 h-3 text-red-500 flex-shrink-0" />
                        )}
                        {/* Admin crown for group/broadcast admins */}
                        {(conversation.type === "group" || conversation.type === "broadcast") && 
                          (() => {
                            const adminStatus = isUserAdmin(conversation, currentUser?._id);
                            if (adminStatus === 'main') {
                              return (
                                <Crown 
                                  className="w-3 h-3 text-yellow-500" 
                                  title="You are the main administrator" 
                                />
                              );
                            } else if (adminStatus === 'admin') {
                              return (
                                <Crown 
                                  className="w-3 h-3 text-yellow-400" 
                                  title="You are an administrator" 
                                />
                              );
                            }
                            return null;
                          })()}
                      </h3>
                      
                      <div className="flex items-center space-x-1">
                        {/* Last message timestamp */}
                        {conversation.lastMessage?.timestamp && (
                          <span className={`text-xs ${
                            unreadCount > 0 && !blockedStatus.isBlocked
                              ? 'text-blue-500 dark:text-blue-400 font-medium' 
                              : 'text-gray-500'
                          }`}>
                            {formatTime(conversation.lastMessage.timestamp)}
                          </span>
                        )}
                        
                        {/* Delete button (only for admins of groups/broadcasts or all participants for direct) */}
                        {canDeleteConversation(conversation) && (
                          <button
                            onClick={(e) => handleDeleteConversation(e, conversation)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-500 hover:text-red-700 transition-all"
                            title={`Delete ${convInfo.isBroadcast ? 'channel' : convInfo.isGroup ? 'group' : 'conversation'}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${
                        unreadCount > 0 && !blockedStatus.isBlocked
                          ? 'text-gray-700 dark:text-gray-200 font-medium' 
                          : 'text-gray-500'
                      }`}>
                        {/* Show blocked status or last message */}
                        { conversation.lastMessage ? (
                          <>
                            <span className="ml-1" title={lastMessagePreview}>
                              {lastMessagePreview}
                            </span>
                          </>
                        ) : (
                          <span className="italic">
                            {convInfo.isBroadcast ? "No announcements yet" : "No messages yet"}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Conversation status/info */}
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-400">
                        {convInfo.status}
                      </p>
                      {(convInfo.isBroadcast || convInfo.isGroup) && (() => {
                        const adminStatus = isUserAdmin(conversation, currentUser?._id);
                        if (adminStatus === 'main') {
                          return (
                            <span className="text-xs text-yellow-500 dark:text-yellow-400 font-medium flex items-center space-x-1">
                              <Crown className="w-2.5 h-2.5" />
                              <span>Main Admin</span>
                            </span>
                          );
                        } else if (adminStatus === 'admin') {
                          return (
                            <span className="text-xs text-yellow-400 dark:text-yellow-300 font-medium flex items-center space-x-1">
                              <Crown className="w-2.5 h-2.5" />
                              <span>Admin</span>
                            </span>
                          );
                        } else if (convInfo.isBroadcast) {
                          return (
                            <span className="text-xs text-purple-500 dark:text-purple-400 font-medium">
                              Read-only
                            </span>
                          );
                        }
                        return null;
                      })()}
                      {conversation.type === 'direct' && blockedStatus.isBlocked && (
                        <span className="text-xs text-red-500 font-medium flex items-center space-x-1">
                          <Shield className="w-2.5 h-2.5" />
                          <span>Blocked</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with total unread indicator */}
        {totalUnreadCount > 0 && (
          <div className={`p-3 border-t border-gray-200 dark:border-gray-700 ${
            isDark ? 'bg-gray-800' : 'bg-gray-50'
          }`}>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {totalUnreadCount} unread message{totalUnreadCount > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Delete Conversation Modal */}
      {showDeleteModal && conversationToDelete && (
        <DeleteModal
          isDark={isDark}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          type="conversation"
          conversationName={getConversationInfo(conversationToDelete).name}
          conversationType={conversationToDelete.type}
        />
      )}
    </>
  );
};

export default Sidebar;