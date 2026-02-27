const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    doctorId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    doctorName: {
      type: String,
      trim: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
      index: true,
    },
    appointmentEndDate: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 5,
      max: 480,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ['booked', 'cancelled', 'completed'],
      default: 'booked',
      index: true,
    },
    bookedBy: {
      type: String,
      required: true,
      trim: true,
    },
    bookedByRole: {
      type: String,
      required: true,
      trim: true,
    },
    source: {
      type: String,
      enum: ['manual', 'device', 'api'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ doctorId: 1, appointmentDate: 1, appointmentEndDate: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);