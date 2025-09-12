// models/User.js - UPDATED with missing auth fields
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxLength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minLength: [6, 'Password must be at least 6 characters']
  },
  avatar: {
    type: String,
    default: '👤'
  },
  bio: {
    type: String,
    default: '',
    maxLength: [500, 'Bio cannot exceed 500 characters']
  },
  phone: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['online', 'away', 'offline', 'busy'],
    default: 'offline'
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // EMAIL VERIFICATION FIELDS - ADDED/UPDATED
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    default: undefined
  },
  verificationCode: {
    type: String,
    default: undefined
  },
  verificationTokenExpires: {
    type: Date,
    default: undefined
  },
  
  // PASSWORD RESET FIELDS - ADDED/UPDATED
  resetPasswordToken: {
    type: String,
    default: undefined
  },
  resetPasswordCode: {
    type: String,
    default: undefined
  },
  resetPasswordExpires: {
    type: Date,
    default: undefined
  },
  
  // SESSION MANAGEMENT FIELDS
  refreshTokenHash: {
    type: String,
    default: undefined
  },
  
  // Socket.IO tracking
  socketId: {
    type: String,
    default: null
  },
  
  // Multiple device support
  activeSessions: [{
    refreshTokenHash: String,
    deviceInfo: String,
    ipAddress: String,
    lastActive: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ isOnline: 1 });
userSchema.index({ status: 1 });
userSchema.index({ lastSeen: 1 });
userSchema.index({ verificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ isEmailVerified: 1 });
userSchema.index({ 'activeSessions.refreshTokenHash': 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get public profile (exclude sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationToken;
  delete userObject.verificationCode;
  delete userObject.verificationTokenExpires;
  delete userObject.resetPasswordToken;
  delete userObject.resetPasswordCode;
  delete userObject.resetPasswordExpires;
  delete userObject.refreshTokenHash;
  delete userObject.activeSessions;
  delete userObject.socketId;
  delete userObject.__v;

    if (userObject.blockedUsers && Array.isArray(userObject.blockedUsers)) {
      userObject.blockedUsers = userObject.blockedUsers.map((id) =>
        id.toString()
      );
    } else {
      userObject.blockedUsers = [];
    }
  return userObject;
};

// EMAIL VERIFICATION METHODS - ADDED
userSchema.methods.generateEmailVerification = function() {
  const crypto = require('crypto');
  
  // Generate verification token (for email links)
  this.verificationToken = crypto.randomBytes(32).toString('hex');
  
  // Generate verification code (for manual entry)
  this.verificationCode = crypto.randomInt(100000, 999999).toString();
  
  // Set expiration (24 hours)
  this.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
  
  return {
    token: this.verificationToken,
    code: this.verificationCode
  };
};

userSchema.methods.clearEmailVerification = function() {
  this.verificationToken = undefined;
  this.verificationCode = undefined;
  this.verificationTokenExpires = undefined;
  this.isEmailVerified = true;
  return this.save();
};

userSchema.methods.isVerificationExpired = function() {
  return Date.now() > this.verificationTokenExpires;
};

// PASSWORD RESET METHODS - ADDED
userSchema.methods.generatePasswordReset = function() {
  const crypto = require('crypto');
  
  // Generate reset token (for email links)
  this.resetPasswordToken = crypto.randomBytes(32).toString('hex');
  
  // Generate reset code (for manual entry)
  this.resetPasswordCode = crypto.randomInt(100000, 999999).toString();
  
  // Set expiration (1 hour)
  this.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
  
  return {
    token: this.resetPasswordToken,
    code: this.resetPasswordCode
  };
};

userSchema.methods.clearPasswordReset = function() {
  this.resetPasswordToken = undefined;
  this.resetPasswordCode = undefined;
  this.resetPasswordExpires = undefined;
  return this.save();
};

userSchema.methods.isResetExpired = function() {
  return Date.now() > this.resetPasswordExpires;
};

// Update last seen
userSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  return this.save();
};

// Set user online
userSchema.methods.setOnline = function(socketId = null) {
  this.isOnline = true;
  this.status = 'online';
  this.lastSeen = new Date();
  if (socketId) {
    this.socketId = socketId;
  }
  return this.save();
};

// Set user offline
userSchema.methods.setOffline = function() {
  this.isOnline = false;
  this.status = 'offline';
  this.lastSeen = new Date();
  this.socketId = null;
  return this.save();
};

// Set custom status
userSchema.methods.setStatus = function(status) {
  this.status = status;
  this.isOnline = status !== 'offline';
  this.lastSeen = new Date();
  if (status === 'offline') {
    this.socketId = null;
  }
  return this.save();
};

// Add active session
userSchema.methods.addActiveSession = function(refreshTokenHash, deviceInfo = 'Unknown Device', ipAddress = 'Unknown IP') {
  // Remove existing session with same refresh token hash
  this.activeSessions = this.activeSessions.filter(
    session => session.refreshTokenHash !== refreshTokenHash
  );
  
  // Add new session
  this.activeSessions.push({
    refreshTokenHash,
    deviceInfo,
    ipAddress,
    lastActive: new Date(),
    createdAt: new Date()
  });
  
  // Keep only last 5 sessions per user
  if (this.activeSessions.length > 5) {
    this.activeSessions = this.activeSessions
      .sort((a, b) => b.lastActive - a.lastActive)
      .slice(0, 5);
  }
  
  return this.save();
};

// Remove active session
userSchema.methods.removeActiveSession = function(refreshTokenHash) {
  this.activeSessions = this.activeSessions.filter(
    session => session.refreshTokenHash !== refreshTokenHash
  );
  return this.save();
};

// Update session activity
userSchema.methods.updateSessionActivity = function(refreshTokenHash) {
  const session = this.activeSessions.find(
    session => session.refreshTokenHash === refreshTokenHash
  );
  
  if (session) {
    session.lastActive = new Date();
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Clear all sessions
userSchema.methods.clearAllSessions = function() {
  this.activeSessions = [];
  this.refreshTokenHash = undefined;
  return this.save();
};

// Get active sessions count
userSchema.methods.getActiveSessionsCount = function() {
  return this.activeSessions.length;
};

// Check if refresh token is valid
userSchema.methods.hasValidSession = function(refreshTokenHash) {
  return this.activeSessions.some(
    session => session.refreshTokenHash === refreshTokenHash
  );
};

// Static method: Find users by search query
userSchema.statics.searchUsers = function(query, excludeUserId, options = {}) {
  const searchRegex = new RegExp(query, 'i');
  const findQuery = {
    _id: { $ne: excludeUserId },
    isEmailVerified: true, // Only show verified users
    $or: [
      { name: searchRegex },
      { email: searchRegex }
    ]
  };
  
  return this.find(findQuery)
    .select('name email avatar status lastSeen isOnline bio')
    .limit(options.limit || 20)
    .skip(options.skip || 0)
    .sort({ name: 1 });
};

// Static method: Get online users
userSchema.statics.getOnlineUsers = function(excludeUserId) {
  return this.find({
    isOnline: true,
    isEmailVerified: true, // Only show verified users
    _id: { $ne: excludeUserId }
  }).select('name email avatar status lastSeen');
};

// Static method: Clean up expired verification tokens
userSchema.statics.cleanupExpiredTokens = function() {
  const now = new Date();
  
  return this.updateMany(
    {
      $or: [
        { verificationTokenExpires: { $lt: now } },
        { resetPasswordExpires: { $lt: now } }
      ]
    },
    {
      $unset: {
        verificationToken: 1,
        verificationCode: 1,
        verificationTokenExpires: 1,
        resetPasswordToken: 1,
        resetPasswordCode: 1,
        resetPasswordExpires: 1
      }
    }
  );
};

// Static method: Clean up expired sessions
userSchema.statics.cleanupExpiredSessions = function(olderThanDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  
  return this.updateMany(
    { 'activeSessions.lastActive': { $lt: cutoffDate } },
    { 
      $pull: { 
        activeSessions: { 
          lastActive: { $lt: cutoffDate } 
        } 
      } 
    }
  );
};

// Static method: Get users with multiple active sessions
userSchema.statics.getUsersWithMultipleSessions = function() {
  return this.aggregate([
    { $match: { 'activeSessions.1': { $exists: true } } },
    { 
      $project: {
        name: 1,
        email: 1,
        sessionCount: { $size: '$activeSessions' },
        activeSessions: 1
      }
    },
    { $sort: { sessionCount: -1 } }
  ]);
};

// Static method: Find unverified users older than X days
userSchema.statics.findUnverifiedUsers = function(olderThanDays = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  
  return this.find({
    isEmailVerified: false,
    createdAt: { $lt: cutoffDate }
  }).select('name email createdAt');
};

// Virtual for session info
userSchema.virtual('sessionInfo').get(function() {
  let sessionCount = this.activeSessions ? this.activeSessions.length : 0;
  return {
    activeSessionsCount: sessionCount,
    lastActiveSession: sessionCount > 0 
      ? this.activeSessions.reduce((latest, session) => 
          session.lastActive > latest.lastActive ? session : latest
        ).lastActive
      : null,
    hasMultipleSessions: sessionCount > 1
  };
});

// Virtual for verification status
userSchema.virtual('verificationStatus').get(function() {
  if (this.isEmailVerified) {
    return 'verified';
  } else if (this.verificationTokenExpires && Date.now() > this.verificationTokenExpires) {
    return 'expired';
  } else if (this.verificationToken) {
    return 'pending';
  } else {
    return 'not_started';
  }
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);