const mongoose = require('mongoose');
const patientSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  ward:      { type: String, required: true },
  bedNumber: { type: String, required: true },
  admittedBy:{ type: String },
  status:    { type: String, enum: ['active', 'discharged'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Patient', patientSchema);