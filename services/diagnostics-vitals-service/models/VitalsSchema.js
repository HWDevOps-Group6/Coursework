const mongoose = require('mongoose');
const { auditFieldDefinitions } = require('../../patient-registration-service/src/models/audit');

const vitalsSchema = new mongoose.Schema({
  patientId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  temperature: { type: Number, required: true },
  bp_systolic: { type: Number, required: true },
  bp_diastolic:{ type: Number, required: true },
  pulse:       { type: Number, required: true },
  ...auditFieldDefinitions,
}, { timestamps: true });

module.exports = mongoose.model('Vitals', vitalsSchema);
