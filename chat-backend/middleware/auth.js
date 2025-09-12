// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware to authenticate JWT tokens
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is required",
      });
    }

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );

    // Check if it's an access token (not refresh token)
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        message: "Invalid token type. Access token required.",
      });
    }

    // Get user from token
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token - user not found",
      });
    }

    // Add user to request object
    user.id = user._id.toString();
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        code: "INVALID_TOKEN"
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
        code: "TOKEN_EXPIRED"
      });
    }

    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

// Optional middleware for routes that work with or without authentication
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );

    if (decoded.type && decoded.type !== 'access') {
      req.user = null;
      return next();
    }

    const user = await User.findById(decoded.userId).select("-password");
    
    if (user) {
      user.id = user._id.toString();
      req.user = user;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // For optional auth, continue even if token is invalid
    req.user = null;
    next();
  }
};

// Middleware to check if user is admin (optional)
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

// Middleware to check if user owns the resource or is admin
const requireOwnershipOrAdmin = (resourceUserIdField = "userId") => {
  return (req, res, next) => {
    const resourceUserId =
      req.params[resourceUserIdField] || req.body[resourceUserIdField];

    if (req.user.id === resourceUserId || req.user.role === "admin") {
      next();
    } else {
      res.status(403).json({
        success: false,
        message: "You can only access your own resources",
      });
    }
  };
};

// Middleware to verify refresh token specifically
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token is required",
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_SECRET || "your-secret-key"
    );

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: "Invalid token type. Refresh token required.",
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token - user not found",
      });
    }

    req.user = user;
    req.refreshToken = refreshToken;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired",
      });
    }

    console.error("Refresh token verification error:", error);
    res.status(500).json({
      success: false,
      message: "Refresh token verification error",
    });
  }
};

// CORRECT WAY to export - export the main function as default and named exports
module.exports = authenticateToken;
module.exports.authenticateToken = authenticateToken;
module.exports.optionalAuth = optionalAuth;
module.exports.requireAdmin = requireAdmin;
module.exports.requireOwnershipOrAdmin = requireOwnershipOrAdmin;
module.exports.verifyRefreshToken = verifyRefreshToken;