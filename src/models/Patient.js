const mongoose = require('mongoose');

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
    servicePoint: { type: String, required: true, trim: true },
    registeredBy: { type: String, required: true, trim: true },
    registeredByRole: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

patientSchema.index({ servicePoint: 1, createdAt: -1 });
patientSchema.index(
  { emiratesIdHash: 1 },
  {
    unique: true,
    partialFilterExpression: { emiratesIdHash: { $exists: true, $type: 'string' } },
  }
);

module.exports = mongoose.model('Patient', patientSchema);
