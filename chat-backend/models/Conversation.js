// models/Conversation.js - FIXED VERSION
const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group', 'broadcast'],
    required: true
  },
  name: {
    type: String,
    required: function() {
      return this.type === 'group' || this.type === 'broadcast';
    }
  },
  description: {
    type: String,
    default: ''
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'moderator', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    lastRead: {
      type: Date,
      default: Date.now
    },
    isHidden: {
      type: Boolean,
      default: false
    },
    hiddenAt: {
      type: Date,
      default: null
    },
    leftAt: {
      type: Date,
      default: null
    }
  }],
  hiddenFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // FIXED: Single admin field for main creator
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'group' || this.type === 'broadcast';
    }
  },
  // Additional admins array (for multiple admins)
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastMessage: {
    content: String,
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: Date,
    messageType: {
      type: String,
      enum: ['text', 'txt', 'image', 'file', 'video', 'audio', 'document', 'pdf', 'xlsx', 'deleted', 'system'],
      default: 'text'
    },
    fileInfo: mongoose.Schema.Types.Mixed
  },
  avatar: {
    type: String,
    default: function() {
      return this.type === 'broadcast' ? '📢' : this.type === 'group' ? '👥' : null;
    }
  },
  settings: {
    isArchived: {
      type: Boolean,
      default: false
    },
    isMuted: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      mutedUntil: Date
    }],
    allowMediaDownload: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
conversationSchema.index({ 'participants.user': 1 });
conversationSchema.index({ type: 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ admin: 1 });

conversationSchema.methods.isHiddenFor = function(userId) {
  return this.hiddenFor.some(id => id.toString() === userId.toString());
};

// Add method to hide conversation for a user
conversationSchema.methods.hideFor = function(userId) {
  if (!this.isHiddenFor(userId)) {
    this.hiddenFor.push(userId);
  }
};

// Add method to unhide conversation for a user
conversationSchema.methods.unhideFor = function(userId) {
  this.hiddenFor = this.hiddenFor.filter(id => id.toString() !== userId.toString());
};

// Get unread count for a user
conversationSchema.methods.getUnreadCount = async function(userId) {
  const Message = mongoose.model('Message');
  
  // Handle both populated and non-populated participants
  const participant = this.participants.find(p => {
    if (p.user && typeof p.user === 'object') {
      // If user is populated (has _id property)
      return p.user._id && p.user._id.toString() === userId.toString();
    } else {
      // If user is just an ObjectId
      return p.user && p.user.toString() === userId.toString();
    }
  });
  
  if (!participant) {
    return 0;
  }
  
  const count = await Message.countDocuments({
    conversation: this._id,
    createdAt: { $gt: participant.lastRead },
    sender: { $ne: userId },
    isDeleted: { $ne: true }
  });
  
  return count;
};

// Mark messages as read for a user
conversationSchema.methods.markAsRead = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  if (participant) {
    const oldLastRead = participant.lastRead;
    participant.lastRead = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Add participant to conversation
conversationSchema.methods.addParticipant = function(userId, role = 'member') {
  const existingParticipant = this.participants.find(p => p.user.toString() === userId.toString());
  
  if (existingParticipant) {
    return Promise.resolve(this);
  }
  
  this.participants.push({
    user: userId,
    role: role,
    joinedAt: new Date(),
    lastRead: new Date()
  });
  
  return this.save();
};

// Remove participant from conversation (mark as left instead of removing)
conversationSchema.methods.removeParticipant = function(userId) {
  // Find the participant and mark them as left instead of removing them
  const participant = this.participants.find(p => p.user?._id?.toString() === userId.toString());
  if (participant) {
    participant.isHidden = true;
    participant.hiddenAt = new Date();
    participant.leftAt = new Date(); // Add leftAt timestamp
  }
  
  // Also remove from admins array if they were an admin
  this.admins = this.admins.filter(adminId => adminId?._id?.toString() !== userId.toString());
  
  return this.save();
};

// Check if user is participant
conversationSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.user._id ? p.user._id.toString() === userId.toString() : p.user.toString() === userId.toString());
};

// FIXED: Check if user is admin (main admin OR in admins array)
conversationSchema.methods.isAdmin = function(userId) {
  if (this.type === 'direct') return false;
  
  // Check main admin
  if (this.admin && this.admin._id.toString() === userId.toString()) {
    return true;
  }
  
  // Check admins array
  if (this.admins && this.admins.length > 0) {
    return this.admins.some(adminId => adminId._id.toString() === userId.toString());
  }
  
  return false;
};

// Update last message
conversationSchema.methods.updateLastMessage = function(messageData) {
  this.lastMessage = {
    content: messageData.content,
    _id: messageData._id,
    sender: messageData.sender,
    timestamp: messageData.timestamp || messageData.createdAt || new Date(),
    messageType: messageData.messageType || 'text',
    fileInfo: messageData.fileInfo
  };
  this.updatedAt = new Date();
  return this.save();
};

// Find conversations for a user
conversationSchema.statics.findUserConversations = function(userId) {
  return this.find({
    'participants.user': userId
  })
  .populate('participants.user', 'name email avatar status lastSeen isOnline')
  .populate('admin', 'name email avatar')
  .populate('admins', 'name email avatar')
  .populate('lastMessage.sender', 'name avatar')
  .sort({ updatedAt: -1 });
};

// Find or create direct conversation
conversationSchema.statics.findOrCreateDirect = async function(user1Id, user2Id) {
  // Check if conversation already exists
  let conversation = await this.findOne({
    type: 'direct',
    'participants.user': { $all: [user1Id, user2Id] }
  }).populate('participants.user', 'name email avatar status lastSeen isOnline');
  
  if (!conversation) {
    // Create new direct conversation
    conversation = new this({
      type: 'direct',
      participants: [
        { user: user1Id, role: 'member' },
        { user: user2Id, role: 'member' }
      ]
    });
    
    await conversation.save();
    await conversation.populate('participants.user', 'name email avatar status lastSeen isOnline');
  }
  
  return conversation;
};

// Create group conversation
conversationSchema.statics.createGroup = async function(creatorId, participantIds, name, options = {}) {
  const { description, avatar, admins = [] } = options;
  
  // Prepare participants with proper roles
  const participants = [
    { user: creatorId, role: 'admin' } // Creator is always admin
  ];
  
  // Add other participants
  participantIds.forEach(participantId => {
    if (participantId !== creatorId) { // Don't duplicate creator
      const role = admins.includes(participantId) ? 'admin' : 'member';
      participants.push({ user: participantId, role });
    }
  });
  
  const conversation = new this({
    type: 'group',
    name,
    description: description || '',
    admin: creatorId, // Main admin
    admins: admins.filter(id => id !== creatorId), // Additional admins (exclude creator)
    participants,
    avatar: avatar || '👥'
  });
  
  await conversation.save();
  return conversation;
};

// Create broadcast conversation
conversationSchema.statics.createBroadcast = async function(creatorId, subscriberIds, name, options = {}) {
  const { description, avatar, admins = [] } = options;
  
  // Prepare participants - creator and additional admins have admin role
  const participants = [
    { user: creatorId, role: 'admin' } // Creator is always admin
  ];
  
  // Add subscribers and admins
  subscriberIds.forEach(subscriberId => {
    if (subscriberId !== creatorId) { // Don't duplicate creator
      const role = admins.includes(subscriberId) ? 'admin' : 'member';
      participants.push({ user: subscriberId, role });
    }
  });
  
  const conversation = new this({
    type: 'broadcast',
    name,
    description: description || '',
    admin: creatorId, // Main admin
    admins: admins.filter(id => id !== creatorId), // Additional admins (exclude creator)
    participants,
    avatar: avatar || '📢'
  });
  
  await conversation.save();
  return conversation;
};

module.exports = mongoose.model('Conversation', conversationSchema);