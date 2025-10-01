// utils/fileHelpers.js - Complete media handling utilities

// Check if a message is a file message
export const isFileMessage = (message) => {
  if (!message) return false;
  
  const fileTypes = ['image', 'video', 'audio', 'file', 'document', 'pdf', 'xlsx', 'txt'];
  return fileTypes.includes(message.messageType) || Boolean(message.fileInfo || message.file);
};

// Get the display name for a file message
export const getFileDisplayName = (message) => {
  if (!message) return 'Unknown File';
  
  const fileInfo = message.fileInfo || message.file || {};
  
  // Priority: displayName > originalName > filename from URL > fallback
  return fileInfo.displayName || 
         fileInfo.originalName || 
         fileInfo.name ||
         extractFilenameFromUrl(message.content) ||
         'Unknown File';
};

// Extract filename from URL
const extractFilenameFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  
  try {
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    
    // Remove query parameters
    const filename = lastPart.split('?')[0];
    
    // Only return if it looks like a filename (has extension)
    if (filename.includes('.') && filename.length > 3) {
      return decodeURIComponent(filename);
    }
  } catch (error) {
    console.error('Error extracting filename from URL:', error);
  }
  
  return null;
};

// Get file extension from message
export const getFileExtension = (message) => {
  const displayName = getFileDisplayName(message);
  const parts = displayName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

// Check if file is a GIF
export const isGifFile = (message) => {
  if (!message) return false;
  
  const fileInfo = message.fileInfo || message.file || {};
  const extension = getFileExtension(message);
  const mimeType = fileInfo.type || fileInfo.mimeType || '';
  
  return extension === 'gif' || mimeType === 'image/gif';
};

// Get appropriate icon for file type
export const getFileIcon = (messageType, mimeType = '', filename = '') => {
  const extension = filename ? filename.split('.').pop()?.toLowerCase() : '';
  
  if (messageType === 'image') {
    return extension === 'gif' ? '🎞️' : '🖼️';
  }
  
  if (messageType === 'video') return '🎥';
  if (messageType === 'audio') return '🎵';
  
  if (messageType === 'pdf' || mimeType.includes('pdf') || extension === 'pdf') {
    return '📄';
  }
  
  if (mimeType.includes('document') || mimeType.includes('word') || 
      ['doc', 'docx'].includes(extension)) {
    return '📝';
  }
  
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || 
      ['xls', 'xlsx'].includes(extension)) {
    return '📊';
  }
  
  if (mimeType.includes('zip') || ['zip', 'rar', '7z'].includes(extension)) {
    return '🗜️';
  }
  
  return '📎'; // Default file icon
};

// Format message for forwarding - handles all media types properly
export const formatMessageForForwarding = (message) => {
  if (!message) {
    return {
      content: '',
      displayText: 'Message',
      isFile: false,
      originalMessage: message
    };
  }

  // Handle file messages
  if (isFileMessage(message)) {
    const displayName = getFileDisplayName(message);
    const fileIcon = getFileIcon(message.messageType, message.fileInfo?.type, displayName);
    
    return {
      content: message.content, // Keep original URL/content
      displayText: `${fileIcon} ${displayName}`,
      fileName: displayName,
      isFile: true,
      messageType: message.messageType,
      fileInfo: message.fileInfo || message.file,
      originalMessage: message
    };
  }

  // Handle text messages
  return {
    content: message.content || '',
    displayText: message.content || 'Message',
    isFile: false,
    messageType: 'text',
    originalMessage: message
  };
};

// utils/fileHelpers.js - Updated getSidebarPreviewText function

// Get preview text for sidebar - simplified for lastMessage objects
export const getSidebarPreviewText = (message) => {
  if (!message) return 'No messages yet';

  // Handle system messages - return content as-is without sender prefix
  if (message.messageType === 'system') {
    return message.content || 'System message';
  }

  // For text messages
  if (!message.messageType || message.messageType === 'text') {
    return message.content || 'Message';
  }

  // For file messages - use content as filename and messageType for icon
  const fileName = message.fileInfo?.displayName || message.content || 'Unknown File';
  
  // Check if filename already starts with an icon
  const hasIconAlready = fileName.startsWith('📎') || 
                        fileName.startsWith('🖼️') || 
                        fileName.startsWith('🎥') || 
                        fileName.startsWith('🎵') || 
                        fileName.startsWith('📄') || 
                        fileName.startsWith('🎞️') ||
                        fileName.startsWith('📝') ||
                        fileName.startsWith('📊') ||
                        fileName.startsWith('🗜️');
  
  if (hasIconAlready) {
    return fileName;
  }

  // Get appropriate icon based on messageType
  let icon = '📎'; // default
  
  switch (message.messageType) {
    case 'image':
      // Check if it's a GIF
      icon = fileName.toLowerCase().endsWith('.gif') ? '🎞️' : '🖼️';
      break;
    case 'video':
      icon = '🎥';
      break;
    case 'audio':
      icon = '🎵';
      break;
    case 'pdf':
      icon = '📄';
      break;
    case 'document':
      icon = '📝';
      break;
    case 'xlsx':
      icon = '📊';
      break;
    case 'txt':
      icon = '📄';
      break;
    case 'file':
    default:
      icon = '📎';
      break;
  }

  return `${icon} ${fileName}`;
};


// Enhanced function to determine if a message should show sender info
export const shouldShowMessageSender = (message, conversationType) => {
  // Never show sender for system messages
  if (message?.messageType === 'system') {
    return false;
  }
  
  // Show sender for group and broadcast messages (non-system only)
  return conversationType === 'group' || conversationType === 'broadcast';
};

// Get file type for upload
export const getFileTypeFromFile = (file) => {
  if (!file) return 'file';
  
  const mimeType = file.type || '';
  const fileName = file.name || '';
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (mimeType.startsWith('image/')) {
    return 'image'; // All images including GIFs
  }
  
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || extension === 'pdf') return 'pdf';
  if (mimeType.includes('document') || mimeType.includes('word') || 
      ['doc', 'docx'].includes(extension)) return 'document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || 
      ['xls', 'xlsx'].includes(extension)) return 'xlsx';
  if (mimeType === 'text/plain' || extension === 'txt') return 'txt';
  
  return 'file';
};

// Format file size for display
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Create proper file info object for upload
export const createFileInfo = (file, uploadResult) => {
  return {
    originalName: file.name,
    displayName: file.name, // Always use the original filename as display name
    url: uploadResult.url,
    size: file.size,
    type: file.type,
    fileSize: formatFileSize(file.size),
    cloudData: {
      publicId: uploadResult.publicId || uploadResult.public_id,
      deleteUrl: uploadResult.deleteUrl,
      thumbUrl: uploadResult.thumbUrl || uploadResult.thumbnail_url,
      width: uploadResult.width,
      height: uploadResult.height,
      duration: uploadResult.duration,
      format: uploadResult.format,
      resourceType: uploadResult.resourceType || uploadResult.resource_type
    }
  };
};

// Validate file for upload
export const validateFile = (file, maxSize = 50 * 1024 * 1024) => { // 50MB default
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }
  
  if (file.size > maxSize) {
    return { 
      valid: false, 
      error: `File size too large. Maximum size is ${formatFileSize(maxSize)}` 
    };
  }
  
  // Check file type
  const allowedTypes = [
    'image/', 'video/', 'audio/',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed'
  ];
  
  const isAllowed = allowedTypes.some(type => file.type.startsWith(type));
  
  if (!isAllowed) {
    return {
      valid: false,
      error: 'File type not supported'
    };
  }
  
  return { valid: true };
};

// Get message content for reply preview with ellipsis
export const getReplyPreviewText = (message, maxLength = 50) => {
  if (!message) return 'Message';
  
  if (isFileMessage(message)) {
    const displayName = getFileDisplayName(message);
    const fileIcon = getFileIcon(message.messageType, message.fileInfo?.type, displayName);
    const preview = `${fileIcon} ${displayName}`;
    return preview.length > maxLength ? preview.substring(0, maxLength) + '...' : preview;
  }
  
  // Truncate long text messages
  const content = message.content || '';
  return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
};

// Check if message has viewable thumbnail
export const hasViewableThumbnail = (message) => {
  if (!isFileMessage(message)) return false;
  
  const supportedTypes = ['image', 'video'];
  return supportedTypes.includes(message.messageType);
};

// Get thumbnail URL for message
export const getThumbnailUrl = (message) => {
  if (!hasViewableThumbnail(message)) return null;
  
  const fileInfo = message.fileInfo || message.file || {};
  
  // For images and videos, return the main URL or thumbnail
  return fileInfo.thumbUrl || fileInfo.url || message.content;
};

export default {
  isFileMessage,
  getFileDisplayName,
  getFileExtension,
  isGifFile,
  getFileIcon,
  formatMessageForForwarding,
  getSidebarPreviewText,
  getFileTypeFromFile,
  formatFileSize,
  createFileInfo,
  validateFile,
  getReplyPreviewText,
  hasViewableThumbnail,
  getThumbnailUrl
};