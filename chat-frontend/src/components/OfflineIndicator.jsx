import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, Clock, CheckCircle } from 'lucide-react';
import offlineManager from '../services/offlineManager';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(offlineManager.getOnlineStatus());
  const [queuedCount, setQueuedCount] = useState(offlineManager.getQueuedCount());
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const updateStatus = () => {
      setIsOnline(offlineManager.getOnlineStatus());
      setQueuedCount(offlineManager.getQueuedCount());
    };

    const handleOnline = () => {
      setIsAnimating(true);
      updateStatus();
      setTimeout(() => setIsAnimating(false), 2000);
    };

    const handleOffline = () => {
      setIsAnimating(true);
      updateStatus();
      setTimeout(() => setIsAnimating(false), 1000);
    };

    const handleSyncComplete = () => {
      setIsAnimating(true);
      updateStatus();
      setTimeout(() => setIsAnimating(false), 1500);
    };

    const interval = setInterval(updateStatus, 1000);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offlineSyncComplete', handleSyncComplete);

    updateStatus();

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offlineSyncComplete', handleSyncComplete);
    };
  }, []);

  if (isOnline && queuedCount === 0) return null;

  return (
    <div className={`
      fixed top-0 left-0 right-0 z-50 
      transition-all duration-300 ease-in-out
      ${isAnimating ? 'animate-pulse' : ''}
      ${!isOnline 
        ? 'bg-gradient-to-r from-red-500 to-red-600 shadow-lg' 
        : queuedCount > 0 
          ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg' 
          : 'bg-gradient-to-r from-green-500 to-green-600 shadow-lg'
      }
    `}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-3 text-white">
          {!isOnline ? (
            <>
              <WifiOff size={18} className="animate-pulse" />
              <div className="flex items-center gap-2">
                <span className="font-semibold">You're offline</span>
              </div>
            </>
          ) : queuedCount > 0 ? (
            <>
              <Wifi size={18} className="animate-spin" />
              <div className="flex items-center gap-2">
                <span className="font-semibold">Syncing messages...</span>
                <span className="text-blue-100">
                  {queuedCount} message{queuedCount !== 1 ? 's' : ''} remaining
                </span>
              </div>
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              <span className="font-semibold">All messages synced</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfflineIndicator;
