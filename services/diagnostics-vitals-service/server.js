require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { verifyToken } = require('./middleware/verifyToken');
const { authorizeRole } = require('./middleware/authorizeRole');
const Vitals = require('./models/VitalsSchema');
const { connectDatabase } = require('./config/database');

const {
  importFromMachine,
  importAllMachines,
  getAllResults,
  getResultById,
  getResultsByPatient,
  getResultsByMachine,
  getCriticalResults,
  verifyResult,
  deleteResult,
  getImportStats,
} = require("./models/diagnosticLogic");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests from this IP' }
  }
});
app.use('/api/', limiter);

// Health check
app.get('/health', (req, res) => {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  res.status(200).json({
    success: true,
    service: 'diagnostics-vitals-service',
    message: 'Diagnostics & Vitals service is running',
    timestamp: new Date().toISOString(),
    dependencies: {
      database: stateMap[mongoose.connection.readyState] || 'unknown',
    },
  });
});


// Vitals endpoints (logic inlined)
app.post('/api/vitals/:patientId', verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const source = req.body?.source || 'device';
    const createdBy = req.user?.name || 'IoT Device';
    const vitals = await Vitals.create({
      patientId: req.params.patientId,
      ...req.body,
      source,
      createdBy,
      updatedBy: createdBy,
    });

    res.status(201).json(vitals);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/vitals/:patientId', verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const vitals = await Vitals.find({ patientId: req.params.patientId })
      .sort({ createdAt: -1 })
      .limit(24);
    res.json(vitals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Diagnostics
// ──────────────────────────────────────────────────────────────────────────
// IMPORT ROUTES
// ──────────────────────────────────────────────────────────────────────────

app.post("/import/:machineType", verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const { machineType } = req.params;
    const results = await importFromMachine(machineType.toUpperCase(), req.body);
    res.status(201).json({
      success: true,
      message: `Imported ${results.length} result(s) from ${machineType.toUpperCase()}`,
      count: results.length,
      data: results,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/import-all", verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const { patientId } = req.body || {};
    const summary = await importAllMachines(patientId);
    res.status(201).json({ success: true, message: "All machines polled successfully", summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// READ ROUTES
// ──────────────────────────────────────────────────────────────────────────

app.get("/stats", verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const stats = await getImportStats(req.query.patientId);
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/critical", verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const results = await getCriticalResults(req.query.patientId);
    res.status(200).json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/", verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const results = await getAllResults(req.query);
    res.status(200).json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/machine/:machineType", verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const results = await getResultsByMachine(req.params.machineType.toUpperCase(), req.query);
    res.status(200).json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/patient/:patientId", verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const results = await getResultsByPatient(req.params.patientId);
    res.status(200).json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/:id", verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const result = await getResultById(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: "Result not found" });
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// UPDATE / DELETE ROUTES
// ──────────────────────────────────────────────────────────────────────────

app.patch("/:id/verify", verifyToken, authorizeRole("doctor"), async (req, res) => {
  try {
    const result = await verifyResult(req.params.id, req.user._id);
    res.status(200).json({ success: true, message: "Result verified", data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/:id", verifyToken, authorizeRole("admin"), async (req, res) => {
  try {
    await deleteResult(req.params.id);
    res.status(200).json({ success: true, message: "Result archived" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Vitals service

const PORT = process.env.DIAGNOSTICS_VITALS_SERVICE_PORT || process.env.PORT || 3004;
connectDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `[Diagnostics Vitals] Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`
      );
    });
  })
  .catch((error) => {
    console.error('[Diagnostics Vitals] Failed to connect to MongoDB:', error.message);
    process.exit(1);
  });

module.exports = app;
