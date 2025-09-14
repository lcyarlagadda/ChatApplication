// ===== ChatHeader.js =====
import React, { useState, useEffect } from "react";
import { formatLastSeen } from "../utils/helpers";
import ChatInfoModal from "./Modals/ChatInfoModal";

import {
  Crown,
  Users,
  Radio,
  MoreVertical,
  Settings,
  Trash2,
  Info,
  Shield,
  UserX,
  LogOut,
  AlertTriangle,
  Check,
} from "lucide-react";

const ChatHeader = ({
  isDark,
  currentUser,
  activeChat,
  onlineUsers,
  onProfileClick,
  onUpdateConversation,
  onDeleteConversation,
  onAddParticipant,
  onRemoveParticipant,
  onAddAdmin,
  onRemoveAdmin,
  onClearChat,
  onBlockUser, // This will now show confirmation and call the actual block function
  onLeaveConversation,
  onShowDeleteConfirmation,
}) => {
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [localBlockedStatus, setLocalBlockedStatus] = useState(null);

  // Close options menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showOptionsMenu && !event.target.closest('.options-menu-container')) {
        setShowOptionsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptionsMenu]);

  useEffect(() => {
    if (activeChat?.type === 'direct') {
      const newBlockedStatus = getBlockedStatus(activeChat, currentUser);
      setLocalBlockedStatus(newBlockedStatus);
    }
  }, [activeChat, currentUser?.blockedUsers, activeChat?.participants]);

  // Rest of your existing ChatHeader code...
const getBlockedStatus = (conversation, currentUser) => {
  if (conversation?.type !== "direct") {
    return { 
      isBlocked: false, 
      blockedByCurrentUser: false,
      blockedByOtherUser: false,
      otherUser: null 
    };
  }

  const otherUser = conversation.participants?.find(
    (p) => p.user._id !== currentUser?._id
  )?.user;
  
  if (!otherUser) {
    return { 
      isBlocked: false, 
      blockedByCurrentUser: false,
      blockedByOtherUser: false,
      otherUser: null 
    };
  }

  // Check if current user has blocked the other user (most reliable source)
  const currentUserBlockedOther = currentUser?.blockedUsers?.includes(otherUser._id) || 
                                  otherUser.isBlockedByCurrentUser === true;
  
  // Check if other user has blocked current user
  const otherUserBlockedCurrent = otherUser.hasBlockedCurrentUser === true;

  return {
    isBlocked: currentUserBlockedOther || otherUserBlockedCurrent,
    blockedByCurrentUser: currentUserBlockedOther,
    blockedByOtherUser: otherUserBlockedCurrent,
    otherUser: otherUser,
  };
};


  // Get other user in direct conversation
  const getOtherUser = (conversation) => {
    if (conversation?.type !== "direct") return null;

    const otherParticipant = conversation.participants?.find(
      (participant) => participant.user._id !== currentUser?._id
    );

    return otherParticipant ? otherParticipant.user : null;
  };

  // Check if current user is admin

const isCurrentUserAdmin = (conversation) => {
  if (!conversation || conversation.type === "direct") return false;

  // Check main admin - handle both string and object formats
  const mainAdminId = typeof conversation.admin === 'string' 
    ? conversation.admin 
    : conversation.admin?._id;
    
  if (mainAdminId === currentUser?._id) return true;

  // Check admins array - handle mixed formats
  if (conversation.admins && Array.isArray(conversation.admins)) {
    return conversation.admins.some((admin) => {
      const adminUserId = typeof admin === 'string' ? admin : admin?._id;
      return adminUserId === currentUser?._id;
    });
  }

  return false;
};

  // Enhanced conversation info function with blocked status integration
  const getConversationInfo = (conversation) => {
    if (!conversation) {
      return {
        name: "Unknown",
        avatar: "❓",
        status: "Unknown",
        isGroup: false,
        isBroadcast: false,
        type: "unknown",
        isOnline: false
      };
    }

    if (conversation.type === "group") {
      return {
        name: conversation.name || "Group Chat",
        avatar: conversation.avatar || "👥",
        status: `${conversation.participants?.length || 0} members`,
        isGroup: true,
        isBroadcast: false,
        type: "group",
        isOnline: false
      };
    } else if (conversation.type === "broadcast") {
      return {
        name: conversation.name || "Broadcast Channel",
        avatar: conversation.avatar || "📢",
        status: `${conversation.participants?.length || 0} subscribers`,
        isGroup: false,
        isBroadcast: true,
        type: "broadcast",
        isOnline: false
      };
    } else {
      const otherUser = getOtherUser(conversation);
      const blockedStatus = getBlockedStatus(conversation, currentUser);
      
      if (!otherUser) {
        return {
          name: "Unknown User",
          avatar: "👤",
          status: "Offline",
          isGroup: false,
          isBroadcast: false,
          type: "direct",
          isOnline: false,
          user: null
        };
      }

      // Check if user is online - handle both Set and Array
      let isOnline = false;
      if (onlineUsers && !blockedStatus.isBlocked) {
        if (onlineUsers.has && typeof onlineUsers.has === "function") {
          isOnline = onlineUsers.has(otherUser._id);
        } else if (Array.isArray(onlineUsers)) {
          isOnline = onlineUsers.includes(otherUser._id);
        } else if (onlineUsers.size !== undefined) {
          // Handle Set-like objects
          isOnline = Array.from(onlineUsers).includes(otherUser._id);
        }
      }

      // Determine status based on blocked state
      let status;
      if (blockedStatus.isBlocked) {
        if (blockedStatus.blockedByCurrentUser) {
          status = "You blocked this user";
        } else if (blockedStatus.blockedByOtherUser) {
          status = "This user blocked you";
        } else {
          status = "Blocked";
        }
      } else {
        status = isOnline
          ? "Online"
          : otherUser.lastSeen
          ? `Last seen ${formatLastSeen(otherUser.lastSeen)}`
          : "Offline";
      }

      return {
        name: otherUser.name || "Unknown User",
        avatar: otherUser.avatar || otherUser.name?.charAt(0).toUpperCase() || "👤",
        status,
        isGroup: false,
        isBroadcast: false,
        type: "direct",
        user: otherUser,
        isOnline: !blockedStatus.isBlocked && isOnline,
        blockedStatus
      };
    }
  };

  const convInfo = getConversationInfo(activeChat);
  const isAdmin = isCurrentUserAdmin(activeChat);
  const blockedStatus = getBlockedStatus(activeChat, currentUser);

  const handleHeaderClick = () => {
    if (convInfo.type === "direct" && convInfo.user) {
      onProfileClick(convInfo.user);
    } else if (convInfo.type === "group" || convInfo.type === "broadcast") {
      setShowChatInfo(true);
    }
  };

  const handleOptionsClick = (e) => {
    e.stopPropagation();
    setShowOptionsMenu(!showOptionsMenu);
  };

  // Simple block action handler - just calls the parent function
  const handleBlockAction = (userId) => {
    console.log('ChatHeader: Block action requested for user:', userId);
    setShowOptionsMenu(false);
    onBlockUser(userId); // This will now show confirmation in ChatArea
  };

  // Handle clear chat with blocked status check
  const handleClearChat = () => {
    if (!blockedStatus.blockedByOtherUser) {
      onClearChat(activeChat._id);
      setShowOptionsMenu(false);
    }
  };

  return (
    <>
      <div
        className={`p-4 border-b flex items-center justify-between ${
          isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}
      >
        <div
          className={`flex items-center space-x-3 p-2 rounded-lg transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex-1 ${
            blockedStatus.isBlocked ? 'opacity-75' : ''
          }`}
          onClick={handleHeaderClick}
        >
          <div className="relative">
            <div
              className={`w-10 h-10 ${
                convInfo.type === "broadcast"
                  ? "bg-gradient-to-r from-purple-500 to-pink-600"
                  : convInfo.type === "group"
                  ? "bg-gradient-to-r from-green-500 to-teal-600"
                  : blockedStatus.isBlocked
                  ? "bg-gradient-to-r from-red-500 to-red-600"
                  : "bg-gradient-to-r from-blue-500 to-purple-600"
              } rounded-full flex items-center justify-center text-white font-semibold relative`}
            >
              <span>{convInfo.avatar}</span>
            </div>

            {/* Online indicator for direct conversations (hidden if blocked) */}
            {convInfo.type === "direct" &&
              convInfo.isOnline &&
              !blockedStatus.isBlocked && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
              )}

            {/* Blocked indicator for direct conversations */}
            {convInfo.type === "direct" && blockedStatus.isBlocked && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                <UserX className="w-2.5 h-2.5 text-white" />
              </div>
            )}

            {/* Type indicator for groups and broadcasts */}
            {convInfo.type === "group" && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <Users className="w-2 h-2 text-white" />
              </div>
            )}

            {convInfo.type === "broadcast" && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                <Radio className="w-2 h-2 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold flex items-center space-x-1">
              <span className={`truncate ${blockedStatus.isBlocked ? 'text-gray-600 dark:text-gray-400' : ''}`}>
                {convInfo.name}
              </span>
              
              {/* Show crown for admins */}
              {(convInfo.type === "group" || convInfo.type === "broadcast") && isAdmin && (
                <Crown
                  className="w-4 h-4 text-yellow-500 flex-shrink-0"
                  title="You are an admin"
                />
              )}
              
            </h3>
            
            <p className={`text-sm truncate ${
              blockedStatus.isBlocked 
                ? 'text-red-500 dark:text-red-400' 
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              {convInfo.status}
            </p>

            {/* Additional blocked status info */}
            {convInfo.type === "direct" && blockedStatus.isBlocked && (
              <div className="flex items-center space-x-1 mt-1">
                <Shield className="w-3 h-3 text-red-500" />
                <span className="text-xs text-red-500">
                  {blockedStatus.blockedByCurrentUser && blockedStatus.blockedByOtherUser
                    ? "Mutually blocked"
                    : blockedStatus.blockedByCurrentUser
                    ? "Blocked by you"
                    : "Blocked you"
                  }
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Options menu for ALL conversation types */}
        <div className="relative options-menu-container">
          <button
            onClick={handleOptionsClick}
            className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              showOptionsMenu ? 'bg-gray-100 dark:bg-gray-700' : ''
            }`}
            title="More options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Dropdown Menu */}
          {showOptionsMenu && (
            <div
              className={`absolute right-0 top-full mt-2 w-52 rounded-lg shadow-xl border z-50 ${
                isDark
                  ? "bg-gray-700 border-gray-600"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="py-2">
                {/* Direct Conversation Options */}
                {convInfo.type === "direct" && (
                  <>
                    {/* Block/Unblock Options */}
                    {(() => {
                      if (blockedStatus.blockedByCurrentUser) {
                        return (
                          <button
                            onClick={() => handleBlockAction(blockedStatus.otherUser._id)}
                            className="w-full px-4 py-2 text-left transition-colors flex items-center space-x-3 hover:bg-green-100 dark:hover:bg-green-900 text-green-600 dark:text-green-400"
                          >
                            <Check className="w-4 h-4" />
                            <span>Unblock User</span>
                          </button>
                        );
                      } else if (blockedStatus.blockedByOtherUser) {
                        return (
                          <div className="px-4 py-2 flex items-center space-x-3 text-red-500 opacity-75 cursor-not-allowed">
                            <AlertTriangle className="w-4 h-4" />
                            <span>You are blocked</span>
                          </div>
                        );
                      } else {
                        return (
                          <button
                            onClick={() => handleBlockAction(blockedStatus.otherUser._id)}
                            className="w-full px-4 py-2 text-left transition-colors flex items-center space-x-3 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
                          >
                            <UserX className="w-4 h-4" />
                            <span>Block User</span>
                          </button>
                        );
                      }
                    })()}

                    {/* Separator */}
                    <div className="my-1 border-t border-gray-200 dark:border-gray-600"></div>

                    {/* Clear Chat Option - disabled if blocked by other user */}
                    <button
                      onClick={handleClearChat}
                      disabled={blockedStatus.blockedByOtherUser}
                      className={`w-full px-4 py-2 text-left transition-colors flex items-center space-x-3 ${
                        blockedStatus.blockedByOtherUser
                          ? "opacity-50 cursor-not-allowed text-gray-400"
                          : "hover:bg-yellow-100 dark:hover:bg-yellow-900 text-yellow-600 dark:text-yellow-400"
                      }`}
                      title={blockedStatus.blockedByOtherUser ? "Cannot clear chat - you are blocked" : "Clear chat history for you"}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear Chat</span>
                    </button>

                    {/* Delete Conversation */}
                    <button
                      onClick={() => {
                        onShowDeleteConfirmation();
                        setShowOptionsMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center space-x-3 text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Chat</span>
                    </button>
                  </>
                )}

                {/* Group/Broadcast Options */}
                {(convInfo.type === "group" || convInfo.type === "broadcast") && (
                  <>
                    <button
                      onClick={() => {
                        setShowChatInfo(true);
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center space-x-3 ${
                        isDark ? "text-white" : "text-gray-700"
                      }`}
                    >
                      <Info className="w-4 h-4" />
                      <span>
                        {convInfo.type === "broadcast" ? "Channel Info" : "Group Info"}
                      </span>
                    </button>

                    <button
                      onClick={() => {
                        onClearChat(activeChat._id);
                        setShowOptionsMenu(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-yellow-100 dark:hover:bg-yellow-900 transition-colors flex items-center space-x-3 text-yellow-600 dark:text-yellow-400"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear Chat</span>
                    </button>

                    {/* Leave option - hide for admins if they're the only participant */}
                    {(!isAdmin || (isAdmin && activeChat.participants?.length > 1)) && (
                      <button
                        onClick={() => {
                          onLeaveConversation(activeChat._id);
                          setShowOptionsMenu(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors flex items-center space-x-3 text-orange-600 dark:text-orange-400"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>
                          Leave {convInfo.type === "broadcast" ? "Channel" : "Group"}
                        </span>
                      </button>
                    )}

                    {/* Admin-only options */}
                    {isAdmin && (
                      <>
                        <div className="my-1 border-t border-gray-200 dark:border-gray-600"></div>
                        
                        <button
                          onClick={() => {
                            setShowChatInfo(true);
                            setShowOptionsMenu(false);
                          }}
                          className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center space-x-3 ${
                            isDark ? "text-white" : "text-gray-700"
                          }`}
                        >
                          <Settings className="w-4 h-4" />
                          <span>
                            Manage {convInfo.type === "broadcast" ? "Channel" : "Group"}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            onShowDeleteConfirmation();
                            setShowOptionsMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center space-x-3 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>
                            Delete {convInfo.type === "broadcast" ? "Channel" : "Group"}
                          </span>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Info Modal */}
      {showChatInfo && (convInfo.type === "group" || convInfo.type === "broadcast") && (
        <ChatInfoModal
          conversation={activeChat}
          currentUser={currentUser}
          isAdmin={isAdmin}
          isDark={isDark}
          onClose={() => setShowChatInfo(false)}
          onUpdateConversation={onUpdateConversation}
          onDeleteConversation={onDeleteConversation}
          onAddParticipant={onAddParticipant}
          onRemoveParticipant={onRemoveParticipant}
          onAddAdmin={onAddAdmin}
          onRemoveAdmin={onRemoveAdmin}
        />
      )}

      {/* Click outside to close menu overlay */}
      {showOptionsMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowOptionsMenu(false)}
        />
      )}
    </>
  );
};

export default ChatHeader;

