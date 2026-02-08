const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const authService = require('../services/authService');

const AUTH_PORT = process.env.PORT || 3001;

/**
 * Configure Passport Google OAuth 2.0 strategy
 * Strategy is only registered when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set
 */
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${AUTH_PORT}/api/auth/google/callback`
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await authService.findOrCreateFromGoogle(profile);
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );
}

passport.serializeUser((user, done) => {
  const id = user?.user?._id ?? user?._id;
  done(null, id?.toString());
});

passport.deserializeUser(async (id, done) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
