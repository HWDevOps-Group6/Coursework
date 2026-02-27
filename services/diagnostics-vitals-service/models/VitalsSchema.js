const mongoose = require('mongoose');
const { auditFieldDefinitions } = require('../../patient-registration-service/src/models/audit');

const vitalsSchema = new mongoose.Schema({
  // Patient registration service uses a string patient identifier (Patient.id),
  // so store that here to keep cross-service IDs consistent.
  patientId:   { type: String, required: true, trim: true },
  temperature: { type: Number, required: true },
  bp_systolic: { type: Number, required: true },
  bp_diastolic:{ type: Number, required: true },
  pulse:       { type: Number, required: true },
  ...auditFieldDefinitions,
}, { timestamps: true });

module.exports = mongoose.model('Vitals', vitalsSchema);
