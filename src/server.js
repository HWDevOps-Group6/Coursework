require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('crypto');
const { verifyToken } = require('./middleware/verifyToken');
const { authorizeRole } = require('./middleware/authorizeRole');

// Main API (patients, admissions, referrals, etc.) - auth handled by auth-service
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
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
  res.status(200).json({
    success: true,
    service: 'api',
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * Example protected route - requires JWT from auth-service
 * GET /api/me validates token locally (no DB) - or use auth-service for full user data
 */
app.get('/api/me', verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
    message: 'Token valid! Successfully fetched profile'
  });
});

const patientRegistrations = [];

const allowedPatientRegistrationFields = new Set([
  'firstName',
  'lastName',
  'dateOfBirth',
  'gender',
  'phoneNumber',
  'address',
  'knownDiseases',
  'complaints',
  'servicePoint'
]);

app.post('/api/patients/register', verifyToken, authorizeRole('clerk'), (req, res) => {
  const providedFields = Object.keys(req.body || {});
  const unknownFields = providedFields.filter((field) => !allowedPatientRegistrationFields.has(field));
  if (unknownFields.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_FIELDS',
        message: `Unsupported fields: ${unknownFields.join(', ')}`
      }
    });
  }

  const {
    firstName,
    lastName,
    dateOfBirth,
    gender,
    phoneNumber,
    address,
    knownDiseases = [],
    complaints = [],
    servicePoint
  } = req.body || {};

  if (!firstName || !lastName || !dateOfBirth || !gender || !servicePoint) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'firstName, lastName, dateOfBirth, gender, and servicePoint are required'
      }
    });
  }

  const isStringArray = (value) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);

  if (!isStringArray(knownDiseases) || !isStringArray(complaints)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'knownDiseases and complaints must be arrays of non-empty strings'
      }
    });
  }

  const patientRecord = {
    id: randomUUID(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    dateOfBirth,
    gender: gender.trim(),
    phoneNumber: typeof phoneNumber === 'string' ? phoneNumber.trim() : undefined,
    address: typeof address === 'string' ? address.trim() : undefined,
    knownDiseases: knownDiseases.map((item) => item.trim()),
    complaints: complaints.map((item) => item.trim()),
    servicePoint: servicePoint.trim(),
    registeredBy: req.user.userId,
    registeredByRole: req.user.role,
    createdAt: new Date().toISOString()
  };

  patientRegistrations.push(patientRecord);

  return res.status(201).json({
    success: true,
    data: { patient: patientRecord },
    message: 'Patient registered successfully'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app;
