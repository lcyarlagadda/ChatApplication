import React, { useState } from "react";
import {
  File,
  Image,
  Video,
  Music,
  FileText,
  Download,
  ExternalLink,
} from "lucide-react";
import { getFileDisplayName, isGifFile, getFileIcon } from "../utils/fileHelpers";

// File Icon Component - Enhanced
const FileIcon = ({ messageType, mimeType, filename, size = 24 }) => {
  const getIcon = () => {
    const extension = filename ? filename.split('.').pop()?.toLowerCase() : '';
    
    if (messageType === 'image') {
      return extension === 'gif' ? 
        <span className="text-2xl">🎞️</span> : 
        <Image className={`w-${size/4} h-${size/4}`} />;
    }
    if (messageType === 'video') return <Video className={`w-${size/4} h-${size/4}`} />;
    if (messageType === 'audio') return <Music className={`w-${size/4} h-${size/4}`} />;

    if (mimeType) {
      if (mimeType.includes('pdf')) return <FileText className={`w-${size/4} h-${size/4} text-red-500`} />;
      if (mimeType.includes('document') || mimeType.includes('word'))
        return <FileText className={`w-${size/4} h-${size/4} text-blue-500`} />;
      if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
        return <FileText className={`w-${size/4} h-${size/4} text-green-500`} />;
      if (mimeType.includes('zip') || mimeType.includes('rar'))
        return <File className={`w-${size/4} h-${size/4} text-yellow-500`} />;
    }

    return <File className={`w-${size/4} h-${size/4}`} />;
  };

  return getIcon();
};

// File Thumbnail Component - Enhanced with proper display name handling
const FileThumbnail = ({ message, onImageClick, isDark, showFileName = true }) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const fileInfo = message.fileInfo || message.file || {};
  const fileUrl = fileInfo.url || message.content;
  const fileName = getFileDisplayName(message);
  const fileSize = fileInfo.fileSize || (fileInfo.size ? `${(fileInfo.size / 1024).toFixed(1)} KB` : '');
  const mimeType = fileInfo.type || fileInfo.mimeType || '';
  const isGif = isGifFile(message);

  const handleImageError = () => {
    setError(true);
    setLoading(false);
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleOpenInNewTab = (e) => {
    e.stopPropagation();
    if (fileUrl) window.open(fileUrl, '_blank', 'noopener,noreferrer');
  };

  const handleImageClick = () => {
    if (onImageClick) onImageClick(fileUrl);
  };

  // Enhanced image rendering with proper GIF support
  if (message.messageType === 'image') {
    return (
      <div className="mb-2 max-w-sm">
        <div className="relative group">
          {loading && (
            <div className={`absolute inset-0 flex items-center justify-center rounded-lg ${
              isDark ? 'bg-gray-700' : 'bg-gray-100'
            }`}>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {!error ? (
            <img
              src={fileUrl}
              alt={fileName}
              className={`w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity shadow-md ${
                loading ? 'opacity-0' : 'opacity-100'
              }`}
              onClick={handleImageClick}
              onError={handleImageError}
              onLoad={handleImageLoad}
              loading="lazy"
              style={{ maxHeight: '300px', objectFit: 'cover' }}
            />
          ) : (
            <div
              className={`w-full h-48 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-opacity ${
                isDark ? 'bg-gray-700' : 'bg-gray-100'
              }`}
              onClick={handleImageClick}
            >
              {isGif ? (
                <span className="text-4xl mb-2">🎞️</span>
              ) : (
                <Image className="w-12 h-12 text-gray-400 mb-2" />
              )}
              <span className="text-sm text-gray-500 text-center px-2 font-medium">
                {fileName}
              </span>
              <span className="text-xs text-gray-400 mt-1">
                {isGif ? 'GIF • Failed to load' : 'Image • Failed to load'}
              </span>
            </div>
          )}

          {/* Action buttons overlay */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex space-x-1">
              <button
                onClick={handleOpenInNewTab}
                className="p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* File name overlay - Enhanced */}
          {showFileName && fileName && !error && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent rounded-b-lg p-3">
              <div className="flex items-center justify-between">
                <p className="text-black text-sm font-medium truncate flex-1" title={fileName}>
                  {isGif && <span className="mr-1">🎞️</span>}
                  {fileName}
                </p>
                {fileSize && (
                  <span className="text-white/80 text-xs ml-2">{fileSize}</span>
                )}
              </div>
            </div>
          )}

          {/* GIF indicator badge */}
          {isGif && !error && (
            <div className="absolute top-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              GIF
            </div>
          )}
        </div>
      </div>
    );
  }

  // Enhanced video rendering
  if (message.messageType === 'video') {
    return (
      <div className="mb-2 max-w-sm">
        <div className="relative group">
          <video
            src={fileUrl}
            className="w-full h-auto rounded-lg shadow-md"
            controls
            preload="metadata"
            style={{ maxHeight: '300px' }}
            poster={fileInfo.thumbUrl}
          >
            Your browser does not support the video tag.
          </video>

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleOpenInNewTab}
              className="p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70 transition-colors"
              title="Open video in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {showFileName && fileName && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg p-3">
              <div className="flex items-center justify-between text-white text-sm">
                <span className="truncate flex-1 font-medium" title={fileName}>
                  🎥 {fileName}
                </span>
                {fileSize && <span className="ml-2 text-white/80 text-xs">{fileSize}</span>}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Enhanced audio rendering
  if (message.messageType === 'audio') {
    return (
      <div className="mb-2 max-w-sm">
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Music className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" title={fileName}>
                🎵 {fileName}
              </p>
              {fileSize && <p className="text-xs text-gray-500">{fileSize}</p>}
            </div>
            <button
              onClick={handleOpenInNewTab}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Open audio in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          <audio
            src={fileUrl}
            controls
            className="w-full"
            preload="metadata"
          >
            Your browser does not support the audio tag.
          </audio>
        </div>
      </div>
    );
  }

  // Enhanced generic file/document rendering
  return (
    <div className="mb-2 max-w-sm">
      <div
        className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all ${
          isDark ? 'bg-gray-700 border-gray-600 hover:bg-gray-650' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
        }`}
        onClick={handleOpenInNewTab}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
            mimeType.includes('pdf') ? 'bg-red-100 dark:bg-red-900' :
            mimeType.includes('document') || mimeType.includes('word') ? 'bg-blue-100 dark:bg-blue-900' :
            mimeType.includes('spreadsheet') || mimeType.includes('excel') ? 'bg-green-100 dark:bg-green-900' :
            'bg-gray-200 dark:bg-gray-600'
          }`}>
            <FileIcon messageType={message.messageType} mimeType={mimeType} filename={fileName} size={24} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-black font-medium truncate" title={fileName}>
              {getFileIcon(message.messageType, mimeType, fileName)} {fileName}
            </p>
            <div className="flex items-center justify-between mt-1">
              {fileSize && <p className="text-xs text-gray-500">{fileSize}</p>}
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <ExternalLink className="w-3 h-3" />
                <span>Open</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <span className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
            mimeType.includes('pdf') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
            mimeType.includes('document') || mimeType.includes('word') ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
            mimeType.includes('spreadsheet') || mimeType.includes('excel') ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {mimeType.includes('pdf') ? 'PDF Document' :
             mimeType.includes('document') || mimeType.includes('word') ? 'Word Document' :
             mimeType.includes('spreadsheet') || mimeType.includes('excel') ? 'Excel Spreadsheet' :
             mimeType.split('/')[1]?.toUpperCase() || 'File'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FileThumbnail;