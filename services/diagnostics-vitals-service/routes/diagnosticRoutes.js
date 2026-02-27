// All routes for diagnostic result import and management
const express = require("express");
const router  = express.Router();

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
} = require("../services/diagnosticService");

const { protect, restrictTo } = require("../middleware/authMiddleware");

// ── All routes require authentication ─────────────────────────────────────
router.use(protect);

// ──────────────────────────────────────────────────────────────────────────
// IMPORT ROUTES
// ──────────────────────────────────────────────────────────────────────────

router.post("/import/:machineType", restrictTo("admin", "doctor", "lab"), async (req, res) => {
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

router.post("/import-all", restrictTo("admin", "doctor"), async (req, res) => {
  try {
    const summary = await importAllMachines();
    res.status(201).json({ success: true, message: "All machines polled successfully", summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// READ ROUTES
// ──────────────────────────────────────────────────────────────────────────

router.get("/stats", async (req, res) => {
  try {
    const stats = await getImportStats();
    res.status(200).json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/critical", async (req, res) => {
  try {
    const results = await getCriticalResults();
    res.status(200).json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const results = await getAllResults(req.query);
    res.status(200).json({ success: true, ...results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/machine/:machineType", async (req, res) => {
  try {
    const results = await getResultsByMachine(req.params.machineType.toUpperCase(), req.query);
    res.status(200).json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/patient/:patientId", async (req, res) => {
  try {
    const results = await getResultsByPatient(req.params.patientId);
    res.status(200).json({ success: true, count: results.length, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
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

router.patch("/:id/verify", restrictTo("admin", "doctor"), async (req, res) => {
  try {
    const result = await verifyResult(req.params.id, req.user._id);
    res.status(200).json({ success: true, message: "Result verified", data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/:id", restrictTo("admin"), async (req, res) => {
  try {
    await deleteResult(req.params.id);
    res.status(200).json({ success: true, message: "Result archived" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;