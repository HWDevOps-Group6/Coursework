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

// ── DiagnosticResult subdocument schema ─────────────────────────────
const DiagnosticResultSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: [true, "Patient reference is required"],
  },
  patientId: {
    type: String,
    required: true,
    trim: true,
  },
  accessionNo: {
    type: String,
    required: true,
    trim: true,
  },
  machineType: {
    type: String,
    required: true,
    enum: ["XRAY", "CT", "MRI", "PCR", "ULTRASOUND", "BLOODWORK"],
    uppercase: true,
  },
  machineId: {
    type: String,
    required: true,
    trim: true,
  },
  finding: {
    type: String,
    required: true,
    trim: true,
  },
  result: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    enum: ["normal", "abnormal", "critical", "pending"],
    default: "pending",
    lowercase: true,
  },
  reportedBy: {
    type: String,
    trim: true,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  importSource: {
    type: String,
    enum: ["api", "manual", "hl7", "dicom", "lis"],
    default: "api",
  },
  importedAt: {
    type: Date,
    default: Date.now,
  },
  rawPayload: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  notes: {
    type: String,
    trim: true,
    default: "",
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
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
    inPatientNotes: { type: [inPatientSchema], default: [] },
    diagnosticResults: { type: [DiagnosticResultSchema], default: [] },
  },
  { timestamps: true }
);

patientSchema.index({ servicePoint: 1, createdAt: -1 });
patientSchema.index({ entryRoute: 1, createdAt: -1 });
patientSchema.index({ id: 1, 'visitHistory.createdAt': -1 });
patientSchema.index({ id: 1, 'nursingNotes.recordedAt': -1 });
patientSchema.index({ id: 1, 'inPatientNotes.recordedAt': -1 });
patientSchema.index({ id: 1, 'diagnosticResults.importedAt': -1 });
patientSchema.index(
  { emiratesIdHash: 1 },
  {
    unique: true,
    partialFilterExpression: { emiratesIdHash: { $exists: true, $type: 'string' } },
  }
);

module.exports = mongoose.model('Patient', patientSchema);