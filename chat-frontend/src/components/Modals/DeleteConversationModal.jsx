import React from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

const DeleteConversationModal = ({ 
  isDark, 
  onConfirm, 
  onCancel, 
  conversation, 
  conversationName,
  isGroup 
}) => {
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
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold">
                Delete {isGroup ? 'Group' : 'Conversation'}
              </h2>
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
          <div className="flex items-start space-x-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {isGroup 
                  ? `Are you sure you want to delete the group "${conversationName}"?`
                  : `Are you sure you want to delete the conversation with ${conversationName}?`
                }
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This action cannot be undone and will permanently delete:
              </p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                <li>• All messages in this {isGroup ? 'group' : 'conversation'}</li>
                <li>• All shared files and media</li>
                <li>• Message history for all participants</li>
              </ul>
            </div>
          </div>

          <div className={`p-4 rounded-lg border-l-4 border-red-400 ${isDark ? "bg-gray-700" : "bg-red-50"}`}>
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 ${
                isGroup
                  ? "bg-gradient-to-r from-green-500 to-teal-600"
                  : "bg-gradient-to-r from-blue-500 to-purple-600"
              } rounded-full flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-sm font-semibold">
                  {isGroup ? "👥" : conversation?.participants?.find(p => p.user._id !== conversation.currentUserId)?.user?.name?.charAt(0) || "👤"}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {conversationName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isGroup ? `Group • ${conversation?.participants?.length || 0} members` : 'Direct conversation'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Delete {isGroup ? 'Group' : 'Conversation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConversationModal;