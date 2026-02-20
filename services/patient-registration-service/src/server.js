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
const { sendError, sendSuccess } = require('../../../shared/http/responses');
const { buildCorsOptions } = require('../../../shared/http/cors');
const { notFoundHandler, globalErrorHandler } = require('../../../shared/http/handlers');

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
    service: 'patient-registration-service',
    message: 'Patient registration service is running',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: stateMap[mongoose.connection.readyState] || 'unknown',
    },
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
  'entryRoute',
  'servicePoint'
]);

const normalizeEmiratesId = (value) => String(value || '').replace(/\D/g, '');
const normalizeEntryRoute = (value) => {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (normalized === 'OPD') return 'OPD';
  if (normalized === 'A&E' || normalized === 'AE') return 'A&E';
  return '';
};
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
      return sendError(res, 400, 'INVALID_FIELDS', `Unsupported fields: ${unknownFields.join(', ')}`);
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
      entryRoute,
      servicePoint
    } = req.body || {};

    if (!emiratesId || !firstName || !lastName || !dateOfBirth || !gender || !entryRoute || !servicePoint) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'emiratesId, firstName, lastName, dateOfBirth, gender, entryRoute, and servicePoint are required'
      );
    }

    const normalizedEmiratesId = normalizeEmiratesId(emiratesId);
    if (!/^\d{15}$/.test(normalizedEmiratesId)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'emiratesId must contain exactly 15 digits');
    }

    const isStringArray = (value) =>
      Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);

    if (!isStringArray(knownDiseases) || !isStringArray(complaints)) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'knownDiseases and complaints must be arrays of non-empty strings'
      );
    }

    const normalizedEntryRoute = normalizeEntryRoute(entryRoute);
    if (!normalizedEntryRoute) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'entryRoute must be either OPD or A&E');
    }

    const emiratesIdHash = hashPatientIdentifier(normalizedEmiratesId);
    const existingPatient = await Patient.findOne({ emiratesIdHash }).lean();
    if (existingPatient) {
      return sendError(res, 409, 'DUPLICATE_PATIENT', 'A patient with this Emirates ID already exists');
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
      entryRoute: normalizedEntryRoute,
      servicePoint: servicePoint.trim(),
      registeredBy: req.user.userId,
      registeredByRole: req.user.role
    };

    const savedPatient = await Patient.create(patientRecord);

    return sendSuccess(
      res,
      201,
      { patient: sanitizePatient(savedPatient) },
      'Patient registered successfully'
    );
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.emiratesIdHash) {
      return sendError(res, 409, 'DUPLICATE_PATIENT', 'A patient with this Emirates ID already exists');
    }
    return next(error);
  }
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

const PORT = process.env.PATIENT_REG_SERVICE_PORT || process.env.PORT || 3003;
connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `[Patient Registration] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`
      );
    });
  })
  .catch((error) => {
    console.error('[Patient Registration] Failed to connect to MongoDB:', error.message);
    process.exit(1);
  });

module.exports = app;
