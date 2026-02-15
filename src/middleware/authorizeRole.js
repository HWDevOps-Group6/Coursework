const authorizeRole = (...allowedRoles) => (req, res, next) => {
  const userRole = req.user?.role;

  if (!userRole) {
    return res.status(403).json({
      success: false,
      error: { code: 'ROLE_MISSING', message: 'User role is required for this action' }
    });
  }

  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_ROLE',
        message: `This action requires one of: ${allowedRoles.join(', ')}`
      }
    });
  }

  next();
};

module.exports = { authorizeRole };
