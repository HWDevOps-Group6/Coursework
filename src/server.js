require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { createHash } = require('crypto');
const { verifyToken } = require('./middleware/verifyToken');
const { authorizeRole } = require('./middleware/authorizeRole');
const { connectDatabase } = require('./config/database');
const Patient = require('./models/Patient');
const Counter = require('./models/Counter');

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
  res.status(200).json({
    success: true,
    data: { user: req.user },
    message: 'Token valid! Successfully fetched profile'
  });
});

const allowedPatientRegistrationFields = new Set([
  'emiratesId',
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

const normalizeEmiratesId = (value) => String(value || '').replace(/\D/g, '');
const hashPatientIdentifier = (normalizedEmiratesId) =>
  createHash('sha256')
    .update(`${process.env.PATIENT_ID_HASH_SALT || ''}:${normalizedEmiratesId}`)
    .digest('hex');

const getNextPatientId = async () => {
  const existingCounter = await Counter.findOne({ key: 'patientId' }).lean();

  if (!existingCounter) {
    const [maxPatientIdRecord] = await Patient.aggregate([
      { $match: { id: { $regex: '^[0-9]+$' } } },
      { $addFields: { numericId: { $toLong: '$id' } } },
      { $sort: { numericId: -1 } },
      { $limit: 1 },
      { $project: { _id: 0, numericId: 1 } }
    ]);

    const startValue = Number(maxPatientIdRecord?.numericId || 0);

    await Counter.updateOne(
      { key: 'patientId' },
      { $setOnInsert: { value: startValue } },
      { upsert: true }
    );
  }

  const counter = await Counter.findOneAndUpdate(
    { key: 'patientId' },
    { $inc: { value: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  return String(counter.value);
};

const sanitizePatient = (patient) => {
  if (!patient) return patient;
  const patientObject = typeof patient.toObject === 'function' ? patient.toObject() : patient;
  const { emiratesIdHash, __v, ...safePatient } = patientObject;
  return safePatient;
};

app.post('/api/patients/register', verifyToken, authorizeRole('clerk'), async (req, res, next) => {
  try {
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
      emiratesId,
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

    if (!emiratesId || !firstName || !lastName || !dateOfBirth || !gender || !servicePoint) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'emiratesId, firstName, lastName, dateOfBirth, gender, and servicePoint are required'
        }
      });
    }

    const normalizedEmiratesId = normalizeEmiratesId(emiratesId);
    if (!/^\d{15}$/.test(normalizedEmiratesId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'emiratesId must contain exactly 15 digits'
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

    const emiratesIdHash = hashPatientIdentifier(normalizedEmiratesId);
    const existingPatient = await Patient.findOne({ emiratesIdHash }).lean();
    if (existingPatient) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_PATIENT',
          message: 'A patient with this Emirates ID already exists'
        }
      });
    }

    const patientRecord = {
      id: await getNextPatientId(),
      emiratesIdHash,
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
      registeredByRole: req.user.role
    };

    const savedPatient = await Patient.create(patientRecord);

    return res.status(201).json({
      success: true,
      data: { patient: sanitizePatient(savedPatient) },
      message: 'Patient registered successfully'
    });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.emiratesIdHash) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_PATIENT',
          message: 'A patient with this Emirates ID already exists'
        }
      });
    }
    return next(error);
  }
});

app.get('/api/patients/records', verifyToken, authorizeRole('doctor', 'nurse'), async (req, res, next) => {
  try {
  const patients = await Patient.find({}).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    success: true,
    data: { patients },
    message: 'Patient records retrieved successfully'
  });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/patients/records/:id', verifyToken, authorizeRole('doctor', 'nurse'), async (req, res, next) => {
  try {
  const patientRecord = await Patient.findOne({ id: req.params.id }).lean();

  if (!patientRecord) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'PATIENT_NOT_FOUND',
        message: 'Patient record not found'
      }
    });
  }

  return res.status(200).json({
    success: true,
    data: { patient: patientRecord },
    message: 'Patient record retrieved successfully'
  });
  } catch (error) {
    return next(error);
  }
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
