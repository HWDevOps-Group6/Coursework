const { sendError } = require('../../shared/http/responses');

const authorizeRole = (...allowedRoles) => (req, res, next) => {
  const userRole = req.user?.role;

  if (!userRole) {
    return sendError(res, 403, 'ROLE_MISSING', 'User role is required for this action');
  }

  if (!allowedRoles.includes(userRole)) {
    return sendError(
      res,
      403,
      'INSUFFICIENT_ROLE',
      `This action requires one of: ${allowedRoles.join(', ')}`
    );
  }

  next();
};

module.exports = { authorizeRole };
