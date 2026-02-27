const mongoose = require('mongoose');
const vitalsSchema = new mongoose.Schema({
  patientId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  temperature: { type: Number, required: true },
  bp_systolic: { type: Number, required: true },
  bp_diastolic:{ type: Number, required: true },
  pulse:       { type: Number, required: true },
  source:      { type: String, enum: ['device', 'manual'], default: 'device' },
  enteredBy:   { type: String },  // nurse name or "IoT Device"
}, { timestamps: true }); // createdAt = the hourly record time

module.exports = mongoose.model('Vitals', vitalsSchema);
