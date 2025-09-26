// models/Message.js - Fix the fileInfo field

// REPLACE your current Message model with this one
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: function() {
      return this.messageType === 'text' || this.messageType === 'system';
    }
  },
  messageType: {
    type: String,
    enum: ['text', 'txt', 'image', 'file', 'video', 'audio', 'document', 'pdf', 'xlsx', 'deleted', 'system'],
    default: 'text'
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  
  // FIXED: Cloud file information as Object, not String
  fileInfo: {
    originalName: { type: String },
    url: { type: String }, // Cloud storage URL
    size: { type: Number },
    type: { type: String }, // MIME type
    displayName: { type: String },
    fileSize: { type: String }, // Human readable size
    cloudData: {
      publicId: { type: String }, // Cloudinary public ID
      deleteUrl: { type: String }, // Delete URL
      thumbUrl: { type: String }, // Thumbnail URL
      width: { type: Number }, // Image/video width
      height: { type: Number }, // Image/video height
      duration: { type: Number }, // Video/audio duration
      format: { type: String }, // File format
      resourceType: { type: String } // Resource type
    }
  },
  
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  clearedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  editHistory: [{
    content: String,
    editedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ messageType: 1 });

// Mark message as delivered to user
messageSchema.methods.markDelivered = function(userId) {
  const existingDelivery = this.deliveredTo.find(d => d.user.toString() === userId.toString());
  
  if (!existingDelivery) {
    this.deliveredTo.push({
      user: userId,
      deliveredAt: new Date()
    });
  }
  
  if (this.status === 'sent') {
    this.status = 'delivered';
  }
  
  return this.save();
};

// Mark message as read by user
messageSchema.methods.markRead = function(userId) {
  const existingRead = this.readBy.find(r => r.user.toString() === userId.toString());
  
  if (!existingRead) {
    this.readBy.push({
      user: userId,
      readAt: new Date()
    });
  }
  
  this.status = 'read';
  return this.save();
};

// Add reaction to message
messageSchema.methods.addReaction = function(userId, emoji) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  this.reactions.push({
    user: userId,
    emoji: emoji,
    createdAt: new Date()
  });
  
  return this.save();
};

// Remove reaction from message
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  return this.save();
};

// Edit message (only for text messages)
messageSchema.methods.editMessage = function(newContent) {
  if (this.messageType !== 'text') {
    throw new Error('Only text messages can be edited');
  }
  
  this.editHistory.push({
    content: this.content,
    editedAt: new Date()
  });
  
  this.content = newContent;
  this.isEdited = true;
  
  return this.save();
};

// Soft delete message
messageSchema.methods.softDelete = function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.messageType = 'deleted';
  this.content = 'This message was deleted';
  this.fileInfo = undefined;
  
  return this.save();
};

// Get messages for conversation with pagination
messageSchema.statics.getConversationMessages = function(conversationId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  
  return this.find({
    conversation: conversationId,
    isDeleted: { $ne: true }
  })
  .populate('sender', 'name avatar status')
  .populate('replyTo', 'content sender messageType fileInfo')
  .populate('replyTo.sender', 'name avatar')
  .populate('reactions.user', 'name avatar')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit);
};

// Search messages in conversation
messageSchema.statics.searchMessages = function(conversationId, query) {
  const searchRegex = new RegExp(query, 'i');
  
  return this.find({
    conversation: conversationId,
    $or: [
      { content: searchRegex },
      { 'fileInfo.originalName': searchRegex }
    ],
    isDeleted: { $ne: true }
  })
  .populate('sender', 'name avatar')
  .sort({ createdAt: -1 })
  .limit(20);
};

// Get unread messages count for user in conversation
messageSchema.statics.getUnreadCount = function(conversationId, userId, lastReadTime) {
  return this.countDocuments({
    conversation: conversationId,
    sender: { $ne: userId },
    createdAt: { $gt: lastReadTime },
    isDeleted: { $ne: true }
  });
};

// Create system message
messageSchema.statics.createSystemMessage = function(conversationId, content, sender = null) {
  return this.create({
    conversation: conversationId,
    sender: sender,
    content: content,
    messageType: 'system',
    status: 'read'
  });
};

module.exports = mongoose.model('Message', messageSchema);