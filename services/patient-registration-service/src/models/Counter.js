const mongoose = require('mongoose');
const { auditFieldDefinitions } = require('./audit');

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: Number, required: true, default: 0 },
    ...auditFieldDefinitions,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Counter', counterSchema);
