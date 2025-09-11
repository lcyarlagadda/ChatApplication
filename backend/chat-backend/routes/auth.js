// routes/auth.js - REMOVED ALL VERIFICATION CODES
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Email configuration
const emailConfig = {
  service: 'gmail', // Change to your email provider
  auth: {
    user: process.env.EMAIL_USER || "ylc5215@gmail.com", // Your email
    pass: process.env.EMAIL_PASS || "bjtx pgct hvfe qbin" // Your email password or app password
  }
};

// Create email transporter
const transporter = nodemailer.createTransport(emailConfig);

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Email templates - REMOVED VERIFICATION CODES
const emailTemplates = {
  verification: (userName, verificationLink) => ({
    subject: 'Verify Your ChatApp Account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #4a6baf; margin-bottom: 10px;">Welcome to ChatApp!</h1>
          <p style="color: #666; font-size: 16px;">Thanks for joining our community, ${userName}!</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #333; margin-bottom: 15px;">Verify Your Email Address</h2>
          <p style="color: #666; line-height: 1.6;">
            To complete your registration and start using ChatApp, please verify your email address by clicking the button below:
          </p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${verificationLink}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 12px 30px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: bold;
                      display: inline-block;">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            If the button doesn't work, you can also copy and paste this link into your browser:
            <br>
            <a href="${verificationLink}" style="color: #4a6baf; word-break: break-all;">${verificationLink}</a>
          </p>
        </div>
        
        <div style="color: #999; font-size: 14px; line-height: 1.6;">
          <p><strong>This verification link will expire in 24 hours.</strong></p>
          <p>If you didn't create an account with ChatApp, you can safely ignore this email.</p>
          <p>For questions or support, please contact us at <a href="mailto:support@chatapp.com" style="color: #4a6baf;">support@chatapp.com</a></p>
        </div>
        
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ChatApp. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  passwordReset: (userName, resetLink) => ({
    subject: 'Reset Your ChatApp Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #dc3545; margin-bottom: 10px;">Password Reset Request</h1>
          <p style="color: #666; font-size: 16px;">Hi ${userName}, we received a request to reset your password.</p>
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #856404; margin-bottom: 15px;">Reset Your Password</h2>
          <p style="color: #856404; line-height: 1.6;">
            Click the button below to reset your password. This link will expire in 1 hour for security reasons.
          </p>
          
          <div style="text-align: center; margin: 25px 0;">
            <a href="${resetLink}" 
               style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); 
                      color: white; 
                      padding: 12px 30px; 
                      text-decoration: none; 
                      border-radius: 6px; 
                      font-weight: bold;
                      display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #856404; font-size: 14px; margin-top: 20px;">
            If the button doesn't work, copy and paste this link into your browser:
            <br>
            <a href="${resetLink}" style="color: #dc3545; word-break: break-all;">${resetLink}</a>
          </p>
        </div>
        
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
          <p style="color: #721c24; margin: 0; font-size: 14px;">
            <strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. 
            Your password will remain unchanged, and you should consider changing it as a precaution.
          </p>
        </div>
        
        <div style="color: #999; font-size: 14px; line-height: 1.6;">
          <p><strong>This reset link will expire in 1 hour.</strong></p>
          <p>For security reasons, this link can only be used once.</p>
          <p>If you continue to have problems, please contact us at <a href="mailto:support@chatapp.com" style="color: #dc3545;">support@chatapp.com</a></p>
        </div>
        
        <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ChatApp. All rights reserved.</p>
        </div>
      </div>
    `
  })
};

// Helper function to send emails
const sendEmail = async (to, template) => {
  try {
    const mailOptions = {
      from: `"ChatApp" <${process.env.EMAIL_USER || emailConfig.auth.user}>`,
      to: to,
      subject: template.subject,
      html: template.html
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};

// Generate JWT token with shorter expiry for access token
const generateAccessToken = (userId) => {
  return jwt.sign({ userId, type: 'access' }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '1h' // 1 hour for access token
  });
};

// Generate refresh token with longer expiry
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId, type: 'refresh' }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '7d' // 7 days for refresh token
  });
};

// Generate both tokens
const generateTokens = (userId) => {
  return {
    accessToken: generateAccessToken(userId),
    refreshToken: generateRefreshToken(userId)
  };
};

// Test route
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

// @route   POST /api/auth/register
// @desc    Register a new user with email verification
// @access  Public
router.post('/register', [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
], async (req, res) => {
  try {
    console.log('Register route hit with data:', req.body);
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password, avatar, bio, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.isEmailVerified) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      } else {
        // User exists but email not verified, resend verification
        const verificationToken = crypto.randomBytes(32).toString('hex');
        
        existingUser.verificationToken = verificationToken;
        existingUser.verificationCode = undefined; // Remove code
        existingUser.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        
        await existingUser.save();

        // Generate verification link with verifyToken parameter
        const verificationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?verifyToken=${verificationToken}`;

        // Send verification email (no code)
        const emailTemplate = emailTemplates.verification(existingUser.name, verificationLink);
        await sendEmail(email, emailTemplate);

        return res.json({
          success: true,
          message: 'Account already exists but not verified. A new verification email has been sent.',
          emailVerificationRequired: true,
          email: email
        });
      }
    }

    // Generate verification token only (no code)
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user (not verified initially)
    const user = new User({
      name,
      email,
      password,
      avatar: avatar || '👤',
      bio: bio || '',
      phone: phone || '',
      verificationToken,
      verificationCode: undefined, // Remove code
      verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      isEmailVerified: false,
      status: 'offline',
      isOnline: false
    });

    await user.save();

    // Generate verification link with verifyToken parameter
    const verificationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?verifyToken=${verificationToken}`;

    // Send verification email
    try {
      const emailTemplate = emailTemplates.verification(name, verificationLink);
      await sendEmail(email, emailTemplate);

      res.status(201).json({
        success: true,
        message: 'Registration successful! Please check your email to verify your account before signing in.',
        emailVerificationRequired: true,
        email: email
      });
    } catch (emailError) {
      // If email fails, delete the user and return error
      await User.findByIdAndDelete(user._id);
      console.error('Failed to send verification email:', emailError);
      
      res.status(500).json({
        success: false,
        message: 'Registration failed. Unable to send verification email. Please try again.'
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify user email with token only (no code)
// @access  Public
router.post('/verify-email', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('token')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Token cannot be empty')
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

    const { email, token } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    console.log('Verification attempt for:', email);
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification request'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Check if verification token is expired
    if (Date.now() > user.verificationTokenExpires) {
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired. Please request a new one.'
      });
    }

    // Verify using token only
    if (!token || token !== user.verificationToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Mark email as verified and generate tokens
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationCode = undefined; // Remove code
    user.verificationTokenExpires = undefined;
    user.status = 'online';
    user.isOnline = true;

    const tokens = generateTokens(user._id);
    const refreshTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    user.refreshTokenHash = refreshTokenHash;

    await user.save();

    const userResponse = user.getPublicProfile();

    res.json({
      success: true,
      message: 'Email verified successfully! You are now logged in.',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userResponse,
      expiresIn: 3600
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification'
    });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email
// @access  Public
router.post('/resend-verification', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
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

    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a verification email has been sent'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // Generate new verification token only (no code)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    user.verificationToken = verificationToken;
    user.verificationCode = undefined; // Remove code
    user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    
    await user.save();

    // Generate verification link with verifyToken parameter
    const verificationLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?verifyToken=${verificationToken}`;

    // Send verification email (no code)
    const emailTemplate = emailTemplates.verification(user.name, verificationLink);
    await sendEmail(email, emailTemplate);

    res.json({
      success: true,
      message: 'Verification email sent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending verification email'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user (only if email is verified)
// @access  Public
router.post('/login', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .exists()
    .withMessage('Password is required')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email address before logging in. Check your inbox for verification instructions.',
        emailVerificationRequired: true,
        email: email
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update user status to online
    user.status = 'online';
    user.isOnline = true;
    user.lastSeen = new Date();

    // Generate tokens
    const tokens = generateTokens(user._id);

    // Store refresh token hash
    const refreshTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    user.refreshTokenHash = refreshTokenHash;
    
    await user.save();

    // Return user data without password
    const userResponse = user.getPublicProfile();

    res.json({
      success: true,
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: userResponse,
      expiresIn: 3600 // 1 hour in seconds
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset with email
// @access  Public
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
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

    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    console.log("user", user);
    if (!user || !user.isEmailVerified) {
      // Don't reveal if email exists or not
      return res.json({
        success: true,
        message: 'If an account with that email exists, password reset instructions have been sent'
      });
    }

    // Generate reset token only (no code)
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    user.resetPasswordToken = resetToken;
    user.resetPasswordCode = undefined; // Remove code
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    // Generate reset link with resetToken parameter
    const resetLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?resetToken=${resetToken}`;

    // Send password reset email
    try {
      const emailTemplate = emailTemplates.passwordReset(user.name, resetLink);
      await sendEmail(email, emailTemplate);

      console.log(`Password reset initiated for ${email}`);
      console.log(`Reset token: ${resetToken}`);

      res.json({
        success: true,
        message: 'Password reset instructions have been sent to your email'
      });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
      
      // Clear reset tokens if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordCode = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(500).json({
        success: false,
        message: 'Failed to send password reset email. Please try again.'
      });
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset request'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token only (no code)
// @access  Public
router.post('/reset-password', [
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  body('token')
    .exists()
    .isLength({ min: 1 })
    .withMessage('Token is required')
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

    const { token, newPassword } = req.body;

    // Reset using token only
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Update password and clear reset tokens and refresh tokens
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokenHash = undefined; // Force re-login

    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset'
    });
  }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh access token using refresh token
// @access  Public
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'your-secret-key');
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }

    // Check if it's a refresh token
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify refresh token hash (optional security check)
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    if (user.refreshTokenHash && user.refreshTokenHash !== refreshTokenHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id);

    // Update user activity
    user.lastSeen = new Date();
    user.isOnline = true;
    await user.save();

    const userResponse = user.getPublicProfile();

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      accessToken: newAccessToken,
      user: userResponse,
      expiresIn: 3600 // 1 hour in seconds
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token refresh'
    });
  }
});

//@route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.status = 'offline';
      user.isOnline = false;
      user.lastSeen = new Date();
      
      // Clear refresh token hash
      user.refreshTokenHash = undefined;
      
      await user.save();

      // Broadcast user offline status via Socket.IO
      if (req.socketService) {
        req.socketService.broadcastUserOffline(req.user._id.toString());
      }
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// @route   POST /api/auth/logout-all
// @desc    Logout user from all devices
// @access  Private
router.post('/logout-all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      user.status = 'offline';
      user.isOnline = false;
      user.lastSeen = new Date();
      
      // Clear all refresh tokens
      user.refreshTokenHash = undefined;
      
      await user.save();

      // Broadcast user offline status via Socket.IO
      if (req.socketService) {
        req.socketService.broadcastUserOffline(req.user._id.toString());
      }
    }

    res.json({
      success: true,
      message: 'Logged out from all devices'
    });

  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
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

    const userResponse = user.getPublicProfile();

    res.json({
      success: true,
      user: userResponse
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/auth/verify-token
// @desc    Verify JWT token and return user info
// @access  Private
router.post('/verify-token', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user online status
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const userResponse = user.getPublicProfile();

    res.json({
      success: true,
      message: 'Token is valid',
      user: userResponse
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token verification'
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, [
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
    .trim()
], async (req, res) => {
  try {
    // Check for validation errors
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

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, [
  body('currentPassword')
    .exists()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password and clear refresh tokens (force re-login)
    user.password = newPassword;
    user.refreshTokenHash = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change'
    });
  }
});

// @route   DELETE /api/auth/delete-account
// @desc    Delete user account
// @access  Private
router.delete('/delete-account', auth, [
  body('password')
    .exists()
    .withMessage('Password is required to delete account')
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

    const { password } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Delete user account
    await User.findByIdAndDelete(req.user._id);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during account deletion'
    });
  }
});

module.exports = router;