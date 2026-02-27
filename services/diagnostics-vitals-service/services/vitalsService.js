const { verifyToken } = require('./middleware/verifyToken');
const { authorizeRole } = require('./middleware/authorizeRole');
const Vitals = require('../models/vitals');
const { auditFieldDefinitions } = require('../../patient-registration-service/src/models/audit');

exports.addVitals = async (req, res) => {
  try {
    const source = req.body.source || 'device';
    const createdBy = req.user?.name || 'IoT Device';
    const updatedBy = createdBy;
    const vitals = await Vitals.create({
      patientId: req.params.patientId,
      ...req.body,
      source,
      createdBy,
      updatedBy,
    });
    res.status(201).json(vitals);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getVitals = async (req, res) => {
  try {
    const vitals = await Vitals.find({ patientId: req.params.patientId })
      .sort({ createdAt: -1 })
      .limit(24);
    res.json(vitals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
