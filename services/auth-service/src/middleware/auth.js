const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Authentication middleware - validates JWT and attaches user to request
 * Used for protected routes within the auth service (e.g. /me)
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication token is required' }
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_TOKEN', message: error.message || 'Invalid or expired token' }
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User associated with token not found' }
      });
    }
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: 'ACCOUNT_DEACTIVATED', message: 'User account is deactivated' }
      });
    }

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
      error: { code: 'AUTHENTICATION_ERROR', message: 'Authentication failed', details: error.message }
    });
  }
};

module.exports = { authenticate };
