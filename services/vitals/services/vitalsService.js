const Vitals = require('../models/vitals');
const AuditLog = require('../models/AuditLog');

// ✅ Must use exports.functionName — not module.exports = {}
exports.addVitals = async (req, res) => {
  try {
    const vitals = await Vitals.create({
      patientId: req.params.patientId,
      ...req.body,
      enteredBy: req.body.source === 'manual' ? req.user?.name : 'IoT Device',
    });

    await AuditLog.create({
      action: `Vitals recorded for patient ${req.params.patientId}`,
      actor: vitals.enteredBy,
      source: vitals.source,
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
