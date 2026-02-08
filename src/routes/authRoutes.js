const express = require('express');
const router = express.Router();
const passport = require('passport');
const authService = require('../services/authService');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth - redirects to Google sign-in
 * @access  Public
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback - creates/finds user, redirects with JWT
 * @access  Public
 */
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

/**
 * @route   GET /api/auth/google/failure
 * @desc    Shown when Google OAuth fails
 * @access  Public
 */
router.get('/google/failure', (req, res) => {
  res.status(401).json({
    success: false,
    error: {
      code: 'GOOGLE_AUTH_FAILED',
      message: 'Google sign-in failed'
    }
  });
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validate(schemas.register), async (req, res) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      data: result,
      message: 'User registered successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'REGISTRATION_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and get token
 * @access  Public
 */
router.post('/login', validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json({
      success: true,
      data: result,
      message: 'Login successful'
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'LOGIN_ERROR',
        message: error.message
      }
    });
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);
    res.status(200).json({
      success: true,
      data: { user },
      message: 'User retrieved successfully'
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: error.message
      }
    });
  }
});

module.exports = router;

