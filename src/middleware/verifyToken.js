const jwt = require('jsonwebtoken');
const { sendError } = require('../../shared/http/responses');

/**
 * Lightweight JWT verification middleware for other microservices
 * Validates token issued by auth-service and attaches user from payload to req.user
 * No database lookup - uses JWT payload (userId, email, role, department)
 * Shared JWT_SECRET with auth-service required
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return sendError(res, 401, 'AUTHENTICATION_REQUIRED', 'Authentication token is required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      department: decoded.department
    };
    next();
  } catch (error) {
    const message = error.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token';
    return sendError(res, 401, 'INVALID_TOKEN', message);
  }
};

module.exports = { verifyToken };
