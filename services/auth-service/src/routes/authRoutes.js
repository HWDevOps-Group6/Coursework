const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { sendError, sendSuccess } = require('../../../../shared/http/responses');

// Headless auth: register, login, me, verify (no browser required)
router.post('/register', validate(schemas.register), async (req, res) => {
  try {
    const result = await authService.register(req.body);
    return sendSuccess(res, 201, result, 'User registered successfully');
  } catch (error) {
    return sendError(res, 400, 'REGISTRATION_ERROR', error.message);
  }
});

router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return sendSuccess(res, 200, result, 'Login successful');
  } catch (error) {
    return sendError(res, 401, 'LOGIN_ERROR', error.message);
  }
});

// Protected: current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);
    return sendSuccess(res, 200, { user }, 'User retrieved successfully');
  } catch (error) {
    return sendError(res, 404, 'USER_NOT_FOUND', error.message);
  }
});

/**
 * Token verification endpoint - for other microservices to validate tokens
 * Alternative: other services can verify JWT locally using shared JWT_SECRET
 */
router.post('/verify', (req, res) => {
  const token = extractTokenFromHeader(req.headers.authorization) || req.body?.token;
  if (!token) {
    return sendError(res, 400, 'TOKEN_REQUIRED', 'Token required in Authorization header or body');
  }
  try {
    const decoded = verifyToken(token);
    return sendSuccess(res, 200, {
      valid: true,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      department: decoded.department
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      data: { valid: false },
      error: { code: 'INVALID_TOKEN', message: error.message },
    });
  }
});

module.exports = router;
