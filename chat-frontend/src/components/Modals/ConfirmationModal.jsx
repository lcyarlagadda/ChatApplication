// components/Modals/ConfirmationModal.js
import { X, AlertTriangle, Trash2, UserX, LogOut, MessageSquare } from 'lucide-react';

const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "default", 
  isDark = false,
  icon = null,
  details = null
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "danger":
        return {
          iconBg: "bg-red-100 dark:bg-red-900",
          iconColor: "text-red-600 dark:text-red-400",
          confirmButton: "bg-red-600 hover:bg-red-700 text-white",
          defaultIcon: AlertTriangle
        };
      case "warning":
        return {
          iconBg: "bg-yellow-100 dark:bg-yellow-900",
          iconColor: "text-yellow-600 dark:text-yellow-400",
          confirmButton: "bg-yellow-600 hover:bg-yellow-700 text-white",
          defaultIcon: AlertTriangle
        };
      case "info":
        return {
          iconBg: "bg-blue-100 dark:bg-blue-900",
          iconColor: "text-blue-600 dark:text-blue-400",
          confirmButton: "bg-blue-600 hover:bg-blue-700 text-white",
          defaultIcon: MessageSquare
        };
      default:
        return {
          iconBg: "bg-gray-100 dark:bg-gray-700",
          iconColor: "text-gray-600 dark:text-gray-400",
          confirmButton: "bg-blue-600 hover:bg-blue-700 text-white",
          defaultIcon: MessageSquare
        };
    }
  };

  const typeStyles = getTypeStyles();
  const IconComponent = icon || typeStyles.defaultIcon;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
        onClick={handleBackdropClick}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className={`
            relative w-full max-w-md transform overflow-hidden rounded-2xl shadow-2xl transition-all
            ${isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className={`
              absolute right-4 top-4 p-1 rounded-lg transition-colors
              ${isDark ? 'hover:bg-gray-700 text-gray-400 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'}
            `}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-6">
            {/* Icon */}
            <div className="flex items-center justify-center mb-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${typeStyles.iconBg}`}>
                <IconComponent className={`w-8 h-8 ${typeStyles.iconColor}`} />
              </div>
            </div>

            {/* Content */}
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">
                {title}
              </h3>
              
              <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                {message}
              </p>

              {/* Additional details */}
              {details && (
                <div className={`
                  text-xs p-3 rounded-lg mb-4 
                  ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}
                `}>
                  {details}
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={onClose}
                className={`
                  flex-1 px-4 py-2 rounded-lg border transition-colors font-medium
                  ${isDark 
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }
                `}
              >
                {cancelText}
              </button>
              
              <button
                onClick={onConfirm}
                className={`
                  flex-1 px-4 py-2 rounded-lg transition-colors font-medium transform hover:scale-105
                  ${typeStyles.confirmButton}
                `}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;