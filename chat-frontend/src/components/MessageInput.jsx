import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  Paperclip,
  Smile,
  Reply,
  X,
  Image as ImageIcon,
  Lock,
  Shield,
} from "lucide-react";
import { isFileMessage, getReplyPreviewText } from "../utils/fileHelpers";
import EmojiPicker from "./Pickers/EmojiPicker";
import GifPicker from "./Pickers/GifPicker";

const MessageInput = ({
  isDark,
  currentUser,
  activeChat,
  onSendMessage,
  replyingTo,
  setReplyingTo,
  onTypingStart,
  onTypingStop,
  onBlockUser,
}) => {
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [sending, setSending] = useState(false);

  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingTime = useRef(0);

  // Check if user can send messages in this conversation
  const canSendMessage = () => {
    if (!activeChat || !currentUser) return false;

    // Check if user has left this conversation
    if (activeChat.userLeft) return false;

    // For direct messages and groups, all participants can send
    if (activeChat.type === "direct" || activeChat.type === "group") {
      return true;
    }

    // For broadcast channels, only admins can send
    if (activeChat.type === "broadcast") {
      // Check main admin - handle both string and object formats
      const mainAdminId = typeof activeChat.admin === 'string' 
        ? activeChat.admin 
        : activeChat.admin?._id;
        
      if (mainAdminId === currentUser._id) return true;

      // Check admins array - handle mixed formats
      if (activeChat.admins && Array.isArray(activeChat.admins)) {
        return activeChat.admins.some((admin) => {
          const adminUserId = typeof admin === 'string' ? admin : admin?._id;
          return adminUserId === currentUser._id;
        });
      }
      return false;
    }

    return true;
  };

  // Send message
  const sendMessage = async () => {
    if (!message.trim() || !activeChat || sending || !canSendMessage()) return;

    setSending(true);
    try {
      let replyId = null;
      if (replyingTo) {
        replyId = replyingTo._id;
      }
      await onSendMessage(message.trim(), null, replyId);

      setMessage("");
      setReplyingTo(null);

      // Stop typing indicator when message is sent
      if (isTyping) {
        setIsTyping(false);
        onTypingStop?.(activeChat._id);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  // Send GIF message - treat as file upload
  const sendGifMessage = async (gif) => {
    if (!activeChat || sending || !canSendMessage()) return;

    setSending(true);
    try {
      // Fetch the GIF as a blob and create a file object
      const response = await fetch(gif.url);
      const blob = await response.blob();

      // Create a File object from the blob with proper .gif extension
      const fileName = gif.title
        ? `${gif.title.replace(/[^a-zA-Z0-9]/g, "_")}.gif`
        : "animated-gif.gif";
      const file = new File([blob], fileName, {
        type: "image/gif",
      });

      // Use the existing file upload mechanism
      await onSendMessage(null, file);
      setReplyingTo(null);
      setShowGifPicker(false);

      // Stop typing indicator when GIF is sent
      if (isTyping) {
        setIsTyping(false);
        onTypingStop?.(activeChat._id);
      }
    } catch (error) {
      console.error("Failed to send GIF message:", error);
    } finally {
      setSending(false);
    }
  };

  // Handle typing with Socket.IO integration
  const handleTyping = (value) => {
    setMessage(value);

    // Don't show typing in broadcast if user can't send
    if (!canSendMessage()) return;

    const now = Date.now();
    const timeSinceLastTyping = now - lastTypingTime.current;

    // Only emit typing start if enough time has passed and we're not already typing
    if (value.trim() && !isTyping && timeSinceLastTyping > 1000) {
      setIsTyping(true);
      onTypingStart?.(activeChat._id);
      lastTypingTime.current = now;
    }

    // Clear existing timeout
    clearTimeout(typingTimeoutRef.current);

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        onTypingStop?.(activeChat._id);
      }
    }, 2000); // Stop typing after 2 seconds of inactivity

    // If message is empty, immediately stop typing
    if (!value.trim() && isTyping) {
      setIsTyping(false);
      onTypingStop?.(activeChat._id);
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji) => {
    if (!canSendMessage()) return;

    const newMessage = message + emoji;
    setMessage(newMessage);
    setShowEmojiPicker(false);

    // Trigger typing if not already typing
    handleTyping(newMessage);
  };

  // Handle GIF selection - updated
  const handleGifSelect = (gif) => {
    if (!canSendMessage()) return;

    sendGifMessage(gif);
    setShowGifPicker(false);
  };

  // File upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeChat || sending || !canSendMessage()) return;

    setSending(true);
    try {
      await onSendMessage(null, file);
      setReplyingTo(null);

      // Stop typing indicator when file is sent
      if (isTyping) {
        setIsTyping(false);
        onTypingStop?.(activeChat._id);
      }
    } catch (error) {
      console.error("Failed to send file:", error);
    } finally {
      setSending(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Close other pickers when one opens
  const handleEmojiToggle = () => {
    if (!canSendMessage()) return;
    setShowEmojiPicker(!showEmojiPicker);
    setShowGifPicker(false);
  };

  const handleGifToggle = () => {
    if (!canSendMessage()) return;
    setShowGifPicker(!showGifPicker);
    setShowEmojiPicker(false);
  };

  // Auto-resize textarea
  const autoResizeTextarea = (textarea) => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  // Handle focus events for typing indicators
  const handleFocus = () => {
    if (message.trim() && canSendMessage()) {
      handleTyping(message);
    }
  };

  const handleBlur = () => {
    // Stop typing when input loses focus
    if (isTyping) {
      setIsTyping(false);
      onTypingStop?.(activeChat._id);
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Cleanup on unmount or activeChat change
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        onTypingStop?.(activeChat?._id);
      }
    };
  }, [activeChat]);

  // Stop typing when component unmounts
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

const blockingStatus = useMemo(() => {

  if (!activeChat || !currentUser) return { isBlocked: false, reason: null };

  // For direct conversations, check if either user has blocked the other
  if (activeChat.type === "direct") {
    const otherParticipant = activeChat.participants.find(
      (p) => p.user._id !== currentUser._id
    );

    if (otherParticipant) {
      // Check if current user has blocked the other user
      const currentUserBlockedOther = currentUser.blockedUsers?.includes(otherParticipant.user._id) ||
                                     otherParticipant.user.isBlockedByCurrentUser === true;

      // Check if the other user has blocked current user
      const otherUserBlockedCurrent = otherParticipant.user.hasBlockedCurrentUser === true;

      console.log("Blocking check:", {
        currentUserBlockedOther,
        otherUserBlockedCurrent,
        otherUserId: otherParticipant.user._id,
        blockedUsersList: currentUser.blockedUsers
      });

      if (currentUserBlockedOther) {
        return {
          isBlocked: true,
          reason: `You have blocked ${otherParticipant.user.name}`,
          type: "you_blocked_them",
          otherUserId: otherParticipant.user._id,
          otherUserName: otherParticipant.user.name,
        };
      }

      if (otherUserBlockedCurrent) {
        return {
          isBlocked: true,
          reason: `${otherParticipant.user.name} has blocked you`,
          type: "they_blocked_you",
          otherUserId: otherParticipant.user._id,
          otherUserName: otherParticipant.user.name,
        };
      }
    }
  }

  // For broadcast channels, check if user has admin permissions
  if (activeChat.type === "broadcast") {
    console.log("ChatInfo", activeChat.admin, currentUser._id);
    
    // Check main admin - handle both string and object formats
    const mainAdminId = typeof activeChat.admin === 'string' 
      ? activeChat.admin 
      : activeChat.admin?._id;
    
    const isMainAdmin = mainAdminId === currentUser._id;
    
    // Check admins array - handle mixed formats
    const isAdditionalAdmin = activeChat.admins && Array.isArray(activeChat.admins) &&
      activeChat.admins.some((admin) => {
        const adminUserId = typeof admin === 'string' ? admin : admin?._id;
        return adminUserId === currentUser._id;
      });
    
    const isAdmin = isMainAdmin || isAdditionalAdmin;

    if (!isAdmin) {
      return {
        isBlocked: true,
        reason: "Only administrators can send messages in broadcast channels",
        type: "no_broadcast_permission",
      };
    }
  }

  return { isBlocked: false, reason: null };
}, [
  activeChat?._id,
  activeChat?.type,
  activeChat?.participants,
  activeChat?.admin?._id,
  activeChat?.admins,
  currentUser?._id,
  currentUser?.blockedUsers,
  // Add this to force recalculation when participants change
  activeChat?.participants?.map(p => `${p.user._id}-${p.user.isBlockedByCurrentUser}-${p.user.hasBlockedCurrentUser}`).join(',')
]);

  const handleUnblockUser = async (userId) => {
    try {
      console.log("🔄 Attempting to unblock user:", userId);

      if (onBlockUser) {
        await onBlockUser(userId);

        // Force a small delay to ensure state updates have propagated
        setTimeout(() => {
          console.log(
            "✅ Unblock completed, current user blocked list:",
            currentUser?.blockedUsers
          );
        }, 100);
      }
    } catch (error) {
      console.error("❌ Failed to unblock user:", error);
    }
  };

  // // Add debugging useEffect to track blocking status changes
  // useEffect(() => {
  //   console.log("🎯 Blocking status changed:", blockingStatus);
  // }, [blockingStatus]);

  // If user cannot send messages (broadcast channel non-admin)
  if (!canSendMessage()) {
    return (
      <div
        className={`p-4 border-t ${
          isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}
      >
        <div
          className={`flex items-center justify-center space-x-3 p-4 rounded-lg ${
            isDark ? "bg-gray-700" : "bg-gray-100"
          }`}
        >
          <Lock className="w-5 h-5 text-gray-500" />
          <span className="text-gray-500 text-sm">
            {activeChat?.userLeft 
              ? "You have left this conversation"
              : `Only administrators can send messages in this ${
                  activeChat?.type === "broadcast" ? "channel" : "conversation"
                }`
            }
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {replyingTo && (
        <div
          className={`px-4 py-2 border-t ${
            isDark
              ? "bg-gray-800 border-gray-700"
              : "bg-gray-50 border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Reply className="w-4 h-4 text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">
                  Replying to {replyingTo.sender?.name || "message"}
                </p>
                <p className="text-sm truncate">
                  {/* Use helper function for proper file display */}
                  {isFileMessage(replyingTo)
                    ? getReplyPreviewText(replyingTo, 30)
                    : replyingTo.content || "Message"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              title="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Show blocking message if applicable - key prop forces re-render */}
      {blockingStatus.isBlocked && (
        <div
          key={`blocking-${blockingStatus.type}-${
            blockingStatus.otherUserId || "general"
          }`}
          className={`px-4 py-3 border-t ${
            isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          }`}
        >
          <div
            className={`p-3 rounded-lg text-center text-sm ${
              blockingStatus.type === "you_blocked_them"
                ? isDark
                  ? "bg-orange-900/50 text-orange-200 border border-orange-800"
                  : "bg-orange-50 text-orange-700 border border-orange-200"
                : blockingStatus.type === "they_blocked_you"
                ? isDark
                  ? "bg-red-900/50 text-red-200 border border-red-800"
                  : "bg-red-50 text-red-700 border border-red-200"
                : isDark
                ? "bg-gray-700 text-gray-300 border border-gray-600"
                : "bg-gray-50 text-gray-600 border border-gray-200"
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              {blockingStatus.type === "you_blocked_them" && (
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
              )}
              {blockingStatus.type === "they_blocked_you" && (
                <div className="w-4 h-4 rounded-full bg-red-500"></div>
              )}
              {blockingStatus.type === "no_broadcast_permission" && (
                <div className="w-4 h-4 rounded-full bg-gray-500"></div>
              )}
              <span>{blockingStatus.reason}</span>
            </div>

            {/* Show unblock option if current user blocked the other */}
            {blockingStatus.type === "you_blocked_them" && onBlockUser && (
              <button
                onClick={() => handleUnblockUser(blockingStatus.otherUserId)}
                disabled={sending}
                className={`mt-2 px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50 ${
                  isDark
                    ? "bg-orange-600 hover:bg-orange-700 text-white"
                    : "bg-orange-600 hover:bg-orange-700 text-white"
                }`}
              >
                {sending
                  ? "Unblocking..."
                  : `Unblock ${blockingStatus.otherUserName || "User"}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Message Input - key prop forces re-render when blocking status changes */}
      <div
        key={`input-${blockingStatus.isBlocked}-${
          blockingStatus.type || "none"
        }`}
        className={`p-4 border-t relative ${
          isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-end space-x-3">
          {/* File upload */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,.gif,.pdf,.doc,.docx,.txt,.zip,.rar"
            disabled={sending || blockingStatus.isBlocked}
          />
          <button
            onClick={() =>
              !blockingStatus.isBlocked && fileInputRef.current?.click()
            }
            disabled={sending || blockingStatus.isBlocked}
            className={`p-2 rounded-lg transition-colors ${
              sending || blockingStatus.isBlocked
                ? "opacity-50 cursor-not-allowed text-gray-400"
                : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            }`}
            title={
              blockingStatus.isBlocked ? blockingStatus.reason : "Attach file"
            }
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Emoji Picker */}
          <div className="relative">
            <button
              onClick={() => !blockingStatus.isBlocked && handleEmojiToggle()}
              disabled={sending || blockingStatus.isBlocked}
              className={`p-2 rounded-lg transition-colors ${
                sending || blockingStatus.isBlocked
                  ? "opacity-50 cursor-not-allowed text-gray-400"
                  : `hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 ${
                      showEmojiPicker ? "bg-gray-100 dark:bg-gray-700" : ""
                    }`
              }`}
              title={
                blockingStatus.isBlocked ? blockingStatus.reason : "Add emoji"
              }
            >
              <Smile className="w-5 h-5" />
            </button>

            {showEmojiPicker && !blockingStatus.isBlocked && (
              <EmojiPicker
                isDark={isDark}
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>

          {/* GIF Picker */}
          <div className="relative">
            <button
              onClick={() => !blockingStatus.isBlocked && handleGifToggle()}
              disabled={sending || blockingStatus.isBlocked}
              className={`p-2 rounded-lg transition-colors ${
                sending || blockingStatus.isBlocked
                  ? "opacity-50 cursor-not-allowed text-gray-400"
                  : `hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 ${
                      showGifPicker ? "bg-gray-100 dark:bg-gray-700" : ""
                    }`
              }`}
              title={
                blockingStatus.isBlocked ? blockingStatus.reason : "Send GIF"
              }
            >
              <ImageIcon className="w-5 h-5" />
            </button>

            {showGifPicker && !blockingStatus.isBlocked && (
              <GifPicker
                isDark={isDark}
                onGifSelect={handleGifSelect}
                onClose={() => setShowGifPicker(false)}
              />
            )}
          </div>

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              key={`textarea-${blockingStatus.isBlocked}`} // Force re-render
              value={blockingStatus.isBlocked ? "" : message}
              onChange={(e) => {
                if (!blockingStatus.isBlocked) {
                  handleTyping(e.target.value);
                  autoResizeTextarea(e.target);
                }
              }}
              onKeyPress={(e) => {
                if (!blockingStatus.isBlocked) {
                  handleKeyPress(e);
                }
              }}
              onFocus={!blockingStatus.isBlocked ? handleFocus : undefined}
              onBlur={!blockingStatus.isBlocked ? handleBlur : undefined}
              placeholder={
                blockingStatus.isBlocked
                  ? blockingStatus.reason
                  : sending
                  ? "Sending..."
                  : activeChat?.type === "broadcast"
                  ? "Broadcast a message..."
                  : "Type a message..."
              }
              disabled={sending || blockingStatus.isBlocked}
              rows={1}
              className={`w-full px-4 py-3 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all ${
                sending || blockingStatus.isBlocked
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              } ${
                isDark
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-gray-50 border-gray-300 placeholder-gray-500"
              }`}
              style={{
                minHeight: "48px",
                maxHeight: "120px",
              }}
            />

            {/* Typing indicator - only show if not blocked */}
            {isTyping && !blockingStatus.isBlocked && (
              <div className="absolute -top-6 left-0 text-xs text-blue-500 animate-pulse">
                You are typing...
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={() => !blockingStatus.isBlocked && sendMessage()}
            disabled={!message.trim() || sending || blockingStatus.isBlocked}
            className={`p-3 rounded-lg font-semibold transition-all transform ${
              blockingStatus.isBlocked
                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                : activeChat?.type === "broadcast"
                ? "bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white"
                : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white"
            } ${
              !message.trim() || sending || blockingStatus.isBlocked
                ? "opacity-50 cursor-not-allowed"
                : "hover:scale-105"
            }`}
            title={
              blockingStatus.isBlocked
                ? blockingStatus.reason
                : sending
                ? "Sending..."
                : "Send message"
            }
          >
            <Send className={`w-5 h-5 ${sending ? "animate-pulse" : ""}`} />
          </button>
        </div>

        {/* Character limit indicator (optional) - only show if not blocked */}
        {message.length > 950 && !blockingStatus.isBlocked && (
          <div className="mt-2 text-xs text-right">
            <span
              className={
                message.length > 1000 ? "text-red-500" : "text-yellow-500"
              }
            >
              {message.length}/1000
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export default MessageInput;
