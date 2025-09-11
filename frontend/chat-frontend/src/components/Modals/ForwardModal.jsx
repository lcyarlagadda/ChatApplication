import React, { useState } from "react";
import { X, Send, Search, Check } from "lucide-react";
import { getFileDisplayName, isFileMessage } from "../../utils/fileHelpers";

const ForwardModal = ({
  message,
  conversations,
  activeChat,
  isDark,
  currentUser,
  onForward,
  onClose,
}) => {
  const [selectedConversations, setSelectedConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Get other user in direct conversation
  const getOtherUser = (conversation) => {
    // Only for direct conversations (not groups or broadcasts)
    if (conversation.type === "group" || conversation.type === "broadcast") return null;
    const otherParticipant = conversation.participants.find(
      (participant) => participant.user._id !== currentUser?._id
    );
    return otherParticipant ? otherParticipant.user : null;
  };

  // Get conversation display name
  const getConversationName = (conversation) => {
    if (conversation.type === "group" || conversation.type === "broadcast") {
      return conversation.name || (conversation.type === "broadcast" ? "Broadcast" : "Group Chat");
    } else {
      const otherUser = getOtherUser(conversation);
      return otherUser?.name || "Unknown User";
    }
  };

  // Filter conversations (exclude current chat)
  const availableConversations = conversations.filter(
    (conv) =>
      conv._id !== activeChat?._id &&
      (searchQuery === "" ||
        getConversationName(conv)
          .toLowerCase()
          .includes(searchQuery.toLowerCase()))
  );

  // Toggle conversation selection
  const toggleConversation = (conversation) => {
    setSelectedConversations((prev) => {
      const isSelected = prev.some((c) => c._id === conversation._id);
      if (isSelected) {
        return prev.filter((c) => c._id !== conversation._id);
      } else {
        return [...prev, conversation];
      }
    });
  };

  // Handle forward - Updated to support multiple conversations properly
  const handleForward = async () => {
    if (selectedConversations.length === 0) return;

    setLoading(true);
    try {
      // Forward to all selected conversations at once
      await onForward(selectedConversations, message);
      onClose();
    } catch (error) {
      console.error("Forward failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get message preview for display - Fixed to show proper file names
  const getMessagePreview = () => {
    if (isFileMessage(message)) {
      const displayName = getFileDisplayName(message);
      return message.displayText || displayName;
    }
    return message.content || message.displayText || "Message";
  };

  // Get file type indicator for the preview
  const getFileTypeIndicator = () => {
    if (!isFileMessage(message)) return null;

    const messageType = message.messageType || message.originalMessage?.messageType;
    const fileInfo = message.fileInfo || message.originalMessage?.fileInfo;
    const fileName = getFileDisplayName(message.originalMessage || message);
    
    // Determine if it's a GIF
    const isGif = fileName.toLowerCase().endsWith('.gif') || 
                  fileInfo?.type === 'image/gif' ||
                  fileInfo?.originalName?.toLowerCase().endsWith('.gif');

    switch (messageType) {
      case 'image':
        return isGif ? '🎞️ GIF' : '🖼️ Image';
      case 'video':
        return '🎥 Video';
      case 'audio':
        return '🎵 Audio';
      case 'pdf':
        return '📄 PDF';
      case 'document':
        return '📝 Document';
      case 'xlsx':
        return '📊 Spreadsheet';
      default:
        return '📎 File';
    }
  };

  // Get conversation avatar/icon
  const getConversationAvatar = (conversation) => {
    if (conversation.type === "group") {
      return conversation.avatar || "👥";
    } else if (conversation.type === "broadcast") {
      return conversation.avatar || "📢";
    } else {
      const otherUser = getOtherUser(conversation);
      return otherUser?.avatar || otherUser?.name?.charAt(0).toUpperCase() || "👤";
    }
  };

  // Get conversation gradient
  const getConversationGradient = (conversation) => {
    if (conversation.type === "group") {
      return "bg-gradient-to-r from-green-500 to-teal-600";
    } else if (conversation.type === "broadcast") {
      return "bg-gradient-to-r from-purple-500 to-pink-600";
    } else {
      return "bg-gradient-to-r from-blue-500 to-purple-600";
    }
  };

  // Get conversation subtitle
  const getConversationSubtitle = (conversation) => {
    if (conversation.type === "group") {
      return `${conversation.participants.length} members`;
    } else if (conversation.type === "broadcast") {
      return `${conversation.participants.length} subscribers`;
    } else {
      const otherUser = getOtherUser(conversation);
      return otherUser?.email || "Direct message";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl ${
          isDark ? "bg-gray-800 text-white" : "bg-white"
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Forward Message</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Message Preview - Enhanced to show proper file names */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 mb-2">Message to forward:</div>
          <div
            className={`p-3 rounded-lg ${
              isDark ? "bg-gray-700" : "bg-gray-100"
            }`}
          >
            <div className="text-sm">
              {isFileMessage(message) ? (
                <div className="flex items-center space-x-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getFileTypeIndicator()?.split(' ')[0]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" title={getFileDisplayName(message.originalMessage || message)}>
                          {getFileDisplayName(message.originalMessage || message)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {getFileTypeIndicator()?.split(' ').slice(1).join(' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="break-words">
                  <span className="truncate max-w-[200px] inline-block" title={getMessagePreview()}>
                    {getMessagePreview()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                isDark
                  ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  : "bg-gray-50 border-gray-300"
              }`}
              disabled={loading}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="max-h-64 overflow-y-auto">
          {availableConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchQuery
                ? "No conversations found"
                : "No other conversations available"}
            </div>
          ) : (
            availableConversations.map((conversation) => {
              const isSelected = selectedConversations.some(
                (c) => c._id === conversation._id
              );
              const conversationName = getConversationName(conversation);

              return (
                <div
                  key={conversation._id}
                  onClick={() => !loading && toggleConversation(conversation)}
                  className={`p-4 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-700 ${
                    isSelected
                      ? isDark
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-blue-50 hover:bg-blue-100"
                      : isDark
                      ? "hover:bg-gray-700"
                      : "hover:bg-gray-50"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div
                        className={`w-10 h-10 ${getConversationGradient(conversation)} rounded-full flex items-center justify-center`}
                      >
                        <span className="text-white font-semibold">
                          {getConversationAvatar(conversation)}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`font-medium truncate ${
                          isSelected
                            ? isDark
                              ? "text-white"
                              : "text-blue-900"
                            : ""
                        }`}
                      >
                        {conversationName}
                      </h3>
                      <p
                        className={`text-sm truncate ${
                          isSelected
                            ? isDark
                              ? "text-blue-100"
                              : "text-blue-600"
                            : "text-gray-500"
                        }`}
                      >
                        {getConversationSubtitle(conversation)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {selectedConversations.length > 0 &&
                `${selectedConversations.length} conversation${
                  selectedConversations.length > 1 ? "s" : ""
                } selected`}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                disabled={loading}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  isDark
                    ? "border-gray-600 hover:bg-gray-700 disabled:opacity-50"
                    : "border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                } disabled:cursor-not-allowed`}
              >
                Cancel
              </button>
              <button
                onClick={handleForward}
                disabled={selectedConversations.length === 0 || loading}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Forwarding...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Forward</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;