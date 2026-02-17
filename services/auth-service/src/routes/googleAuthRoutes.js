/**
 * Google OAuth routes - for web/browser clients only
 *
 * Uses redirect-based flow (not suitable for headless/CLI/API-only clients).
 * Mounted only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 *
 * Flow: User visits /web/google → redirect to Google → callback → redirect with ?token=JWT
 */
const express = require('express');
const router = express.Router();
const passport = require('passport');
const { sendError } = require('../../../../shared/http/responses');

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/api/auth/web/google/failure' }),
  (req, res) => {
    const { token } = req.user;
    const redirectUrl = process.env.GOOGLE_REDIRECT_AFTER_LOGIN || 'http://localhost:5173';
    const separator = redirectUrl.includes('?') ? '&' : '?';
    res.redirect(`${redirectUrl}${separator}token=${token}`);
  }
);

router.get('/google/failure', (req, res) => {
  return sendError(res, 401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed. This flow requires a browser.');
});

module.exports = router;
