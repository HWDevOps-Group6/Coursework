require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const { sendError } = require('../../../shared/http/responses');
const { buildCorsOptions } = require('../../../shared/http/cors');
const { notFoundHandler, globalErrorHandler } = require('../../../shared/http/handlers');

const app = express();

connectDB();

const requireDb = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return sendError(
      res,
      503,
      'SERVICE_UNAVAILABLE',
      'Database not ready. Start MongoDB or check MONGODB_URI.'
    );
  }
  next();
};

app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google OAuth: only load when configured (for web/browser clients)
const hasGoogleOAuth = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
if (hasGoogleOAuth) {
  const passport = require('./config/passport');
  const googleAuthRoutes = require('./routes/googleAuthRoutes');
  app.use(passport.initialize());
  app.use('/api/auth/web', googleAuthRoutes);
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5 : 100,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many auth attempts' } }
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);
app.use('/api/auth', requireDb);

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'auth-service',
    message: 'Auth service is running',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Auth] Service running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;
