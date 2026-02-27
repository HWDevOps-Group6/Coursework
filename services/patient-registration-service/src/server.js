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
const DoctorSchedule = require('./models/DoctorSchedule');
const Appointment = require('./models/Appointment');
const { AUDIT_SOURCES } = require('./models/audit');
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
  'servicePoint',
  'source'
]);

const normalizeEmiratesId = (value) => String(value || '').replace(/\D/g, '');
const normalizeEntryRoute = (value) => {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (normalized === 'OPD') return 'OPD';
  if (normalized === 'A&E' || normalized === 'AE') return 'A&E';
  return '';
};
const normalizeVisitEntryRoute = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';

  const normalizedRoute = normalized.toUpperCase().replace(/\s+/g, '');
  if (normalizedRoute === 'OPD') return 'OPD';
  if (normalizedRoute === 'A&E' || normalizedRoute === 'AE') return 'A&E';

  return normalized.toUpperCase();
};
const hashPatientIdentifier = (normalizedEmiratesId) =>
  createHash('sha256')
    .update(`${process.env.PATIENT_ID_HASH_SALT || ''}:${normalizedEmiratesId}`)
    .digest('hex');
const isStringArray = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
const buildDefaultHalfHourSlots = () => {
  const slots = [];
  for (let hour = 9; hour < 17; hour += 1) {
    const fromHour = String(hour).padStart(2, '0');
    const toHour = String(hour + 1).padStart(2, '0');
    slots.push({ startTime: `${fromHour}:00`, endTime: `${fromHour}:30` });
    slots.push({ startTime: `${fromHour}:30`, endTime: `${toHour}:00` });
  }
  return slots;
};
const parseTimeToMinutes = (time) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(time || '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};
const toUtcMinutes = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCHours() * 60 + date.getUTCMinutes();
};
const isValidAvailabilityPayload = (weeklyAvailability) => {
  if (!Array.isArray(weeklyAvailability) || weeklyAvailability.length === 0) return false;

  const usedDays = new Set();

  for (const dayEntry of weeklyAvailability) {
    if (
      !dayEntry ||
      typeof dayEntry.dayOfWeek !== 'number' ||
      dayEntry.dayOfWeek < 0 ||
      dayEntry.dayOfWeek > 6 ||
      usedDays.has(dayEntry.dayOfWeek)
    ) {
      return false;
    }

    usedDays.add(dayEntry.dayOfWeek);

    if (!Array.isArray(dayEntry.slots) || dayEntry.slots.length === 0) {
      return false;
    }

    const sortedSlots = dayEntry.slots
      .map((slot) => ({
        start: parseTimeToMinutes(slot?.startTime),
        end: parseTimeToMinutes(slot?.endTime)
      }))
      .sort((left, right) => left.start - right.start);

    for (let index = 0; index < sortedSlots.length; index += 1) {
      const currentSlot = sortedSlots[index];
      if (
        currentSlot.start === null ||
        currentSlot.end === null ||
        currentSlot.start >= currentSlot.end
      ) {
        return false;
      }

      const previousSlot = sortedSlots[index - 1];
      if (previousSlot && previousSlot.end > currentSlot.start) {
        return false;
      }
    }
  }

  return true;
};
const resolveAuditSource = (value, fallback = 'manual') => {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const normalizedSource = String(value).trim().toLowerCase();
  return AUDIT_SOURCES.includes(normalizedSource) ? normalizedSource : '';
};

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
      {
        $setOnInsert: {
          value: startValue,
          createdBy: 'system',
          updatedBy: 'system',
          source: 'api'
        }
      },
      { upsert: true }
    );
  }

  const counter = await Counter.findOneAndUpdate(
    { key: 'patientId' },
    {
      $inc: { value: 1 },
      $set: { updatedBy: 'system', source: 'api' },
      $setOnInsert: { createdBy: 'system' }
    },
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
      servicePoint,
      source
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
      createdBy: req.user.userId,
      updatedBy: req.user.userId,
      source: resolveAuditSource(source, 'manual'),
      registeredBy: req.user.userId,
      registeredByRole: req.user.role
    };

    if (!patientRecord.source) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'source must be one of manual, device, api');
    }

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

app.get('/api/patients/records', verifyToken, authorizeRole('doctor', 'nurse', 'paramedic'), async (req, res, next) => {
  try {
    const patients = await Patient.find({}).sort({ createdAt: -1 }).lean();
    return sendSuccess(
      res,
      200,
      { patients: patients.map((patient) => sanitizePatient(patient)) },
      'Patient records retrieved successfully'
    );
  } catch (error) {
    return next(error);
  }
});

app.get(
  '/api/patients/records/:id',
  verifyToken,
  authorizeRole('doctor', 'nurse', 'paramedic'),
  async (req, res, next) => {
    try {
      const patientRecord = await Patient.findOne({ id: req.params.id }).lean();

      if (!patientRecord) {
        return sendError(res, 404, 'PATIENT_NOT_FOUND', 'Patient record not found');
      }

      return sendSuccess(
        res,
        200,
        { patient: sanitizePatient(patientRecord) },
        'Patient record retrieved successfully'
      );
    } catch (error) {
      return next(error);
    }
  }
);

app.patch(
  '/api/patients/records/:id/visits',
  verifyToken,
  authorizeRole('doctor', 'nurse', 'paramedic'),
  async (req, res, next) => {
    try {
      const allowedVisitFields = new Set(['servicePoint', 'entryRoute', 'diseases', 'referralDetails', 'source']);
      const providedFields = Object.keys(req.body || {});
      const unknownFields = providedFields.filter((field) => !allowedVisitFields.has(field));

      if (unknownFields.length > 0) {
        return sendError(res, 400, 'INVALID_FIELDS', `Unsupported fields: ${unknownFields.join(', ')}`);
      }

      const { servicePoint, entryRoute, diseases, referralDetails, source } = req.body || {};

      if (typeof servicePoint !== 'string' || !servicePoint.trim()) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'servicePoint is required');
      }

      if (!isStringArray(diseases)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'diseases must be an array of non-empty strings');
      }

      if (
        referralDetails !== undefined &&
        (typeof referralDetails !== 'string' || !referralDetails.trim() || referralDetails.trim().length > 1000)
      ) {
        return sendError(
          res,
          400,
          'VALIDATION_ERROR',
          'referralDetails, when provided, must be a non-empty string up to 1000 characters'
        );
      }

      const visitEntryRoute =
        entryRoute === undefined
          ? (req.user.role === 'paramedic' ? 'A&E' : '')
          : normalizeVisitEntryRoute(entryRoute);
      if (entryRoute !== undefined && !visitEntryRoute) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'entryRoute must be a non-empty string when provided');
      }

      const visitEntry = {
        servicePoint: servicePoint.trim(),
        diseases: diseases.map((item) => item.trim()),
        createdBy: req.user.userId,
        updatedBy: req.user.userId,
        source: resolveAuditSource(source, 'manual'),
        updatedByRole: req.user.role
      };

      if (!visitEntry.source) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'source must be one of manual, device, api');
      }

      if (visitEntryRoute) {
        visitEntry.entryRoute = visitEntryRoute;
      }
      if (typeof referralDetails === 'string' && referralDetails.trim()) {
        visitEntry.referralDetails = referralDetails.trim();
      }

      const updatedPatient = await Patient.findOneAndUpdate(
        { id: req.params.id },
        {
          $push: { visitHistory: visitEntry },
          $set: { updatedBy: req.user.userId, source: visitEntry.source }
        },
        { new: true }
      ).lean();

      if (!updatedPatient) {
        return sendError(res, 404, 'PATIENT_NOT_FOUND', 'Patient record not found');
      }

      return sendSuccess(
        res,
        200,
        { patient: sanitizePatient(updatedPatient) },
        'Patient visit history updated successfully'
      );
    } catch (error) {
      return next(error);
    }
  }
);

app.put(
  '/api/patients/doctors/:doctorId/schedule',
  verifyToken,
  authorizeRole('doctor', 'admin'),
  async (req, res, next) => {
    try {
      const { doctorId } = req.params;
      const { doctorName, department, weeklyAvailability, source } = req.body || {};

      if (req.user.role === 'doctor' && req.user.userId !== doctorId) {
        return sendError(res, 403, 'INSUFFICIENT_ROLE', 'Doctors can only manage their own schedule');
      }

      if (!doctorId || typeof doctorId !== 'string') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'doctorId is required');
      }

      if (!isValidAvailabilityPayload(weeklyAvailability)) {
        return sendError(
          res,
          400,
          'VALIDATION_ERROR',
          'weeklyAvailability must contain unique dayOfWeek entries (0-6) with non-overlapping HH:mm slots'
        );
      }

      const normalizedSource = resolveAuditSource(source, 'manual');
      if (!normalizedSource) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'source must be one of manual, device, api');
      }

      const scheduleUpdate = {
        doctorId,
        doctorName: typeof doctorName === 'string' ? doctorName.trim() : undefined,
        department: typeof department === 'string' ? department.trim() : undefined,
        weeklyAvailability,
        updatedBy: req.user.userId,
        source: normalizedSource,
      };

      const schedule = await DoctorSchedule.findOneAndUpdate(
        { doctorId },
        {
          $set: scheduleUpdate,
          $setOnInsert: { createdBy: req.user.userId }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).lean();

      return sendSuccess(res, 200, { schedule }, 'Doctor schedule updated successfully');
    } catch (error) {
      return next(error);
    }
  }
);

app.get(
  '/api/patients/doctors/:doctorId/schedule',
  verifyToken,
  authorizeRole('clerk', 'doctor', 'nurse', 'paramedic', 'admin', 'clinician'),
  async (req, res, next) => {
    try {
      const { doctorId } = req.params;
      const schedule = await DoctorSchedule.findOne({ doctorId }).lean();

      if (!schedule) {
        return sendError(res, 404, 'DOCTOR_SCHEDULE_NOT_FOUND', 'Doctor schedule not found');
      }

      return sendSuccess(res, 200, { schedule }, 'Doctor schedule retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

app.get(
  '/api/patients/doctors/:doctorId/availability',
  verifyToken,
  authorizeRole('clerk', 'doctor', 'nurse', 'paramedic', 'admin', 'clinician'),
  async (req, res, next) => {
    try {
      const { doctorId } = req.params;
      const { date } = req.query;

      if (typeof date !== 'string' || !date.trim()) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'date query parameter is required in YYYY-MM-DD format');
      }

      const requestedDate = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(requestedDate.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'date must be in YYYY-MM-DD format');
      }

      const schedule = await DoctorSchedule.findOne({ doctorId }).lean();
      if (!schedule) {
        return sendError(res, 404, 'DOCTOR_SCHEDULE_NOT_FOUND', 'Doctor schedule not found');
      }

      const dayOfWeek = requestedDate.getUTCDay();
      const dayEntry = schedule.weeklyAvailability.find((entry) => entry.dayOfWeek === dayOfWeek);
      const availableSlots = dayEntry?.slots?.length ? dayEntry.slots : buildDefaultHalfHourSlots();

      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      const existingAppointments = await Appointment.find({
        doctorId,
        status: 'booked',
        appointmentDate: { $lte: endOfDay },
        appointmentEndDate: { $gte: startOfDay }
      })
        .sort({ appointmentDate: 1 })
        .lean();

      const freeSlots = availableSlots.filter((slot) => {
        const slotStart = parseTimeToMinutes(slot.startTime);
        const slotEnd = parseTimeToMinutes(slot.endTime);
        if (slotStart === null || slotEnd === null) return false;

        return !existingAppointments.some((appointment) => {
          const appointmentStart = toUtcMinutes(appointment.appointmentDate);
          const appointmentEnd = toUtcMinutes(appointment.appointmentEndDate);
          if (appointmentStart === null || appointmentEnd === null) return false;
          return appointmentStart < slotEnd && appointmentEnd > slotStart;
        });
      });

      return sendSuccess(
        res,
        200,
        {
          doctorId,
          date,
          dayOfWeek,
          availableSlots: freeSlots,
          bookedSlots: existingAppointments.map((appointment) => ({
            appointmentId: appointment._id,
            start: appointment.appointmentDate,
            end: appointment.appointmentEndDate,
            patientId: appointment.patientId
          }))
        },
        'Doctor availability retrieved successfully'
      );
    } catch (error) {
      return next(error);
    }
  }
);

app.post(
  '/api/patients/records/:id/appointments',
  verifyToken,
  authorizeRole('clerk'),
  async (req, res, next) => {
    try {
      const { id: patientId } = req.params;
      const { doctorId, doctorName, appointmentDateTime, durationMinutes = 30, reason, source } = req.body || {};

      if (!doctorId || typeof doctorId !== 'string') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'doctorId is required');
      }

      if (!appointmentDateTime || typeof appointmentDateTime !== 'string') {
        return sendError(res, 400, 'VALIDATION_ERROR', 'appointmentDateTime is required as an ISO date-time string');
      }

      if (
        typeof durationMinutes !== 'number' ||
        !Number.isInteger(durationMinutes) ||
        durationMinutes < 5 ||
        durationMinutes > 480
      ) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'durationMinutes must be an integer between 5 and 480');
      }

      const appointmentDate = new Date(appointmentDateTime);
      if (Number.isNaN(appointmentDate.getTime())) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'appointmentDateTime must be a valid ISO date-time string');
      }

      const appointmentEndDate = new Date(appointmentDate.getTime() + durationMinutes * 60 * 1000);
      if (appointmentDate.getUTCDate() !== appointmentEndDate.getUTCDate()) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'Appointment cannot cross midnight; split into separate appointments');
      }

      const currentTime = new Date();
      if (appointmentDate <= currentTime) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'appointmentDateTime must be in the future');
      }

      const normalizedSource = resolveAuditSource(source, 'manual');
      if (!normalizedSource) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'source must be one of manual, device, api');
      }

      const patient = await Patient.findOne({ id: patientId }).lean();
      if (!patient) {
        return sendError(res, 404, 'PATIENT_NOT_FOUND', 'Patient record not found');
      }

      const doctorSchedule = await DoctorSchedule.findOne({ doctorId }).lean();
      if (!doctorSchedule) {
        return sendError(res, 404, 'DOCTOR_SCHEDULE_NOT_FOUND', 'Doctor schedule not found for this doctor');
      }

      const dayOfWeek = appointmentDate.getUTCDay();
      const daySchedule = doctorSchedule.weeklyAvailability.find((entry) => entry.dayOfWeek === dayOfWeek);
      const scheduleSlots = daySchedule?.slots?.length ? daySchedule.slots : buildDefaultHalfHourSlots();

      const startMinutes = appointmentDate.getUTCHours() * 60 + appointmentDate.getUTCMinutes();
      const endMinutes = appointmentEndDate.getUTCHours() * 60 + appointmentEndDate.getUTCMinutes();

      const fitsSlot = scheduleSlots.some((slot) => {
        const slotStart = parseTimeToMinutes(slot.startTime);
        const slotEnd = parseTimeToMinutes(slot.endTime);
        return slotStart !== null && slotEnd !== null && startMinutes >= slotStart && endMinutes <= slotEnd;
      });

      if (!fitsSlot) {
        return sendError(
          res,
          409,
          'DOCTOR_UNAVAILABLE',
          'Requested time is outside of the doctor schedule for that day'
        );
      }

      const overlappingAppointment = await Appointment.findOne({
        doctorId,
        status: 'booked',
        appointmentDate: { $lt: appointmentEndDate },
        appointmentEndDate: { $gt: appointmentDate }
      }).lean();

      if (overlappingAppointment) {
        return sendError(
          res,
          409,
          'DOCTOR_UNAVAILABLE',
          'Doctor is not free at the requested time, please choose another slot'
        );
      }

      const appointment = await Appointment.create({
        patientId,
        doctorId,
        doctorName: typeof doctorName === 'string' ? doctorName.trim() : doctorSchedule.doctorName,
        appointmentDate,
        appointmentEndDate,
        durationMinutes,
        reason: typeof reason === 'string' ? reason.trim() : undefined,
        status: 'booked',
        bookedBy: req.user.userId,
        bookedByRole: req.user.role,
        source: normalizedSource
      });

      return sendSuccess(res, 201, { appointment }, 'Appointment booked successfully');
    } catch (error) {
      return next(error);
    }
  }
);

app.get(
  '/api/patients/records/:id/appointments',
  verifyToken,
  authorizeRole('clerk', 'doctor', 'nurse', 'paramedic', 'admin', 'clinician'),
  async (req, res, next) => {
    try {
      const { id: patientId } = req.params;
      const patient = await Patient.findOne({ id: patientId }).lean();

      if (!patient) {
        return sendError(res, 404, 'PATIENT_NOT_FOUND', 'Patient record not found');
      }

      const appointments = await Appointment.find({ patientId })
        .sort({ appointmentDate: -1 })
        .lean();

      return sendSuccess(res, 200, { appointments }, 'Patient appointments retrieved successfully');
    } catch (error) {
      return next(error);
    }
  }
);

app.patch(
  '/api/patients/records/:id/prescriptions',
  verifyToken,
  authorizeRole('doctor'),
  async (req, res, next) => {
    try {
      const allowedPrescriptionFields = new Set(['medicines', 'prescribedAt', 'notes', 'source']);
      const providedFields = Object.keys(req.body || {});
      const unknownFields = providedFields.filter((field) => !allowedPrescriptionFields.has(field));

      if (unknownFields.length > 0) {
        return sendError(res, 400, 'INVALID_FIELDS', `Unsupported fields: ${unknownFields.join(', ')}`);
      }

      const { medicines, prescribedAt, notes, source } = req.body || {};

      if (!isStringArray(medicines)) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'medicines must be an array of non-empty strings');
      }

      if (typeof prescribedAt !== 'string' || !prescribedAt.trim()) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'prescribedAt is required and must be an ISO date-time string');
      }

      const parsedPrescribedAt = new Date(prescribedAt);
      if (Number.isNaN(parsedPrescribedAt.getTime())) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'prescribedAt must be a valid ISO date-time string');
      }

      if (notes !== undefined && (typeof notes !== 'string' || !notes.trim())) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'notes, when provided, must be a non-empty string');
      }

      const prescription = {
        medicines: medicines.map((item) => item.trim()),
        prescribedAt: parsedPrescribedAt,
        createdBy: req.user.userId,
        updatedBy: req.user.userId,
        source: resolveAuditSource(source, 'manual'),
        prescribedBy: req.user.userId,
        prescribedByRole: req.user.role
      };

      if (!prescription.source) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'source must be one of manual, device, api');
      }

      if (typeof notes === 'string' && notes.trim()) {
        prescription.notes = notes.trim();
      }

      const updatedPatient = await Patient.findOneAndUpdate(
        { id: req.params.id },
        {
          $push: { prescriptions: prescription },
          $set: { updatedBy: req.user.userId, source: prescription.source }
        },
        { new: true }
      ).lean();

      if (!updatedPatient) {
        return sendError(res, 404, 'PATIENT_NOT_FOUND', 'Patient record not found');
      }

      return sendSuccess(
        res,
        200,
        { patient: sanitizePatient(updatedPatient) },
        'Prescription added successfully'
      );
    } catch (error) {
      return next(error);
    }
  }
);

app.patch(
  '/api/patients/records/:id/nursing-notes',
  verifyToken,
  authorizeRole('nurse'),
  async (req, res, next) => {
    try {
      const allowedNursingFields = new Set(['treatmentDetails', 'intakeOutput', 'recordedAt', 'source']);
      const providedFields = Object.keys(req.body || {});
      const unknownFields = providedFields.filter((field) => !allowedNursingFields.has(field));

      if (unknownFields.length > 0) {
        return sendError(res, 400, 'INVALID_FIELDS', `Unsupported fields: ${unknownFields.join(', ')}`);
      }

      const { treatmentDetails, intakeOutput, recordedAt, source } = req.body || {};

      if (typeof treatmentDetails !== 'string' || !treatmentDetails.trim()) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'treatmentDetails is required');
      }

      if (typeof intakeOutput !== 'string' || !intakeOutput.trim()) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'intakeOutput is required');
      }

      if (typeof recordedAt !== 'string' || !recordedAt.trim()) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'recordedAt is required and must be an ISO date-time string');
      }

      const parsedRecordedAt = new Date(recordedAt);
      if (Number.isNaN(parsedRecordedAt.getTime())) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'recordedAt must be a valid ISO date-time string');
      }

      const nursingNote = {
        treatmentDetails: treatmentDetails.trim(),
        intakeOutput: intakeOutput.trim(),
        recordedAt: parsedRecordedAt,
        createdBy: req.user.userId,
        updatedBy: req.user.userId,
        source: resolveAuditSource(source, 'manual'),
        recordedBy: req.user.userId,
        recordedByRole: req.user.role
      };

      if (!nursingNote.source) {
        return sendError(res, 400, 'VALIDATION_ERROR', 'source must be one of manual, device, api');
      }

      const updatedPatient = await Patient.findOneAndUpdate(
        { id: req.params.id },
        {
          $push: { nursingNotes: nursingNote },
          $set: { updatedBy: req.user.userId, source: nursingNote.source }
        },
        { new: true }
      ).lean();

      if (!updatedPatient) {
        return sendError(res, 404, 'PATIENT_NOT_FOUND', 'Patient record not found');
      }

      return sendSuccess(
        res,
        200,
        { patient: sanitizePatient(updatedPatient) },
        'Nursing note added successfully'
      );
    } catch (error) {
      return next(error);
    }
  }
);

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
