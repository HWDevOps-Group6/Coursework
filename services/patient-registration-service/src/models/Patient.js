const mongoose = require('mongoose');
const { auditFieldDefinitions } = require('./audit');

const visitHistorySchema = new mongoose.Schema(
  {
    servicePoint: { type: String, required: true, trim: true },
    entryRoute: { type: String, trim: true },
    diseases: { type: [String], default: [] },
    referralDetails: { type: String, trim: true },
    ...auditFieldDefinitions,
    updatedByRole: { type: String, required: true, trim: true },
  },
  { _id: false, timestamps: true }
);

const nursingNoteSchema = new mongoose.Schema(
  {
    medicines: { type: [String], default: [] },
    treatmentDetails: { type: String, required: true, trim: true },
    intakeOutput: { type: String, required: true, trim: true },
    recordedAt: { type: Date, required: true },
    ...auditFieldDefinitions,
    recordedBy: { type: String, required: true, trim: true },
    recordedByRole: { type: String, required: true, trim: true },
  },
  { _id: false, timestamps: true }
);

const inPatientSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  ward:      { type: String, required: true },
  bedNumber: { type: String, required: true },
  admittedBy:{ type: String },
  status:    { type: String, enum: ['active', 'discharged'], default: 'active' },
}, { timestamps: true });

const patientSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    emiratesIdHash: {
      type: String,
      required: true,
      trim: true,
      select: false,
      immutable: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: String, required: true, trim: true },
    gender: { type: String, required: true, trim: true },
    phoneNumber: { type: String, trim: true },
    address: { type: String, trim: true },
    knownDiseases: { type: [String], default: [] },
    complaints: { type: [String], default: [] },
    entryRoute: { type: String, required: true, enum: ['OPD', 'A&E'], trim: true },
    servicePoint: { type: String, required: true, trim: true },
    ...auditFieldDefinitions,
    registeredBy: { type: String, required: true, trim: true },
    registeredByRole: { type: String, required: true, trim: true },
    visitHistory: { type: [visitHistorySchema], default: [] },
    nursingNotes: { type: [nursingNoteSchema], default: [] },
    inPatientNotes: { type: [inPatientSchema], default: [] }
  },
  { timestamps: true }
);

patientSchema.index({ servicePoint: 1, createdAt: -1 });
patientSchema.index({ entryRoute: 1, createdAt: -1 });
patientSchema.index({ id: 1, 'visitHistory.createdAt': -1 });
patientSchema.index({ id: 1, 'nursingNotes.recordedAt': -1 });
patientSchema.index({ id: 1, 'inPatientNotes.recordedAt': -1 });
patientSchema.index(
  { emiratesIdHash: 1 },
  {
    unique: true,
    partialFilterExpression: { emiratesIdHash: { $exists: true, $type: 'string' } },
  }
);

module.exports = mongoose.model('Patient', patientSchema);