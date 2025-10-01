// routes/users.js
const express = require('express');
const { body, query, validationResult } = require('express-validator');

const User = require('../models/User');
const Conversation = require('../models/Conversation');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/search-by-email
// @desc    Search user by email address
// @access  Private
router.get('/search', auth, [
  query('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email } = req.query;
    const currentUserId = req.user.id;

    // Find user by email (excluding current user)
    const user = await User.findOne({ 
      email, 
      _id: { $ne: currentUserId } 
    }).select('name email avatar status lastSeen isOnline bio');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update current user's last seen (since they're active)
    req.user.lastSeen = new Date();
    await req.user.save();

    res.json({
      success: true,
      users: [user.getPublicProfile()] // Use the model method for consistency
    });

  } catch (error) {
    console.error('Search user by email error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching user'
    });
  }
});

// @route   GET /api/users
// @desc    Get all users with pagination and search
// @access  Private
router.get('/', auth, [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search query must not be empty')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search;
    const skip = (page - 1) * limit;

    let query = { _id: { $ne: req.user.id } };

    // Add search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    const users = await User.find(query)
      .select('name email avatar status lastSeen isOnline bio')
      .skip(skip)
      .limit(limit)
      .sort({ name: 1 });

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    // Update current user's last seen
    req.user.lastSeen = new Date();
    await req.user.save();

    // Convert users to public profiles
    const publicUsers = users.map(user => user.getPublicProfile());

    res.json({
      success: true,
      users: publicUsers,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// @route   GET /api/users/online
// @desc    Get online users
// @access  Private
router.get('/online', auth, async (req, res) => {
  try {
    // Get online users from Socket.IO service
    const socketOnlineUserIds = req.socketService ? req.socketService.getOnlineUserIds() : [];
    
    // Also get users with online status from database (backup)
    const dbOnlineQuery = {
      isOnline: true,
      _id: { $ne: req.user.id }
    };

    // Combine socket and database online users
    const allOnlineUserIds = new Set([...socketOnlineUserIds]);
    
    // Get users that are either in socket list or marked online in DB
    const onlineUsers = await User.find({
      $or: [
        { _id: { $in: Array.from(allOnlineUserIds) } },
        dbOnlineQuery
      ],
      _id: { $ne: req.user.id }
    }).select('name email avatar status lastSeen isOnline');

    // Update current user's last seen
    req.user.lastSeen = new Date();
    await req.user.save();

    // Convert to public profiles
    const publicOnlineUsers = onlineUsers.map(user => user.getPublicProfile());

    res.json({
      success: true,
      onlineUsers: publicOnlineUsers,
      count: publicOnlineUsers.length
    });

  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching online users'
    });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Validate ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const user = await User.findById(userId)
      .select('name email avatar status lastSeen isOnline bio phone');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update current user's last seen
    req.user.lastSeen = new Date();
    await req.user.save();

    res.json({
      success: true,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user'
    });
  }
});

// @route   PUT /api/users/status
// @desc    Update user status (online, away, offline, busy)
// @access  Private
router.put('/status', auth, [
  body('status')
    .isIn(['online', 'away', 'offline', 'busy'])
    .withMessage('Status must be online, away, offline, or busy')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status } = req.body;

    // Update user status directly from req.user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user status
    user.status = status;
    user.isOnline = status !== 'offline';
    user.lastSeen = new Date();
    await user.save();

    // Broadcast status update via Socket.IO
    if (req.socketService) {
      req.socketService.io.emit('user_status_update', {
        userId: req.user.id,
        status,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      status: user.status,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating status'
    });
  }
});

// @route   POST /api/users/:id/conversation
// @desc    Create or get direct conversation with user
// @access  Private
router.post('/:id/conversation', auth, async (req, res) => {
  try {
    const otherUserId = req.params.id;
    const currentUserId = req.user.id;

    // Validate ObjectId format
    if (!otherUserId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Check if the other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow conversation with self
    if (otherUserId === currentUserId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create conversation with yourself'
      });
    }

    // Check if direct conversation already exists
    let conversation = await Conversation.findOne({
      type: 'direct',
      'participants.user': { $all: [currentUserId, otherUserId] }
    })
    .populate('participants.user', 'name email avatar status lastSeen isOnline')
    .populate('lastMessage.sender', 'name avatar');

    if (!conversation) {
      // Create new direct conversation
      conversation = new Conversation({
        type: 'direct',
        participants: [
          { user: currentUserId, role: 'member' },
          { user: otherUserId, role: 'member' }
        ]
      });

      await conversation.save();
      await conversation.populate('participants.user', 'name email avatar status lastSeen isOnline');
    }

    // Update current user's last seen
    req.user.lastSeen = new Date();
    await req.user.save();

    // Emit conversation created event via Socket.IO
    if (req.socketService) {
      // Get creator info
      const creator = await User.findById(currentUserId).select('name email avatar');
      
      // Notify both participants
      req.socketService.sendNotificationToUser(currentUserId, 'conversation_created', {
        conversation: conversation.toObject(),
        createdBy: creator
      });
      req.socketService.sendNotificationToUser(otherUserId, 'conversation_created', {
        conversation: conversation.toObject(),
        createdBy: creator
      });
    }

    res.json({
      success: true,
      message: 'Conversation retrieved successfully',
      conversation
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating conversation'
    });
  }
});

// @route   GET /api/users/:id/mutual-conversations
// @desc    Get mutual conversations with a user
// @access  Private
router.get('/:id/mutual-conversations', auth, async (req, res) => {
  try {
    const otherUserId = req.params.id;
    const currentUserId = req.user.id;

    // Validate ObjectId format
    if (!otherUserId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    // Check if the other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Find mutual group conversations
    const mutualConversations = await Conversation.find({
      type: 'group',
      'participants.user': { $all: [currentUserId, otherUserId] }
    })
    .populate('participants.user', 'name avatar status')
    .populate('admin', 'name avatar')
    .select('name description participants admin createdAt type');

    // Update current user's last seen
    req.user.lastSeen = new Date();
    await req.user.save();

    res.json({
      success: true,
      conversations: mutualConversations,
      count: mutualConversations.length
    });

  } catch (error) {
    console.error('Get mutual conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching mutual conversations'
    });
  }
});

// @route   GET /api/users/me/contacts
// @desc    Get user's contact list (users they've chatted with)
// @access  Private
router.get('/me/contacts', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Find all conversations the user is part of
    const conversations = await Conversation.find({
      'participants.user': currentUserId
    })
    .populate('participants.user', 'name email avatar status lastSeen isOnline bio')
    .populate('lastMessage.sender', 'name avatar');

    // Extract unique contacts
    const contactsMap = new Map();

    conversations.forEach(conversation => {
      if (conversation.type === 'direct') {
        // For direct conversations, add the other participant
        const otherParticipant = conversation.participants.find(
          p => p.user._id.toString() !== currentUserId
        );
        
        if (otherParticipant && otherParticipant.user) {
          const contact = otherParticipant.user;
          contactsMap.set(contact._id.toString(), {
            ...contact.getPublicProfile(),
            lastInteraction: conversation.lastMessage?.timestamp || conversation.updatedAt,
            conversationId: conversation._id,
            conversationType: 'direct'
          });
        }
      } else {
        // For group conversations, add all other participants
        conversation.participants.forEach(participant => {
          if (participant.user._id.toString() !== currentUserId) {
            const contact = participant.user;
            const existingContact = contactsMap.get(contact._id.toString());
            const lastInteraction = conversation.lastMessage?.timestamp || conversation.updatedAt;
            
            if (!existingContact || lastInteraction > existingContact.lastInteraction) {
              contactsMap.set(contact._id.toString(), {
                ...contact.getPublicProfile(),
                lastInteraction,
                conversationId: conversation._id,
                conversationType: 'group'
              });
            }
          }
        });
      }
    });

    // Convert map to array and sort by last interaction
    const contacts = Array.from(contactsMap.values())
      .sort((a, b) => new Date(b.lastInteraction) - new Date(a.lastInteraction));

    // Update current user's last seen
    req.user.lastSeen = new Date();
    await req.user.save();

    res.json({
      success: true,
      contacts,
      count: contacts.length
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching contacts'
    });
  }
});

// @route   GET /api/users/me/profile
// @desc    Get current user's full profile
// @access  Private
router.get('/me/profile', auth, async (req, res) => {
  try {
    // Get fresh user data from database
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update last seen
    user.lastSeen = new Date();
    await user.save();

    res.json({
      success: true,
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    });
  }
});

// @route   PUT /api/users/me/profile
// @desc    Update current user's profile
// @access  Private
router.put('/me/profile', auth, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio must not exceed 500 characters'),
  body('phone')
    .optional()
    .trim(),
  body('avatar')
    .optional()
    .trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, avatar, bio, phone } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update fields if provided
    if (name !== undefined) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    if (bio !== undefined) user.bio = bio;
    if (phone !== undefined) user.phone = phone;

    user.lastSeen = new Date();
    await user.save();

    const userResponse = user.getPublicProfile();

    // Broadcast profile update via Socket.IO
    if (req.socketService) {
      req.socketService.io.emit('user_profile_updated', {
        userId: user._id.toString(),
        user: userResponse
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update'
    });
  }
});

// @route   GET /api/users/me/blocked
// @desc    Get current user's blocked users list
// @access  Private
router.get('/me/blocked', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id)
      .populate('blockedUsers', 'name email avatar status lastSeen isOnline bio');

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update current user's last seen
    currentUser.lastSeen = new Date();
    await currentUser.save();

    // Convert blocked users to public profiles
    const blockedUsers = currentUser.blockedUsers.map(user => user.getPublicProfile());

    res.json({
      success: true,
      blockedUsers,
      count: blockedUsers.length
    });

  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching blocked users'
    });
  }
});

// @route   POST /api/users/:userId/block
// @desc    Block a user
// @access  Private
router.post('/:userId/block', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Validate ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    if (userId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot block yourself'
      });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize blocked users array if it doesn't exist
    if (!currentUser.blockedUsers) {
      currentUser.blockedUsers = [];
    }

    const isAlreadyBlocked = currentUser.blockedUsers.includes(userId);

    if (isAlreadyBlocked) {
      return res.status(400).json({
        success: false,
        message: 'User is already blocked'
      });
    }

    // Block user
    currentUser.blockedUsers.push(userId);
    currentUser.lastSeen = new Date();
    await currentUser.save();

    // Removed block notification events

    res.json({
      success: true,
      isBlocked: true,
      message: 'User blocked successfully',
      blockedUser: targetUser.getPublicProfile()
    });

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while blocking user'
    });
  }
});

// @route   POST /api/users/:userId/unblock
// @desc    Unblock a user
// @access  Private
router.post('/:userId/unblock', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Validate ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    if (userId === currentUserId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot unblock yourself'
      });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(userId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Initialize blocked users array if it doesn't exist
    if (!currentUser.blockedUsers) {
      currentUser.blockedUsers = [];
    }

    const isBlocked = currentUser.blockedUsers.includes(userId);

    if (!isBlocked) {
      return res.status(400).json({
        success: false,
        message: 'User is not blocked'
      });
    }

    // Unblock user
    currentUser.blockedUsers = currentUser.blockedUsers.filter(
      id => id.toString() !== userId
    );
    currentUser.lastSeen = new Date();
    await currentUser.save();

    // Removed unblock notification events

    res.json({
      success: true,
      isBlocked: false,
      message: 'User unblocked successfully',
      unblockedUser: targetUser.getPublicProfile()
    });

  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while unblocking user'
    });
  }
});

// @route   GET /api/users/:userId/block-status
// @desc    Check if a user is blocked
// @access  Private
router.get('/:userId/block-status', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    // Validate ObjectId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }

    // Initialize blocked users array if it doesn't exist
    if (!currentUser.blockedUsers) {
      currentUser.blockedUsers = [];
    }

    const isBlocked = currentUser.blockedUsers.includes(userId);
    const isBlockedBy = targetUser.blockedUsers && targetUser.blockedUsers.includes(currentUserId.toString());

    // Update current user's last seen
    currentUser.lastSeen = new Date();
    await currentUser.save();

    res.json({
      success: true,
      isBlocked, // Current user has blocked the target user
      isBlockedBy, // Current user is blocked by the target user
      canInteract: !isBlocked && !isBlockedBy
    });

  } catch (error) {
    console.error('Check block status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking block status'
    });
  }
});

module.exports = router;