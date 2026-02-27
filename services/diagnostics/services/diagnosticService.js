// src/services/diagnosticService.js
// Business logic for importing and managing diagnostic results from machines

const DiagnosticResult = require("../models/DiagnosticResult");

// ── Machine registry ───────────────────────────────────────────────────────
const MACHINE_TYPES = ["XRAY", "CT", "MRI", "PCR", "ULTRASOUND", "BLOODWORK"];

// ── Simulated machine API fetch (replace with real machine API calls) ──────
// In production, replace each case with the actual HTTP call to the machine:
//   const response = await axios.get(`http://${machineHost}/api/results/latest`);
//   return response.data.results;

const fetchFromMachineAPI = async (machineType) => {
  /* Lines 15-55 omitted */

  while (picked.length < count && picked.length < pool.length) {/* Lines 57-62 omitted */}
  /* Lines 63-76 omitted */
};

// ─────────────────────────────────────────────────────────────────────────────
// importFromMachine
// POST /api/diagnostics/import/:machineType
// ─────────────────────────────────────────────────────────────────────────────
const importFromMachine = async (machineType, overrides = {}) => {/* Lines 83-109 omitted */};

// ─────────────────────────────────────────────────────────────────────────────
// importAllMachines
// POST /api/diagnostics/import-all
// ─────────────────────────────────────────────────────────────────────────────
const importAllMachines = async () => {/* Lines 116-128 omitted */};

// ─────────────────────────────────────────────────────────────────────────────
// getAllResults
// GET /api/diagnostics?machineType=CT&status=critical&page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────
const getAllResults = async (query = {}) => {/* Lines 135-158 omitted */};

// ─────────────────────────────────────────────────────────────────────────────
// getResultById
// GET /api/diagnostics/:id
// ─────────────────────────────────────────────────────────────────────────────
const getResultById = async (id) => {/* Lines 165-168 omitted */};

// ─────────────────────────────────────────────────────────────────────────────
// getResultsByPatient
// GET /api/diagnostics/patient/:patientId
// ─────────────────────────────────────────────────────────────────────────────
const getResultsByPatient = async (patientId) => {/* Lines 175-178 omitted */};

// ─────────────────────────────────────────────────────────────────────────────
// getResultsByMachine
// GET /api/diagnostics/machine/:machineType
// ─────────────────────────────────────────────────────────────────────────────
const getResultsByMachine = async (machineType, query = {}) => {/* Lines 185-193 omitted */};

// ─────────────────────────────────────────────────────────────────────────────
// getCriticalResults
// GET /api/diagnostics/critical
// ─────────────────────────────────────────────────────────────────────────────
const getCriticalResults = async () => {/* Lines 200-204 omitted */};

// ─────────────────────────────────────────────────────────────────────────────
// verifyResult
// PATCH /api/diagnostics/:id/verify
// ─────────────────────────────────────────────────────────────────────────────
const verifyResult = async (id, userId) => {/* Lines 211-219 omitted */};

// ─────────────────────────────────────────────────────────────────────────────
// deleteResult  (soft delete — sets isArchived: true)
// DELETE /api/diagnostics/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteResult = async (id) => {/* Lines 226-233 omitted */};

// ─────────────────────────────────────────────────────────────────────────────
// getImportStats
// GET /api/diagnostics/stats
// ─────────────────────────────────────────────────────────────────────────────
const getImportStats = async () => {/* Lines 240-272 omitted */};

// ── Exports ───────────────────────────────────────────────────────────────
module.exports = {
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
};
