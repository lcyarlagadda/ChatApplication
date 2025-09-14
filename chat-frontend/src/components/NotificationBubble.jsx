import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Bell } from 'lucide-react';

const NotificationBubble = ({ 
  notifications, 
  onNotificationClick, 
  onDismiss, 
  isDark 
}) => {
  const [visibleNotifications, setVisibleNotifications] = useState([]);

  // Update visible notifications when notifications prop changes
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      setVisibleNotifications(notifications);
    }
  }, [notifications]);

  const handleNotificationClick = (notification) => {
    
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    handleDismiss(notification.id);
  };

  const handleDismiss = (notificationId) => {
    setVisibleNotifications(prev => 
      prev.filter(notif => notif.id !== notificationId)
    );
    if (onDismiss) {
      onDismiss(notificationId);
    }
  };

  // Auto-dismiss notifications after 5 seconds
  useEffect(() => {
    visibleNotifications.forEach(notification => {
      const timer = setTimeout(() => {
        handleDismiss(notification.id);
      }, 5000);

      return () => clearTimeout(timer);
    });
  }, [visibleNotifications]);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`w-96 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 transform transition-all duration-500 ease-out hover:scale-[1.02] hover:shadow-3xl cursor-pointer animate-in slide-in-from-right-full relative z-[9999]`}
          onClick={() => handleNotificationClick(notification)}
          style={{
            animation: 'slideInRight 0.5s ease-out',
            zIndex: 9999
          }}
        >
          <div className="p-3">
            <div className="flex items-center space-x-3">
              {/* Conversation avatar */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 ${
                notification.conversation.type === 'broadcast'
                  ? 'bg-gradient-to-br from-purple-500 to-pink-600'
                  : notification.conversation.type === 'group'
                  ? 'bg-gradient-to-br from-green-500 to-teal-600'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600'
              }`}>
                <span className="text-white text-sm font-bold">
                  {notification.conversation.avatar || 
                   notification.conversation.name?.charAt(0).toUpperCase() || 
                   notification.sender?.name?.charAt(0).toUpperCase() || "👤"}
                </span>
              </div>

              {/* Notification content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {notification.conversation.name || notification.sender?.name || 'Unknown'}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(notification.id);
                    }}
                    className="flex-shrink-0 p-1 rounded-full hover:bg-gray-100/80 dark:hover:bg-gray-700/80 transition-all duration-200 ml-2"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                  </button>
                </div>

                {/* Message preview */}
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1 leading-relaxed">
                  {notification.messagePreview}
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationBubble;
