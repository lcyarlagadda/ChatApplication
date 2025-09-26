// routes/messages.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { body, validationResult } = require('express-validator');
const cloudinary = require('../config/cloudinary');

// @route   GET /api/messages/:conversationId
// @desc    Get messages for a conversation
// @access  Private
router.get('/:conversationId', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Verify user is member of conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const isMember = conversation.participants.some(
      p => p.user.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get messages with pagination (newest first), excluding cleared messages for this user
    const messages = await Message.find({ 
      conversation: conversationId,
      clearedFor: { $ne: req.user.id }
    })
  .populate('sender', '_id name email avatar')
  .populate({
    path: 'replyTo',
    select: 'content messageType file sender createdAt',
    populate: {
      path: 'sender',
      select: '_id name avatar',
    },
  })
  .populate('reactions.user', 'name email avatar')
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .lean();


    // Reverse to show oldest first in the response
    messages.reverse();

    res.json({
      success: true,
      data: messages,
      messages, // Legacy support
      pagination: {
        page,
        limit,
        total: await Message.countDocuments({ conversation: conversationId })
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Backend API endpoint for message search
// Add this to your messages router (e.g., routes/messages.js)

// GET /api/messages/search - Search messages
router.get('/search', auth, async (req, res) => {
  try {
    const { q: query, conversationId, limit = 10, offset = 0 } = req.query;
    const userId = req.user._id;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    // Build search criteria
    let searchCriteria = {
      $or: [
        { content: { $regex: query, $options: 'i' } },
        { 'fileInfo.displayName': { $regex: query, $options: 'i' } },
        { 'fileInfo.originalName': { $regex: query, $options: 'i' } }
      ]
    };

    // If conversationId is specified, search only in that conversation
    if (conversationId) {
      // Verify user has access to this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      const hasAccess = conversation.participants.some(
        participant => participant.user.toString() === userId.toString()
      );

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this conversation'
        });
      }

      searchCriteria.conversation = conversationId;
    } else {
      // Search across all conversations user has access to
      const userConversations = await Conversation.find({
        'participants.user': userId
      }).select('_id');

      const conversationIds = userConversations.map(conv => conv._id);
      searchCriteria.conversation = { $in: conversationIds };
    }

    // Perform the search
    const messages = await Message.find(searchCriteria)
      .populate('sender', 'name email avatar')
      .populate('conversation', 'name type participants')
      .sort({ createdAt: -1 }) // Most recent first
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    // Filter out conversations where user doesn't have access (extra safety)
    const filteredMessages = messages.filter(message => {
      return message.conversation.participants.some(
        participant => participant.user.toString() === userId.toString()
      );
    });

    // Add search context (snippet with highlighted terms)
    const messagesWithContext = filteredMessages.map(message => {
      let snippet = '';
      let highlightedContent = '';

      if (message.content) {
        // Create snippet around the search term
        const content = message.content;
        const queryLower = query.toLowerCase();
        const contentLower = content.toLowerCase();
        const index = contentLower.indexOf(queryLower);

        if (index !== -1) {
          const start = Math.max(0, index - 50);
          const end = Math.min(content.length, index + query.length + 50);
          snippet = (start > 0 ? '...' : '') + 
                   content.substring(start, end) + 
                   (end < content.length ? '...' : '');

          // Highlight the search term
          const regex = new RegExp(`(${query})`, 'gi');
          highlightedContent = snippet.replace(regex, '**$1**');
        } else {
          snippet = content.substring(0, 100) + (content.length > 100 ? '...' : '');
          highlightedContent = snippet;
        }
      } else if (message.fileInfo) {
        // For file messages, show file name with highlighting
        const fileName = message.fileInfo.displayName || message.fileInfo.originalName || 'File';
        const regex = new RegExp(`(${query})`, 'gi');
        highlightedContent = fileName.replace(regex, '**$1**');
        snippet = `📎 ${fileName}`;
      }

      return {
        _id: message._id,
        content: message.content,
        messageType: message.messageType,
        fileInfo: message.fileInfo,
        sender: message.sender,
        conversation: {
          _id: message.conversation._id,
          name: message.conversation.name,
          type: message.conversation.type
        },
        createdAt: message.createdAt,
        snippet,
        highlightedContent,
        searchScore: calculateSearchScore(message, query)
      };
    });

    // Sort by search relevance
    messagesWithContext.sort((a, b) => b.searchScore - a.searchScore);

    res.json({
      success: true,
      messages: messagesWithContext,
      total: messagesWithContext.length,
      query,
      hasMore: messagesWithContext.length === parseInt(limit)
    });

  } catch (error) {
    console.error('Message search error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to calculate search relevance score
function calculateSearchScore(message, query) {
  let score = 0;
  const queryLower = query.toLowerCase();

  if (message.content) {
    const contentLower = message.content.toLowerCase();
    
    // Exact match in content (highest score)
    if (contentLower.includes(queryLower)) {
      score += 100;
      
      // Bonus for exact word match
      const words = contentLower.split(/\s+/);
      if (words.includes(queryLower)) {
        score += 50;
      }
      
      // Bonus for match at beginning
      if (contentLower.startsWith(queryLower)) {
        score += 25;
      }
    }
  }

  // File name matches
  if (message.fileInfo) {
    const fileName = (message.fileInfo.displayName || message.fileInfo.originalName || '').toLowerCase();
    if (fileName.includes(queryLower)) {
      score += 75;
      
      if (fileName.startsWith(queryLower)) {
        score += 25;
      }
    }
  }

  // Sender name matches
  if (message.sender && message.sender.name) {
    const senderName = message.sender.name.toLowerCase();
    if (senderName.includes(queryLower)) {
      score += 30;
    }
  }

  // Recent messages get slight boost
  const messageAge = Date.now() - new Date(message.createdAt).getTime();
  const dayInMs = 24 * 60 * 60 * 1000;
  if (messageAge < dayInMs) {
    score += 10;
  } else if (messageAge < 7 * dayInMs) {
    score += 5;
  }

  return score;
}

// GET /api/messages/search/suggestions - Get search suggestions
router.get('/search/suggestions', auth, async (req, res) => {
  try {
    const { q: query } = req.query;
    const userId = req.user._id;

    if (!query || query.trim().length < 2) {
      return res.json({
        success: true,
        suggestions: []
      });
    }

    // Get user's conversations
    const userConversations = await Conversation.find({
      'participants.user': userId
    }).select('_id');

    const conversationIds = userConversations.map(conv => conv._id);

    // Get recent unique words from user's messages
    const pipeline = [
      {
        $match: {
          conversation: { $in: conversationIds },
          content: { $exists: true, $ne: '' },
          messageType: 'text'
        }
      },
      {
        $project: {
          words: {
            $split: [
              {
                $toLower: '$content'
              },
              ' '
            ]
          }
        }
      },
      {
        $unwind: '$words'
      },
      {
        $match: {
          words: { 
            $regex: `^${query}`, 
            $options: 'i',
            $not: { $in: ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'] }
          }
        }
      },
      {
        $group: {
          _id: '$words',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 5
      }
    ];

    const suggestions = await Message.aggregate(pipeline);

    res.json({
      success: true,
      suggestions: suggestions.map(s => s._id)
    });

  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get search suggestions'
    });
  }
});


// routes/messages.js - Updated to handle GIFs as images

// Helper function to determine message type based on file info
function determineMessageType(fileInfo) {
  if (!fileInfo) return 'text';
  
  const mimeType = fileInfo.type || '';
  const fileName = fileInfo.originalName || '';
  const fileExtension = fileName.toLowerCase().split('.').pop();
  
  // Handle images (including GIFs) - GIFs are images!
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExtension)) {
    return 'image';
  }
  
  // Handle videos
  if (mimeType.startsWith('video/') || ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(fileExtension)) {
    return 'video';
  }
  
  // Handle audio
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(fileExtension)) {
    return 'audio';
  }
  
  // Handle PDFs
  if (mimeType === 'application/pdf' || fileExtension === 'pdf') {
    return 'pdf';
  }
  
  // Handle Excel files
  if (mimeType.includes('spreadsheet') || ['xlsx', 'xls', 'csv'].includes(fileExtension)) {
    return 'xlsx';
  }
  
  // Handle documents
  if (mimeType.includes('document') || mimeType.includes('word') || ['doc', 'docx', 'txt', 'rtf'].includes(fileExtension)) {
    return 'document';
  }
  
  // Default to file
  return 'file';
}


// @route   POST /api/messages/:conversationId
// @desc    Send a message (text or file URL)
// @access  Private
router.post('/:conversationId', auth, [
  body('content').trim().isLength({ min: 1 }).withMessage('Message content is required'),
  body('messageType').optional().isIn(['text', 'txt', 'image', 'file', 'video', 'audio', 'document', 'pdf', 'xlsx', 'system']),
  body('replyTo').optional().isMongoId().withMessage('Invalid reply message ID'),
  body('_id').optional().matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid ObjectId format'), // NEW: Accept client ID
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

    const { conversationId } = req.params;
    const { content, replyTo, fileInfo, _id: clientId } = req.body;
    let { messageType } = req.body;

    // Auto-determine message type if fileInfo is provided
    if (fileInfo) {
      messageType = determineMessageType(fileInfo);
    }

    if (!messageType) {
      messageType = 'text';
    }

    // Verify user is member of conversation
    const conversation = await Conversation.findById(conversationId)
      .populate('participants.user', 'name email avatar');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const isMember = conversation.participants.some(
      p => p.user._id.toString() === req.user.id
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate reply message if provided
    if (replyTo) {
      const replyMessage = await Message.findById(replyTo);
      if (!replyMessage || replyMessage.conversation.toString() !== conversationId) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reply message'
        });
      }
    }

    // Create message data
    const messageData = {
      sender: req.user.id,
      conversation: conversationId,
      content,
      messageType,
      createdAt: new Date(),
      edited: false
    };

    // Use client-generated ID if provided and valid
    if (clientId) {
      // Check if ID already exists (conflict detection)
      const existingMessage = await Message.findById(clientId);
      if (existingMessage) {
        return res.status(409).json({
          success: false,
          message: 'Message ID already exists',
          error: 'ID_CONFLICT'
        });
      }
      messageData._id = clientId;
    }

    // Add file info if present
    if (fileInfo && messageType !== 'text') {
      messageData.fileInfo = {
        originalName: fileInfo.originalName,
        url: fileInfo.url,
        size: fileInfo.size,
        type: fileInfo.type,
        displayName: fileInfo.displayName || fileInfo.originalName,
        fileSize: fileInfo.fileSize,
        cloudData: {
          publicId: fileInfo.publicId,
          deleteUrl: fileInfo.deleteUrl,
          thumbUrl: fileInfo.thumbUrl,
          width: fileInfo.width,
          height: fileInfo.height
        }
      };
    }

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const message = new Message(messageData);
    await message.save();

    // Populate sender and reply info
    await message.populate('sender', 'name email avatar status');
    if (replyTo) {
      await message.populate('replyTo');
      await message.populate('replyTo.sender', 'name avatar');
    }

    // Update conversation's last message
    let lastMessageContent = content;
    if (messageType !== 'text' && fileInfo) {
      lastMessageContent = `${fileInfo.displayName || fileInfo.originalName}`;
    }

    conversation.lastMessage = {
      content: lastMessageContent,
      _id: message._id,
      sender: message.sender._id,
      timestamp: message.createdAt,
      messageType
    };
    conversation.updatedAt = new Date();
    await conversation.save();

    // Emit real-time update via Socket.IO
    if (req.socketService) {
      req.socketService.sendNotificationToConversation(
        conversationId,
        'new_message',
        {
          conversationId,
          message: message.toObject()
        }
      );

      // Process delivery status for online users
      const otherParticipants = conversation.participants
        .filter(p => p.user._id.toString() !== req.user.id);
      
      const onlineParticipants = otherParticipants
        .filter(p => req.socketService.isUserOnline(p.user._id.toString()))
        .map(p => p.user._id.toString());
      
      if (onlineParticipants.length > 0) {
        await req.socketService.processMessageDelivery(message._id, onlineParticipants, req.user.id);
      }
    }

    res.status(201).json({
      success: true,
      data: message,
      message: 'Message sent successfully'
    });

  } catch (error) {
    console.error('Send message error:', error);
    
    // Handle duplicate key errors specially
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Message ID already exists',
        error: 'ID_CONFLICT'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while sending message'
    });
  }
});



// @route   PUT /api/messages/:messageId
// @desc    Edit a message
// @access  Private
router.put('/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    // Find message and verify ownership
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    if (message.sender.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to edit this message'
      });
    }

    // Check if message is too old to edit (15 minutes)
    const messageAge = Date.now() - message.createdAt.getTime();
    if (messageAge > 15 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message is too old to edit'
      });
    }

    // Update message
    message.content = content.trim();
    message.edited = true;
    message.editedAt = new Date();
    await message.save();

    // Emit real-time update via Socket.IO
    req.socketService.sendNotificationToConversation(
      message.conversation.toString(),
      'message_edited',
      {
        messageId,
        content: content.trim(),
        editedAt: message.editedAt
      }
    );

    res.json({
      success: true,
      data: message,
      message: 'Message edited successfully'
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});


// @route   DELETE /api/messages/:messageId
// @desc    Soft delete a message and its cloud file if exists, update conversation if needed
// @access  Private
router.delete('/:messageId', auth, async (req, res) => {
  try {
    const { messageId } = req.params;

    // Get message with sender + conversation populated
    const message = await Message.findById(messageId)
      .populate('sender', 'name')
      .populate('conversation');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const canDelete = message.sender._id.toString() === req.user.id || req.user.role === 'admin';

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages'
      });
    }

    // Delete Cloudinary file if applicable
    if (message.fileInfo?.cloudData?.publicId) {
      const publicId = message.fileInfo.cloudData.publicId;
      const resourceType = message.fileInfo.cloudData.resourceType || 'raw';

      try {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: resourceType
        });
        console.log(`Cloudinary file deleted: ${publicId}`);
      } catch (cloudErr) {
        console.warn(`Cloudinary deletion failed for ${publicId}`, cloudErr);
      }
    }

    await Message.findByIdAndDelete(messageId);

    const conversation = message.conversation;
    const lastMessageId = conversation.lastMessage?._id?.toString();
    console.log("Comparing ids", lastMessageId, message._id.toString());

    let newLastMessageData = null;

    // If the deleted message was the last message, update conversation
    if (lastMessageId === message._id.toString()) {
      const newLast = await Message.findOne({
        conversation: conversation._id,
      })
      .populate('sender', 'name') // Populate sender for socket event
      .sort({ createdAt: -1 });

      console.log(newLast);

      if (newLast) {
        // Prepare the last message data
        newLastMessageData = {
          content: newLast.content,
          _id: newLast._id,
          sender: newLast.sender,
          timestamp: newLast.createdAt,
          messageType: newLast.messageType,
          fileInfo: newLast.fileInfo // Include fileInfo for proper display
        };

        await Conversation.findByIdAndUpdate(conversation._id, {
          lastMessage: {
            content: newLast.content,
            _id: newLast._id,
            sender: newLast.sender._id,
            timestamp: newLast.createdAt,
            messageType: newLast.messageType,
            fileInfo: newLast.fileInfo
          }
        });
      } else {
        // No more messages left
        await Conversation.findByIdAndUpdate(conversation._id, {
          $unset: { lastMessage: "", lastMessageAt: "" }
        });
        newLastMessageData = null;
      }
    }

    // Emit socket event with conversation data
    if (req.socketService) {
      req.socketService.sendNotificationToConversation(
        conversation._id.toString(),
        'message_deleted',
        { 
          messageId,
          conversationId: conversation._id.toString(),
          newLastMessage: newLastMessageData // Include the new last message
        }
      );
    }

    return res.json({
      success: true,
      message: 'Message deleted successfully'
    });

  } catch (error) {
    console.error('Message delete error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting message'
    });
  }
});


// @route   POST /api/messages/:messageId/react
// @desc    React to a message
// @access  Private
// @route   POST /api/messages/:messageId/react
// @desc    React to a message
// @access  Private
router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body; // emoji can be null to remove all reactions from user

    // Find message
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Initialize reactions array if not exists
    if (!message.reactions) {
      message.reactions = [];
    }

    // Remove any existing reaction from this user first (ensure one reaction per user)
    message.reactions = message.reactions.filter(
      r => r.user.toString() !== req.user.id
    );

    // If emoji is provided and not null, add the new reaction
    if (emoji) {
      message.reactions.push({
        user: req.user.id,
        emoji,
        createdAt: new Date()
      });
    }

    await message.save();

    // Populate user info for reactions
    await message.populate('reactions.user', 'name email avatar');

    // Emit real-time update via Socket.IO
    req.socketService.sendNotificationToConversation(
      message.conversation.toString(),
      'message_reaction',
      {
        messageId,
        reactions: message.reactions
      }
    );

    res.json({
      success: true,
      data: message,
      message: 'Reaction updated successfully'
    });
  } catch (error) {
    console.error('React to message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// Add these routes to your existing routes/messages.js file

// @route   POST /api/messages/:messageId/delivered
// @desc    Mark message as delivered
// @access  Private
router.post('/:messageId/delivered', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user has access to this conversation
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't mark own messages as delivered
    if (message.sender.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark your own message as delivered'
      });
    }

    // Mark as delivered
    await message.markDelivered(userId);
    await message.populate('deliveredTo.user', 'name avatar');

    // Emit Socket.IO event
    if (req.socketService) {
      req.socketService.sendNotificationToConversation(
        message.conversation.toString(),
        'message_status_update',
        {
          messageId,
          status: message.status,
          timestamp: new Date(),
          deliveredTo: message.deliveredTo
        }
      );
    }

    res.json({
      success: true,
      data: {
        messageId,
        status: message.status,
        deliveredTo: message.deliveredTo
      },
      message: 'Message marked as delivered'
    });
  } catch (error) {
    console.error('Mark message delivered error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/messages/:messageId/seen
// @desc    Mark message as seen/read
// @access  Private
router.post('/:messageId/seen', auth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user has access to this conversation
    const conversation = await Conversation.findById(message.conversation);
    if (!conversation || !conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Don't mark own messages as read
    if (message.sender.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot mark your own message as read'
      });
    }

    // Mark as read (also marks as delivered if not already)
    if (!message.deliveredTo.some(d => d.user.toString() === userId)) {
      await message.markDelivered(userId);
    }
    await message.markRead(userId);
    await message.populate([
      { path: 'deliveredTo.user', select: 'name avatar' },
      { path: 'readBy.user', select: 'name avatar' }
    ]);

    // Emit Socket.IO event
    if (req.socketService) {
      req.socketService.sendNotificationToConversation(
        message.conversation.toString(),
        'message_status_update',
        {
          messageId,
          status: message.status,
          timestamp: new Date(),
          deliveredTo: message.deliveredTo,
          readBy: message.readBy
        }
      );
    }

    res.json({
      success: true,
      data: {
        messageId,
        status: message.status,
        deliveredTo: message.deliveredTo,
        readBy: message.readBy
      },
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark message seen error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/messages/bulk-seen
// @desc    Mark multiple messages as seen/read
// @access  Private
router.post('/bulk-seen', auth, async (req, res) => {
  try {
    const { messageIds, conversationId } = req.body;
    const userId = req.user.id;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message IDs array is required'
      });
    }

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required'
      });
    }

    // Check if user has access to this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update messages as delivered and read
    const updateResult = await Message.updateMany(
      {
        _id: { $in: messageIds },
        conversation: conversationId,
        sender: { $ne: userId }, // Don't update own messages
        isDeleted: { $ne: true }
      },
      {
        $addToSet: {
          deliveredTo: {
            user: userId,
            deliveredAt: new Date()
          },
          readBy: {
            user: userId,
            readAt: new Date()
          }
        },
        status: 'read'
      }
    );

    console.log(`👁️ Bulk read: ${updateResult.modifiedCount} messages in ${conversationId} by ${req.user.name}`);

    // Emit Socket.IO event
    if (req.socketService) {
      req.socketService.sendNotificationToConversation(
        conversationId,
        'messages_seen_bulk',
        {
          messageIds,
          conversationId,
          seenBy: userId,
          timestamp: new Date()
        }
      );
    }

    res.json({
      success: true,
      data: {
        conversationId,
        messageIds,
        modifiedCount: updateResult.modifiedCount
      },
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Bulk mark messages seen error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/messages/:conversationId/unread-count
// @desc    Get unread message count for a conversation
// @access  Private
router.get('/:conversationId/unread-count', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const unreadCount = await conversation.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        conversationId,
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/messages/:conversationId/typing/start
// @desc    Start typing indicator
// @access  Private
router.post('/:conversationId/typing/start', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Emit typing start via Socket.IO
    if (req.socketService) {
      req.socketService.handleTypingStart({
        userId,
        user: req.user
      }, {
        conversationId
      });
    }

    res.json({
      success: true,
      message: 'Typing started'
    });
  } catch (error) {
    console.error('Start typing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/messages/:conversationId/typing/stop
// @desc    Stop typing indicator
// @access  Private
router.post('/:conversationId/typing/stop', auth, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Check if user has access to this conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation || !conversation.isParticipant(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Emit typing stop via Socket.IO
    if (req.socketService) {
      req.socketService.handleTypingStop({
        userId,
        user: req.user
      }, {
        conversationId
      });
    }

    res.json({
      success: true,
      message: 'Typing stopped'
    });
  } catch (error) {
    console.error('Stop typing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;