require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { verifyToken } = require('./middleware/verifyToken');
const { authorizeRole } = require('./middleware/authorizeRole');
const { connectDatabase } = require('./config/database');
const Patient = require('./models/Patient');
const { sendError, sendSuccess } = require('../shared/http/responses');
const { buildCorsOptions } = require('../shared/http/cors');
const { notFoundHandler, globalErrorHandler } = require('../shared/http/handlers');

// Main API (patients, admissions, referrals, etc.) - auth handled by auth-service
const app = express();

app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests from this IP' }
  }
});
app.use('/api/', limiter);

app.get('/health', (req, res) => {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  res.status(200).json({
    success: true,
    service: 'api',
    message: 'API is running',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: stateMap[mongoose.connection.readyState] || 'unknown',
    },
  });
});

/**
 * Example protected route - requires JWT from auth-service
 * GET /api/me validates token locally (no DB) - or use auth-service for full user data
 */
app.get('/api/me', verifyToken, (req, res) => {
  return sendSuccess(res, 200, { user: req.user }, 'Token valid! Successfully fetched profile');
});

app.get('/api/patients/records', verifyToken, authorizeRole('doctor', 'nurse'), async (req, res, next) => {
  try {
  const patients = await Patient.find({}).sort({ createdAt: -1 }).lean();

  return sendSuccess(res, 200, { patients }, 'Patient records retrieved successfully');
  } catch (error) {
    return next(error);
  }
});

app.get('/api/patients/records/:id', verifyToken, authorizeRole('doctor', 'nurse'), async (req, res, next) => {
  try {
  const patientRecord = await Patient.findOne({ id: req.params.id }).lean();

  if (!patientRecord) {
    return sendError(res, 404, 'PATIENT_NOT_FOUND', 'Patient record not found');
  }

  return sendSuccess(res, 200, { patient: patientRecord }, 'Patient record retrieved successfully');
  } catch (error) {
    return next(error);
  }
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

const PORT = process.env.PORT || 3000;
connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[API] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });
  })
  .catch((error) => {
    console.error('[API] Failed to connect to MongoDB:', error.message);
    process.exit(1);
  });

module.exports = app;
