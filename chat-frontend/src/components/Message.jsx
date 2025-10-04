import { useEffect, useState } from "react";
import { Reply, Smile, Forward, Trash2, Edit3, Clock } from 'lucide-react';
import ReactionPicker from "./Pickers/ReactionPicker";
import DeleteModal from "./Modals/DeleteModal";
import FileThumbnail from "./Thumbnail";
import { formatTime } from '../utils/helpers';
import { getStatusIcon } from "./StatusIcon";
import { 
  formatMessageForForwarding, 
  isFileMessage, 
  getFileDisplayName,
  getReplyPreviewText 
} from '../utils/fileHelpers';
import { formatDistanceToNow } from 'date-fns';

// System Message Component
const SystemMessage = ({ message, isDark }) => {
  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };

  return (
    <div className="flex justify-center my-4">
      <div 
        className={`
          max-w-md px-4 py-2 rounded-full text-sm flex items-center space-x-2 shadow-sm
          ${isDark 
            ? 'bg-gray-700/50 text-gray-300 border border-gray-600/50' 
            : 'bg-gray-100 text-gray-600 border border-gray-200'
          }
        `}
      >
        <span className="font-medium text-center flex-1">
          {message.content}
        </span>
      </div>
    </div>
  );
};

// Regular Message Component
const RegularMessage = ({
  message,
  isOwn: isOwnProp,
  currentUser,
  activeChat,
  messages,
  isDark,
  onImageClick,
  onForward,
  onDeleteMessage,
  onEditMessage,
  onReply,
  onReactToMessage,
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content || "");
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const getUserId = (user) => {
    if (typeof user === 'string') return user;
    return user?._id || user?.id;
  };

  const calculateOwnership = () => {
    const messageSenderId = getUserId(message.sender);
    const currentUserId = getUserId(currentUser);
    return messageSenderId === currentUserId;
  };

  const isOwn = calculateOwnership();

  useEffect(() => {
    if (isOwn !== isOwnProp) {
      console.warn('⚠️ Ownership mismatch detected:', {
        messageId: message._id,
        calculated: isOwn,
        fromProp: isOwnProp,
        messageSender: message.sender?.name,
        currentUser: currentUser?.name
      });
    }
  }, [isOwn, isOwnProp, message._id]);

  const getRepliedMessage = (messageId) => {
    if (!activeChat || !messageId || !messages) return null;
    return messages.find((msg) => msg._id === messageId);
  };

  const handleReactionSelect = async (emoji) => {
    try {
      const currentUserId = getUserId(currentUser);
      
      // Check if user already has a reaction on this message
      const existingReaction = message.reactions?.find(reaction => 
        getUserId(reaction.user) === currentUserId
      );
      
      // If user already reacted with the same emoji, remove it (toggle off)
      if (existingReaction && (existingReaction.emoji || existingReaction.type) === emoji) {
        await onReactToMessage(message._id, null); // Send null to remove reaction
      } else {
        // Otherwise, add/change the reaction (this will replace any existing reaction)
        await onReactToMessage(message._id, emoji);
      }
      
      setShowReactionPicker(false);
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim() || editContent === message.content) {
      setIsEditing(false);
      setEditContent(message.content || "");
      return;
    }

    try {
      await onEditMessage(message._id, editContent.trim());
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to edit message:", error);
      setEditContent(message.content || "");
      setIsEditing(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await onDeleteMessage(message._id);
      setShowDeleteModal(false);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsEditing(false);
      setEditContent(message.content || "");
    }
  };

  // Handle forward button click - format message properly
  const handleForwardClick = () => {
    const formattedMessage = formatMessageForForwarding(message);
    onForward(formattedMessage);
  };

  const repliedMsg = getRepliedMessage(message.replyTo);
  const sender = message.sender;

  const groupedReactions = message.reactions
    ? (() => {
        const reactionMap = {};
        message.reactions.forEach((reaction) => {
          const emoji = reaction.emoji || reaction.type;
          const userId = getUserId(reaction.user);
          const userName = reaction.user?.name || "Unknown";

          if (!reactionMap[emoji]) {
            reactionMap[emoji] = { users: [], userNames: [] };
          }

          if (!reactionMap[emoji].users.includes(userId)) {
            reactionMap[emoji].users.push(userId);
            reactionMap[emoji].userNames.push(userName);
          }
        });

        return Object.entries(reactionMap).filter(
          ([emoji, data]) => data.users.length > 0
        );
      })()
    : [];

  const getMessagePreview = () => {
    if (isFileMessage(message)) {
      return getFileDisplayName(message);
    }
    return message.content || "No content";
  };

  const hasFileContent = isFileMessage(message);

  return (
    <>
      <div className={`flex ${isOwn ? "justify-end" : "justify-start"} group mb-4`}>
        <div className={`max-w-xs lg:max-w-md ${isOwn ? "order-2" : "order-1"}`}>
          {activeChat.type === "group" && !isOwn && sender && (
            <p className="text-xs text-gray-500 mb-1 ml-3">
              {sender.name || "Unknown User"}
            </p>
          )}

          <div className={`px-4 py-2 rounded-2xl relative ${
            isOwn
              ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
              : isDark
              ? "bg-gray-700 text-white"
              : "bg-gray-200 text-gray-900"
          }`}>
            {/* Reply section - show proper file names in replies */}
            {(repliedMsg || message.replyTo) && (
              <div className={`mb-2 p-2 rounded-lg border-l-4 cursor-pointer transition-colors hover:bg-opacity-80 ${
                isOwn
                  ? "bg-blue-600 border-blue-300"
                  : "bg-gray-300 dark:bg-gray-600 border-gray-400"
              }`}>
                <div className="flex items-start space-x-2">
                  <Reply className="w-3 h-3 mt-0.5 opacity-75" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs opacity-75 font-medium">
                      Replying to {repliedMsg?.sender?.name || message.replyTo?.sender?.name || "Someone"}
                    </p>
                    <p className="text-sm opacity-90 truncate">
                      {repliedMsg 
                        ? getReplyPreviewText(repliedMsg, 40)
                        : message.replyTo?.content 
                          ? getReplyPreviewText(message.replyTo, 40)
                          : getReplyPreviewText({
                              content: message.replyTo?.content,
                              messageType: message.replyTo?.messageType,
                              fileInfo: message.replyTo?.fileInfo
                            }, 40) || "Message"
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* File Content - Use enhanced FileThumbnail component */}
            {hasFileContent && (
              <FileThumbnail 
                message={message} 
                onImageClick={onImageClick} 
                isDark={isDark}
                showFileName={true}
              />
            )}

            {/* Text Content - only show if it's a text message or has additional text */}
            {(message.messageType === "text" || 
              (hasFileContent && message.content && 
               message.content !== (message.fileInfo?.url || message.file?.url))) && (
              isEditing ? (
                <div className="mb-2 relative">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={`w-full p-1 rounded border-none focus:outline-none resize-none transition-all ${
                      isDark
                        ? "bg-gray-600 bg-opacity-30 text-white placeholder-gray-400 focus:bg-opacity-50"
                        : "bg-gray-100 bg-opacity-50 text-gray-900 placeholder-gray-500 focus:bg-opacity-80"
                    } focus:ring-1 focus:ring-blue-300 focus:ring-opacity-30`}
                    rows={Math.min(editContent.split("\n").length + 1, 5)}
                    autoFocus
                    placeholder="Edit your message..."
                    style={{ minHeight: "1.2rem", fontSize: "inherit", lineHeight: "inherit" }}
                  />
                  <div className="text-xs opacity-60 mt-1 italic">
                    Press Enter to save • Esc to cancel
                  </div>
                </div>
              ) : (
                message.messageType === "text" && (
                  <div className="break-words whitespace-pre-wrap">
                    {message.content || "No content"}
                    {(message.isEdited || message.editedAt) && (
                      <span className="text-xs opacity-75 ml-2">
                        (edited{message.editedAt ? ` ${formatTime(message.editedAt)}` : ""})
                      </span>
                    )}
                  </div>
                )
              )
            )}

            <div className={`flex items-center justify-between mt-1 text-xs ${isOwn ? "text-blue-100" : "text-gray-500"}`}>
              <span>{formatTime(message.createdAt || message.timestamp)}</span>
              <div className="flex items-center gap-1">
                {isOwn && message.status && <div className="ml-2">{getStatusIcon(message.status)}</div>}
                {message.isOffline && (
                  <span className="text-orange-400" title="Message sent while offline">
                    <Clock size={12} />
                  </span>
                )}
              </div>
            </div>

            {showReactionPicker && (
              <ReactionPicker
                isDark={isDark}
                onReactionSelect={handleReactionSelect}
                onClose={() => setShowReactionPicker(false)}
                position={isOwn ? "top" : "bottom"}
                isOwn={isOwn}
              />
            )}
          </div>

          {groupedReactions.length > 0 && (
            <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
              {groupedReactions.map(([emoji, data]) => {
                const hasUserReacted = data.users.includes(getUserId(currentUser));
                return (
                  <div
                    key={emoji}
                    onClick={() => handleReactionSelect(emoji)}
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs cursor-pointer transition-all hover:scale-105 ${
                      hasUserReacted
                        ? isDark
                          ? "bg-blue-600 hover:bg-blue-500 text-white"
                          : "bg-blue-100 hover:bg-blue-200 text-blue-800"
                        : isDark
                        ? "bg-gray-600 hover:bg-gray-500"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                    title={`${data.userNames.join(", ")} ${data.users.length > 1 ? "reacted" : "reacted"} with ${emoji}`}
                  >
                    <span className="mr-1">{emoji}</span>
                    <span>{data.users.length}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className={`flex items-center space-x-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? "justify-end" : "justify-start"}`}>
            <button onClick={() => onReply(message)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Reply">
              <Reply className="w-3 h-3" />
            </button>
            <button onClick={() => setShowReactionPicker(!showReactionPicker)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Add Reaction">
              <Smile className="w-3 h-3" />
            </button>
            <button onClick={handleForwardClick} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Forward">
              <Forward className="w-3 h-3" />
            </button>
            {isOwn && (
              <>
                {message.messageType === "text" && new Date() - new Date(message.createdAt) < 15 * 60 * 1000 && (
                  <button onClick={() => setIsEditing(true)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="Edit">
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
                <button onClick={handleDeleteClick} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-red-500 transition-colors" title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <DeleteModal
          isDark={isDark}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          messagePreview={getMessagePreview()}
        />
      )}
    </>
  );
};

// Main Message Component that decides which type to render
const Message = (props) => {
  // Check if this is a system message
  if (props.message.messageType === 'system') {
    return <SystemMessage message={props.message} isDark={props.isDark} />;
  }

  // Otherwise render as a regular message
  return <RegularMessage {...props} />;
};

export default Message;