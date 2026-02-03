const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Authentication middleware
 * Validates JWT token and attaches user to request object
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication token is required'
        }
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: error.message || 'Invalid or expired token'
        }
      });
    }

    // Get user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User associated with token not found'
        }
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'ACCOUNT_DEACTIVATED',
          message: 'User account is deactivated'
        }
      });
    }

    // Attach user to request object
    req.user = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      department: user.department,
      firstName: user.firstName,
      lastName: user.lastName
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed',
        details: error.message
      }
    });
  }
};

module.exports = {
  authenticate
};

