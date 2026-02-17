const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const User = require('../models/User');
const { sendError } = require('../../../../shared/http/responses');

/**
 * Authentication middleware - validates JWT and attaches user to request
 * Used for protected routes within the auth service (e.g. /me)
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    if (!token) {
      return sendError(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication token is required');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return sendError(res, 401, 'INVALID_TOKEN', error.message || 'Invalid or expired token');
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return sendError(res, 401, 'USER_NOT_FOUND', 'User associated with token not found');
    }
    if (!user.isActive) {
      return sendError(res, 401, 'ACCOUNT_DEACTIVATED', 'User account is deactivated');
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
    return sendError(res, 500, 'AUTHENTICATION_ERROR', 'Authentication failed', error.message);
  }
};

module.exports = { authenticate };
