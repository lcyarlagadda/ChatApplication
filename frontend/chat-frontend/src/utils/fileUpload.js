// Frontend: utils/fileUpload.js - Fixed version
class FileUploadService {
  constructor() {
    // Your Cloudinary configuration
    const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || 'dygmwu7qd';
    const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || 'ChatApp';
    
    this.cloudinaryUploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
    this.cloudinaryRawUploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`;
    this.cloudinaryUploadPreset = uploadPreset;
  }

  // Determine the correct resource type for Cloudinary
  getCloudinaryResourceType(file) {
    const mimeType = file.type.toLowerCase();
    
    // Images and GIFs use 'image' resource type
    if (mimeType.startsWith('image/')) {
      return { resourceType: 'image', endpoint: this.cloudinaryUploadUrl };
    }
    
    // Videos use 'video' resource type
    if (mimeType.startsWith('video/')) {
      return { resourceType: 'video', endpoint: this.cloudinaryUploadUrl };
    }
    
    // Audio uses 'video' resource type in Cloudinary
    if (mimeType.startsWith('audio/')) {
      return { resourceType: 'video', endpoint: this.cloudinaryUploadUrl };
    }
    
    // Everything else (PDFs, documents, etc.) uses 'raw' resource type
    return { resourceType: 'raw', endpoint: this.cloudinaryRawUploadUrl };
  }

  // Upload to Cloudinary with proper resource type handling
  async uploadToCloudinary(file) {
    try {
      const { resourceType, endpoint } = this.getCloudinaryResourceType(file);
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', this.cloudinaryUploadPreset);
      formData.append('resource_type', resourceType);
      
      // For raw files, only set a custom public_id (no use_filename for unsigned uploads)
      if (resourceType === 'raw') {
        // Create a clean filename for the public_id
        const timestamp = Date.now();
        const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const publicId = `${timestamp}_${cleanFileName}`;
        formData.append('public_id', publicId);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cloudinary response error:', errorText);
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        originalName: file.name,
        size: result.bytes,
        format: result.format,
        resourceType: result.resource_type,
        width: result.width,
        height: result.height,
        // Additional metadata for documents
        pages: result.pages, // For PDFs
        duration: result.duration // For audio/video
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  }

  // Main upload method - tries multiple services
  async uploadFile(file) {

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File too large. Maximum size is 50MB.');
    }

    try {
      // Try Cloudinary first (best for production)
      if (this.cloudinaryUploadPreset && this.cloudinaryUploadPreset !== 'YOUR_UPLOAD_PRESET') {
        return await this.uploadToCloudinary(file);
      }
      
    } catch (error) {
      console.error('All upload methods failed:', error);
      throw new Error('Failed to upload file. Please try again.');
    }
  }

  // Enhanced file type detection
  getFileType(file) {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();
    
    // Images (including GIFs)
    if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      return 'image';
    }
    
    // Videos
    if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
      return 'video';
    }
    
    // Audio
    if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(extension)) {
      return 'audio';
    }
    
    // PDFs
    if (mimeType === 'application/pdf' || extension === 'pdf') {
      return 'pdf';
    }
    
    // Documents
    if (mimeType.includes('document') || mimeType.includes('word') || 
        ['doc', 'docx', 'rtf', 'odt'].includes(extension)) {
      return 'document';
    }
    
    // Spreadsheets
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || 
        ['xlsx', 'xls', 'csv', 'ods'].includes(extension)) {
      return 'xlsx';
    }
    
    // Text files
    if (mimeType === 'text/plain' || extension === 'txt') {
      return 'document'; // Treat txt as document for consistency
    }
    
    // Default to file
    return 'file';
  }

  // Format file size for display
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Helper method to validate file before upload
  validateFile(file) {
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      // Videos
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm',
      // Audio
      'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
      // Documents
      'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv'
    ];

    const fileExtension = file.name.split('.').pop().toLowerCase();
    const allowedExtensions = [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
      'mp4', 'avi', 'mov', 'wmv', 'webm', 'mkv',
      'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a',
      'pdf', 'doc', 'docx', 'txt', 'rtf',
      'xlsx', 'xls', 'csv'
    ];

    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension);
    
    if (!isValidType) {
      throw new Error(`File type ${file.type || fileExtension} is not supported`);
    }

    return true;
  }
}

// Create singleton instance
const fileUploadService = new FileUploadService();
export default fileUploadService;