const mongoose = require('mongoose');

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleSlotSchema = new mongoose.Schema(
  {
    startTime: {
      type: String,
      required: true,
      trim: true,
      match: [timeRegex, 'startTime must be in HH:mm format']
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
      match: [timeRegex, 'endTime must be in HH:mm format']
    }
  },
  { _id: false }
);

const weeklyAvailabilitySchema = new mongoose.Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: 0,
      max: 6
    },
    slots: {
      type: [scheduleSlotSchema],
      default: []
    }
  },
  { _id: false }
);

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctorId: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    doctorName: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      trim: true
    },
    weeklyAvailability: {
      type: [weeklyAvailabilitySchema],
      default: []
    },
    createdBy: {
      type: String,
      required: true,
      trim: true
    },
    updatedBy: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      enum: ['manual', 'device', 'api'],
      default: 'manual'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DoctorSchedule', doctorScheduleSchema);