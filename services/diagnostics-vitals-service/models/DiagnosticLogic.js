// Business logic for importing and managing diagnostic results from machines

const DiagnosticResult = require("./DiagnosticSchema");
const MACHINE_TYPES = ["XRAY", "CT", "MRI", "PCR", "ULTRASOUND", "BLOODWORK"];

const fetchFromMachineAPI = async (machineType) => {
  const templates = {
    XRAY: [
      { finding: "Chest PA View",          result: "No active cardiopulmonary disease. Heart size normal.", status: "normal" },
      { finding: "Lumbar Spine AP/Lateral", result: "Mild L4-L5 disc space narrowing. No spondylolisthesis.", status: "abnormal" },
      { finding: "Right Hand PA",           result: "No fracture or dislocation noted. Soft tissues unremarkable.", status: "normal" },
    ],
    CT: [
      { finding: "CT Brain Non-Contrast",   result: "No intracranial hemorrhage or mass lesion identified.", status: "normal" },
      { finding: "CT Chest with Contrast",  result: "3mm pulmonary nodule RUL — follow-up in 6 months recommended.", status: "pending" },
      { finding: "CT Abdomen/Pelvis",       result: "Mild hepatomegaly. No focal hepatic lesion. No free fluid.", status: "abnormal" },
    ],
    MRI: [
      { finding: "MRI Brain with Gadolinium", result: "No enhancing lesion. Mild periventricular white matter changes noted.", status: "abnormal" },
      { finding: "MRI Lumbar Spine",          result: "L5-S1 disc protrusion with mild right nerve root compression.", status: "critical" },
      { finding: "MRI Right Knee",            result: "Partial tear of ACL with moderate joint effusion.", status: "abnormal" },
    ],
    PCR: [
      { finding: "SARS-CoV-2 RT-PCR",     result: "Not Detected. Ct value: N/A.", status: "normal" },
      { finding: "Influenza A/B PCR",      result: "Influenza A Detected. Ct value: 22.4.", status: "critical" },
      { finding: "MTB PCR Sputum",         result: "Mycobacterium tuberculosis Not Detected.", status: "normal" },
    ],
    ULTRASOUND: [
      { finding: "USG Abdomen",   result: "Fatty liver grade II. Gallbladder polyp 4mm. No biliary dilation.", status: "abnormal" },
      { finding: "USG Thyroid",   result: "Bilateral nodular goiter. Largest nodule 8mm in right lobe — TIRADS 3.", status: "pending" },
      { finding: "ECHO 2D",       result: "LVEF 58%. No regional wall motion abnormality. Mild MR.", status: "normal" },
    ],
    BLOODWORK: [
      { finding: "CBC with Differential", result: "Hb 9.2 g/dL (Low), WBC 11.2 K/µL (High), Plt 320 K/µL (Normal).", status: "critical" },
      { finding: "HbA1c",                 result: "7.8% — Poorly controlled diabetes mellitus.", status: "abnormal" },
      { finding: "Lipid Profile",         result: "LDL 142 mg/dL (Borderline High), HDL 38 mg/dL (Low), TG 210 mg/dL (High).", status: "abnormal" },
    ],
  };

  // Simulate network latency from machine
  await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));

  const pool = templates[machineType] || [];
  const count = Math.floor(Math.random() * 2) + 1; // 1–2 results per machine poll
  const picked = [];
  const used = new Set();

  while (picked.length < count && picked.length < pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    if (!used.has(idx)) {
      used.add(idx);
      picked.push(pool[idx]);
    }
  }

  return picked.map((t) => ({
    ...t,
    machineId:   `${machineType}-${String(Math.floor(Math.random() * 9) + 1).padStart(2, "0")}`,
    accessionNo: `ACC${Date.now()}${Math.floor(Math.random() * 999)}`,
    reportedBy:  ["Dr. Al-Farsi", "Dr. Hamdan", "Dr. Nair", "Dr. Krishnamurthy"][Math.floor(Math.random() * 4)],
    importSource: "api",
    importedAt:  new Date(),
    rawPayload:  { source: machineType, polledAt: new Date().toISOString() },
    // NOTE: In real usage, patientId comes from the machine payload or req.body override
    patientId: `P-${10000 + Math.floor(Math.random() * 9000)}`,
  }));
};

// ─────────────────────────────────────────────────────────────────────────────
// importFromMachine
// POST /api/diagnostics/import/:machineType
// ─────────────────────────────────────────────────────────────────────────────
// Always require patientId for import
const importFromMachine = async (machineType, overrides = {}) => {
  if (!MACHINE_TYPES.includes(machineType)) {
    throw new Error(`Unknown machine type: ${machineType}. Valid types: ${MACHINE_TYPES.join(", ")}`);
  }
  if (!overrides.patientId) {
    throw new Error("patientId is required for importing diagnostics");
  }

  const rawResults = await fetchFromMachineAPI(machineType);

  const saved = [];
  for (const raw of rawResults) {
    const payload = {
      ...raw,
      machineType,
      patientId: overrides.patientId,
      ...(overrides.machineId && { machineId: overrides.machineId }),
    };

    // Skip if accessionNo already exists (idempotent import)
    const exists = await DiagnosticResult.findOne({ accessionNo: payload.accessionNo });
    if (exists) continue;

    const doc = await DiagnosticResult.create(payload);
    saved.push(doc);
  }

  return saved;
};

// ─────────────────────────────────────────────────────────────────────────────
// importAllMachines
// POST /api/diagnostics/import-all
// ─────────────────────────────────────────────────────────────────────────────
// Require patientId for importAllMachines as well
const importAllMachines = async (patientId) => {
  if (!patientId) throw new Error("patientId is required for importing diagnostics from all machines");
  const summary = {};
  for (const machineType of MACHINE_TYPES) {
    try {
      const results = await importFromMachine(machineType, { patientId });
      summary[machineType] = { success: true, imported: results.length };
    } catch (err) {
      summary[machineType] = { success: false, error: err.message };
    }
  }
  return summary;
};

// ─────────────────────────────────────────────────────────────────────────────
// getAllResults
// GET /api/diagnostics?machineType=CT&status=critical&page=1&limit=20
// ─────────────────────────────────────────────────────────────────────────────
// Require patientId for getAllResults
const getAllResults = async (query = {}) => {
  const { machineType, status, page = 1, limit = 20, patientId } = query;
  if (!patientId) throw new Error("patientId is required to fetch diagnostic results");

  const filter = { isArchived: false, patientId };
  if (machineType) filter.machineType = machineType.toUpperCase();
  if (status)      filter.status      = status.toLowerCase();

  const skip  = (Number(page) - 1) * Number(limit);
  const total = await DiagnosticResult.countDocuments(filter);

  const data = await DiagnosticResult.find(filter)
    .populate("verifiedBy", "name role")
    .sort({ importedAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  return {
    count: data.length,
    total,
    page:       Number(page),
    totalPages: Math.ceil(total / Number(limit)),
    data,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// getResultById
// GET /api/diagnostics/:id
// ─────────────────────────────────────────────────────────────────────────────
const getResultById = async (id) => {
  return DiagnosticResult.findById(id)
    .populate("verifiedBy", "name role");
};

// ─────────────────────────────────────────────────────────────────────────────
// getResultsByPatient
// GET /api/diagnostics/patient/:patientId
// ─────────────────────────────────────────────────────────────────────────────
const getResultsByPatient = async (patientId) => {
  if (!patientId) throw new Error("patientId is required to fetch diagnostic results by patient");
  return DiagnosticResult.find({ patientId, isArchived: false })
    .populate("verifiedBy", "name role")
    .sort({ importedAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// getResultsByMachine
// GET /api/diagnostics/machine/:machineType
// ─────────────────────────────────────────────────────────────────────────────
const getResultsByMachine = async (machineType, query = {}) => {
  const { status, patientId } = query;
  if (!patientId) throw new Error("patientId is required to fetch diagnostic results by machine");
  const filter = { machineType, isArchived: false, patientId };
  if (status) filter.status = status.toLowerCase();

  return DiagnosticResult.find(filter)
    .populate("verifiedBy", "name role")
    .sort({ importedAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// getCriticalResults
// GET /api/diagnostics/critical
// ─────────────────────────────────────────────────────────────────────────────
const getCriticalResults = async (patientId) => {
  if (!patientId) throw new Error("patientId is required to fetch critical diagnostic results");
  return DiagnosticResult.find({ status: "critical", isArchived: false, patientId })
    .populate("verifiedBy", "name role")
    .sort({ importedAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// verifyResult
// PATCH /api/diagnostics/:id/verify
// ─────────────────────────────────────────────────────────────────────────────
const verifyResult = async (id, userId) => {
  const result = await DiagnosticResult.findById(id);
  if (!result) throw new Error("Diagnostic result not found");

  result.verifiedBy = userId;
  result.verifiedAt = new Date();
  await result.save();

  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// deleteResult  (soft delete — sets isArchived: true)
// DELETE /api/diagnostics/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteResult = async (id) => {
  const result = await DiagnosticResult.findByIdAndUpdate(
    id,
    { isArchived: true },
    { new: true }
  );
  if (!result) throw new Error("Diagnostic result not found");
  return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// getImportStats
// GET /api/diagnostics/stats
// ─────────────────────────────────────────────────────────────────────────────
const getImportStats = async (patientId) => {
  if (!patientId) throw new Error("patientId is required to fetch diagnostic import stats");
  const [total, critical, pending, abnormal, byMachine] = await Promise.all([
    DiagnosticResult.countDocuments({ isArchived: false, patientId }),
    DiagnosticResult.countDocuments({ status: "critical",  isArchived: false, patientId }),
    DiagnosticResult.countDocuments({ status: "pending",   isArchived: false, patientId }),
    DiagnosticResult.countDocuments({ status: "abnormal",  isArchived: false, patientId }),
    DiagnosticResult.aggregate([
      { $match: { isArchived: false, patientId } },
      { $group: { _id: "$machineType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  // Today's imports
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const today = await DiagnosticResult.countDocuments({
    importedAt:  { $gte: startOfDay },
    isArchived:  false,
    patientId,
  });

  return {
    total,
    today,
    critical,
    pending,
    abnormal,
    normal: total - critical - pending - abnormal,
    byMachine: byMachine.reduce((acc, m) => {
      acc[m._id] = m.count;
      return acc;
    }, {}),
  };
};

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