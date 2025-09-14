// utils/helpers.js - Updated with message status functions

export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // If within the last minute, show "now"
  if (diff < 60000) {
    return 'now';
  }
  
  // If within the last hour, show minutes ago
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // If today, show time
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }
  
  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  // If within the last week, show day name
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  
  // Otherwise show date
  return date.toLocaleDateString([], { 
    month: 'short', 
    day: 'numeric' 
  });
};



export const getDetailedStatus = (message, participants = []) => {
  if (!message) return null;
  
  const { status, deliveredTo = [], readBy = [], sender } = message;
  const participantCount = participants.filter(p => p.user._id !== sender._id).length;
  
  // For group chats, show detailed status
  if (participantCount > 1) {
    const deliveredCount = deliveredTo.length;
    const readCount = readBy.length;
    
    if (readCount > 0) {
      return {
        status: 'read',
        icon: <span style={{ color: '#4F46E5' }}>✓✓</span>,
        text: readCount === participantCount 
          ? 'Read by all' 
          : `Read by ${readCount}/${participantCount}`,
        details: {
          delivered: deliveredCount,
          read: readCount,
          total: participantCount
        }
      };
    }
    
    if (deliveredCount > 0) {
      return {
        status: 'delivered',
        icon: '✓✓',
        text: deliveredCount === participantCount 
          ? 'Delivered to all' 
          : `Delivered to ${deliveredCount}/${participantCount}`,
        details: {
          delivered: deliveredCount,
          read: readCount,
          total: participantCount
        }
      };
    }
    
    return {
      status: 'sent',
      icon: '✓',
      text: 'Sent',
      details: {
        delivered: 0,
        read: 0,
        total: participantCount
      }
    };
  }
  
};

export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileIcon = (messageType, mimeType) => {
  if (messageType === 'image') return '🖼️';
  if (messageType === 'video') return '🎥';
  if (messageType === 'audio') return '🎵';
  
  if (mimeType) {
    if (mimeType.includes('pdf')) return '📕';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📄';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
  }
  
  return '📎';
};

export const isImageFile = (mimeType) => {
  return mimeType && mimeType.startsWith('image/');
};

export const isVideoFile = (mimeType) => {
  return mimeType && mimeType.startsWith('video/');
};

export const isAudioFile = (mimeType) => {
  return mimeType && mimeType.startsWith('audio/');
};

export const getMessagePreview = (message) => {
  if (!message) return 'No content';
  
  const { messageType, content, fileInfo } = message;
  
  if (messageType !== 'text' && fileInfo) {
    const fileName = fileInfo.displayName || fileInfo.originalName || 'File';
    const icon = getFileIcon(messageType, fileInfo.type);
    return `${icon} ${fileName}`;
  }
  
  return content || 'No content';
};

export const getConversationName = (conversation, currentUser) => {
  if (!conversation) return 'Unknown';
  
  if (conversation.type === 'group') {
    return conversation.name || 'Group Chat';
  }
  
  // For direct conversations, find the other user
  const otherParticipant = conversation.participants?.find(
    p => p.user._id !== currentUser?._id
  );
  
  return otherParticipant?.user?.name || 'Unknown User';
};

export const getConversationAvatar = (conversation, currentUser) => {
  if (!conversation) return '👤';
  
  if (conversation.type === 'group') {
    return conversation.avatar || '👥';
  }
  
  // For direct conversations, get other user's avatar
  const otherParticipant = conversation.participants?.find(
    p => p.user._id !== currentUser?._id
  );
  
  const user = otherParticipant?.user;
  return user?.avatar || user?.name?.charAt(0).toUpperCase() || '👤';
};

export const isUserOnline = (userId, onlineUsers = []) => {
  return [...onlineUsers].includes(userId);
};

export const getUnreadCount = (conversation) => {
  // If conversation has an explicit unreadCount, use it
  if (conversation?.unreadCount !== undefined) {
    return conversation.unreadCount;
  }
  
  // Otherwise, calculate based on lastRead timestamp
  if (!conversation?.lastMessage?.timestamp) {
    return 0;
  }
  
  // Find the participant's lastRead timestamp
  const participant = conversation.participants?.find(p => p.user?._id);
  if (!participant?.lastRead) {
    return 1; // If no lastRead, assume there's at least one unread message
  }
  
  const lastMessageTime = new Date(conversation.lastMessage.timestamp);
  const lastReadTime = new Date(participant.lastRead);
  
  // If last message is after last read, there are unread messages
  return lastMessageTime > lastReadTime ? 1 : 0;
};

export const sortConversationsByActivity = (conversations) => {
  return [...conversations].sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt);
    const bTime = new Date(b.updatedAt || b.createdAt);
    return bTime - aTime;
  });
};

export const filterConversations = (conversations, searchQuery) => {
  if (!searchQuery.trim()) return conversations;
  
  const query = searchQuery.toLowerCase();
  
  return conversations.filter(conversation => {
    // Search by conversation name
    if (conversation.name?.toLowerCase().includes(query)) return true;
    
    // Search by participant names
    const participantMatch = conversation.participants?.some(
      p => p.user?.name?.toLowerCase().includes(query)
    );
    if (participantMatch) return true;
    
    // Search by last message content
    if (conversation.lastMessage?.content?.toLowerCase().includes(query)) return true;
    
    return false;
  });
};

export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const formatLastSeen = (lastSeen) => {
  if (!lastSeen) return 'Never';
  
  const date = new Date(lastSeen);
  const now = new Date();
  const diff = now - date;
  
  // If within the last 5 minutes, show "just now"
  if (diff < 5 * 60 * 1000) {
    return 'just now';
  }
  
  // If within the last hour, show minutes ago
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} min ago`;
  }
  
  // If within the last 24 hours, show hours ago
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  // Otherwise show the date
  return formatTime(lastSeen);
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const generateTempId = () => {
  return 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

export const isMessageFromToday = (timestamp) => {
  if (!timestamp) return false;
  
  const messageDate = new Date(timestamp);
  const today = new Date();
  
  return messageDate.toDateString() === today.toDateString();
};

export const shouldShowDateSeparator = (currentMessage, previousMessage) => {
  if (!currentMessage?.createdAt) return false;
  if (!previousMessage?.createdAt) return true;
  
  const currentDate = new Date(currentMessage.createdAt);
  const previousDate = new Date(previousMessage.createdAt);
  
  return currentDate.toDateString() !== previousDate.toDateString();
};

export const getDateSeparatorText = (timestamp) => {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }
  
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  return date.toLocaleDateString([], { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};