import { X, AlertTriangle } from 'lucide-react';

const DeleteModal = ({ 
  isDark, 
  onConfirm, 
  onCancel, 
  messagePreview,
  type = "message", // "message" or "conversation"
  conversationName,
  conversationType // "group" or "direct"
}) => {
  const isConversation = type === "conversation";
  const isGroupConversation = conversationType === "group";

  const getTitle = () => {
    if (isConversation) {
      return isGroupConversation ? "Delete Group" : "Delete Conversation";
    }
    return "Delete Message";
  };

  const getDescription = () => {
    if (isConversation) {
      if (isGroupConversation) {
        return `Are you sure you want to delete the group "${conversationName}"? This action cannot be undone and will delete all messages.`;
      }
      return `Are you sure you want to delete the conversation with ${conversationName}? This action cannot be undone and will delete all messages.`;
    }
    return "Are you sure you want to delete this message? This action cannot be undone.";
  };

  const getPreviewLabel = () => {
    if (isConversation) {
      return isGroupConversation ? "Group to delete:" : "Conversation to delete:";
    }
    return "Message to delete:";
  };

  const getPreviewContent = () => {
    if (isConversation) {
      return conversationName || "Unknown";
    }
    return messagePreview || "No content";
  };

  const getConfirmButtonText = () => {
    if (isConversation) {
      return isGroupConversation ? "Delete Group" : "Delete Conversation";
    }
    return "Delete Message";
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl ${
          isDark ? "bg-gray-800 text-white" : "bg-white"
        }`}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold">{getTitle()}</h2>
            </div>
            <button
              onClick={onCancel}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {getDescription()}
          </p>

          <div className={`p-3 rounded-lg border-l-4 border-red-400 ${isDark ? "bg-gray-700" : "bg-gray-50"}`}>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              {getPreviewLabel()}
            </p>
            <p className="text-sm truncate">{getPreviewContent()}</p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            {getConfirmButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;