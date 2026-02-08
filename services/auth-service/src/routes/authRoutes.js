const express = require('express');
const router = express.Router();
const passport = require('passport');
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');

// Google OAuth
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }),
  (req, res) => {
    const { token } = req.user;
    const redirectUrl = process.env.GOOGLE_REDIRECT_AFTER_LOGIN || 'http://localhost:5173';
    const separator = redirectUrl.includes('?') ? '&' : '?';
    res.redirect(`${redirectUrl}${separator}token=${token}`);
  }
);

router.get('/google/failure', (req, res) => {
  res.status(401).json({
    success: false,
    error: { code: 'GOOGLE_AUTH_FAILED', message: 'Google sign-in failed' }
  });
});

// Register / Login
router.post('/register', validate(schemas.register), async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result, message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: { code: 'REGISTRATION_ERROR', message: error.message } });
  }
});

router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json({ success: true, data: result, message: 'Login successful' });
  } catch (error) {
    res.status(401).json({ success: false, error: { code: 'LOGIN_ERROR', message: error.message } });
  }
});

// Protected: current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);
    res.status(200).json({ success: true, data: { user }, message: 'User retrieved successfully' });
  } catch (error) {
    res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: error.message } });
  }
});

/**
 * Token verification endpoint - for other microservices to validate tokens
 * Alternative: other services can verify JWT locally using shared JWT_SECRET
 */
router.post('/verify', (req, res) => {
  const token = extractTokenFromHeader(req.headers.authorization) || req.body?.token;
  if (!token) {
    return res.status(400).json({
      success: false,
      error: { code: 'TOKEN_REQUIRED', message: 'Token required in Authorization header or body' }
    });
  }
  try {
    const decoded = verifyToken(token);
    res.status(200).json({
      success: true,
      data: {
        valid: true,
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        department: decoded.department
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      data: { valid: false },
      error: { code: 'INVALID_TOKEN', message: error.message }
    });
  }
});

module.exports = router;
