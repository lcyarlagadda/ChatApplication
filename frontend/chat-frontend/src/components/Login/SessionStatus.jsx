// components/SessionStatus.js
import React, { useState, useEffect } from 'react';
import { Clock, Users, LogOut, RefreshCw, AlertCircle } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';

const SessionStatus = () => {
  const { 
    sessionInfo, 
    refreshSessionInfo, 
    extendSession, 
    switchUser, 
    logoutUser,
    currentUser,
    isDark 
  } = useUser();

  const [showDetails, setShowDetails] = useState(false);
  const [showUserSwitcher, setShowUserSwitcher] = useState(false);

  // Format time remaining
  const formatTimeRemaining = (ms) => {
    if (ms <= 0) return 'Expired';
    
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Get status color based on time remaining
  const getStatusColor = (timeRemaining) => {
    if (timeRemaining <= 0) return 'text-red-500';
    if (timeRemaining < 5 * 60 * 1000) return 'text-orange-500'; // Less than 5 minutes
    if (timeRemaining < 15 * 60 * 1000) return 'text-yellow-500'; // Less than 15 minutes
    return 'text-green-500';
  };

  // Handle user switching
  const handleSwitchUser = async (userId) => {
    try {
      await switchUser(userId);
      setShowUserSwitcher(false);
    } catch (error) {
      console.error('Failed to switch user:', error);
    }
  };

  // Handle session extension
  const handleExtendSession = () => {
    extendSession();
    refreshSessionInfo();
  };

  // Handle logout from specific session
  const handleLogoutSession = async (userId) => {
    try {
      if (userId === currentUser?._id) {
        await logoutUser();
      }
    } catch (error) {
      console.error('Failed to logout session:', error);
    }
  };

  if (!sessionInfo.isValid) {
    return (
      <div className={`fixed bottom-4 right-4 p-3 rounded-lg shadow-lg ${
        isDark ? 'bg-red-800 text-red-100' : 'bg-red-100 text-red-800'
      }`}>
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Session Expired</span>
        </div>
      </div>
    );
  }

  const availableSessionsCount = Object.keys(sessionInfo.availableSessions).length;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Main Status Badge */}
      <div 
        className={`p-3 rounded-lg shadow-lg cursor-pointer transition-all ${
          isDark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
        } ${showDetails ? 'rounded-b-none' : ''}`}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div className="flex items-center space-x-2">
          <Clock className={`w-4 h-4 ${getStatusColor(sessionInfo.timeUntilExpiry)}`} />
          <span className="text-sm font-medium">
            {formatTimeRemaining(sessionInfo.timeUntilExpiry)}
          </span>
          {availableSessionsCount > 1 && (
            <div className="flex items-center space-x-1">
              <Users className="w-3 h-3 text-blue-500" />
              <span className="text-xs text-blue-500">{availableSessionsCount}</span>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Panel */}
      {showDetails && (
        <div className={`rounded-lg rounded-t-none shadow-lg border-t ${
          isDark ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-200'
        }`}>
          {/* Session Info */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Current Session</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{currentUser?.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Expires: {formatTimeRemaining(sessionInfo.timeUntilExpiry)}
                </div>
              </div>
              <button
                onClick={handleExtendSession}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Extend session"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Available Sessions */}
          {availableSessionsCount > 1 && (
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">Other Sessions</div>
                <button
                  onClick={() => setShowUserSwitcher(!showUserSwitcher)}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  {showUserSwitcher ? 'Hide' : 'Switch'}
                </button>
              </div>
              
              {showUserSwitcher && (
                <div className="space-y-2">
                  {Object.entries(sessionInfo.availableSessions)
                    .filter(([userId]) => userId !== currentUser?._id)
                    .map(([userId, session]) => (
                      <div 
                        key={userId}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">
                              {session.user.avatar || session.user.name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium">{session.user.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Last active: {new Date(session.lastActive).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleSwitchUser(userId)}
                            className="text-xs text-blue-500 hover:text-blue-600 px-2 py-1 rounded"
                          >
                            Switch
                          </button>
                          <button
                            onClick={() => handleLogoutSession(userId)}
                            className="text-xs text-red-500 hover:text-red-600 p-1 rounded"
                            title="Logout this session"
                          >
                            <LogOut className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="p-3">
            <div className="flex space-x-2">
              <button
                onClick={refreshSessionInfo}
                className="flex-1 text-xs text-blue-500 hover:text-blue-600 py-1 px-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Refresh
              </button>
              <button
                onClick={() => logoutUser()}
                className="flex-1 text-xs text-red-500 hover:text-red-600 py-1 px-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionStatus;