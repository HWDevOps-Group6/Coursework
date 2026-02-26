const express = require('express');
const router = express.Router();
const vitalsService = require('../services/vitalsService');
const { authenticate } = require('../middleware/auth'); // ✅ was 'protect'

router.post('/:patientId', authenticate, vitalsService.addVitals);
router.get('/:patientId', authenticate, vitalsService.getVitals);

module.exports = router;