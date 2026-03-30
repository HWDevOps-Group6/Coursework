// Business logic for importing and managing diagnostic results from machines

const DiagnosticResult = require("./DiagnosticSchema");
const mongoose = require("mongoose");
const MACHINE_TYPES = ["XRAY", "CT", "MRI", "PCR", "ULTRASOUND", "BLOODWORK"];
const RESULT_STATUSES = ["normal", "abnormal", "critical", "pending"];
const PATIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const requireNonEmptyString = (value, fieldName) => {
	if (typeof value !== "string") {
		throw new Error(`${fieldName} must be a string`);
	}

	const normalized = value.trim();
	if (!normalized) {
		throw new Error(`${fieldName} is required`);
	}

	return normalized;
};

const normalizePatientId = (patientId) => {
	const normalized = requireNonEmptyString(patientId, "patientId");
	if (!PATIENT_ID_PATTERN.test(normalized)) {
		throw new Error("patientId format is invalid");
	}
	return normalized;
};

const normalizeMachineType = (machineType) => {
	const normalized = requireNonEmptyString(machineType, "machineType").toUpperCase();
	if (!MACHINE_TYPES.includes(normalized)) {
		throw new Error(
			`Unknown machine type: ${normalized}. Valid types: ${MACHINE_TYPES.join(", ")}`,
		);
	}
	return normalized;
};

const normalizeStatus = (status) => {
	const normalized = requireNonEmptyString(status, "status").toLowerCase();
	if (!RESULT_STATUSES.includes(normalized)) {
		throw new Error(
			`Unknown status: ${normalized}. Valid statuses: ${RESULT_STATUSES.join(", ")}`,
		);
	}
	return normalized;
};

const normalizeOptional = (value, normalizer) => {
	if (value === undefined || value === null || value === "") return null;
	return normalizer(value);
};

const requirePatientId = (patientId, errorMessage) => {
	if (!patientId) {
		throw new Error(errorMessage);
	}
	return normalizePatientId(patientId);
};

const parsePositiveInt = (value, fallback, fieldName, max = Number.MAX_SAFE_INTEGER) => {
	if (value === undefined || value === null || value === "") return fallback;
	if (typeof value !== "string" && typeof value !== "number") {
		throw new Error(`${fieldName} must be a number`);
	}

	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new Error(`${fieldName} must be a positive integer`);
	}

	return Math.min(parsed, max);
};

const normalizeObjectId = (id, fieldName = "id") => {
	const normalized = requireNonEmptyString(id, fieldName);
	if (!mongoose.isValidObjectId(normalized)) {
		throw new Error(`${fieldName} is invalid`);
	}
	return normalized;
};

const maybePopulateVerifiedBy = (query) => {
	if (mongoose.models.User) {
		return query.populate("verifiedBy", "name role");
	}
	return query;
};

const fetchFromMachineAPI = async (machineType) => {
	const templates = {
		XRAY: [
			{
				finding: "Chest PA View",
				result: "No active cardiopulmonary disease. Heart size normal.",
				status: "normal",
			},
			{
				finding: "Lumbar Spine AP/Lateral",
				result: "Mild L4-L5 disc space narrowing. No spondylolisthesis.",
				status: "abnormal",
			},
			{
				finding: "Right Hand PA",
				result: "No fracture or dislocation noted. Soft tissues unremarkable.",
				status: "normal",
			},
		],
		CT: [
			{
				finding: "CT Brain Non-Contrast",
				result: "No intracranial hemorrhage or mass lesion identified.",
				status: "normal",
			},
			{
				finding: "CT Chest with Contrast",
				result: "3mm pulmonary nodule RUL — follow-up in 6 months recommended.",
				status: "pending",
			},
			{
				finding: "CT Abdomen/Pelvis",
				result: "Mild hepatomegaly. No focal hepatic lesion. No free fluid.",
				status: "abnormal",
			},
		],
		MRI: [
			{
				finding: "MRI Brain with Gadolinium",
				result:
					"No enhancing lesion. Mild periventricular white matter changes noted.",
				status: "abnormal",
			},
			{
				finding: "MRI Lumbar Spine",
				result: "L5-S1 disc protrusion with mild right nerve root compression.",
				status: "critical",
			},
			{
				finding: "MRI Right Knee",
				result: "Partial tear of ACL with moderate joint effusion.",
				status: "abnormal",
			},
		],
		PCR: [
			{
				finding: "SARS-CoV-2 RT-PCR",
				result: "Not Detected. Ct value: N/A.",
				status: "normal",
			},
			{
				finding: "Influenza A/B PCR",
				result: "Influenza A Detected. Ct value: 22.4.",
				status: "critical",
			},
			{
				finding: "MTB PCR Sputum",
				result: "Mycobacterium tuberculosis Not Detected.",
				status: "normal",
			},
		],
		ULTRASOUND: [
			{
				finding: "USG Abdomen",
				result:
					"Fatty liver grade II. Gallbladder polyp 4mm. No biliary dilation.",
				status: "abnormal",
			},
			{
				finding: "USG Thyroid",
				result:
					"Bilateral nodular goiter. Largest nodule 8mm in right lobe — TIRADS 3.",
				status: "pending",
			},
			{
				finding: "ECHO 2D",
				result: "LVEF 58%. No regional wall motion abnormality. Mild MR.",
				status: "normal",
			},
		],
		BLOODWORK: [
			{
				finding: "CBC with Differential",
				result:
					"Hb 9.2 g/dL (Low), WBC 11.2 K/µL (High), Plt 320 K/µL (Normal).",
				status: "critical",
			},
			{
				finding: "HbA1c",
				result: "7.8% — Poorly controlled diabetes mellitus.",
				status: "abnormal",
			},
			{
				finding: "Lipid Profile",
				result:
					"LDL 142 mg/dL (Borderline High), HDL 38 mg/dL (Low), TG 210 mg/dL (High).",
				status: "abnormal",
			},
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
		machineId: `${machineType}-${String(Math.floor(Math.random() * 9) + 1).padStart(2, "0")}`,
		accessionNo: `ACC${Date.now()}${Math.floor(Math.random() * 999)}`,
		reportedBy: ["Dr. Al-Farsi", "Dr. Hamdan", "Dr. Nair", "Dr. Krishnamurthy"][
			Math.floor(Math.random() * 4)
		],
		importSource: "api",
		importedAt: new Date(),
		rawPayload: { source: machineType, polledAt: new Date().toISOString() },
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
	const normalizedMachineType = normalizeMachineType(machineType);
	const normalizedPatientId = requirePatientId(
		overrides.patientId,
		"patientId is required for importing diagnostics",
	);

	const rawResults = await fetchFromMachineAPI(normalizedMachineType);

	const saved = [];
	for (const raw of rawResults) {
		const payload = {
			...raw,
			machineType: normalizedMachineType,
			patientId: normalizedPatientId,
			...(overrides.machineId && { machineId: overrides.machineId }),
		};

		// Skip if accessionNo already exists (idempotent import)
		const exists = await DiagnosticResult.findOne({
			accessionNo: payload.accessionNo,
		});
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
	const normalizedPatientId = requirePatientId(
		patientId,
		"patientId is required for importing diagnostics from all machines",
	);
	const summary = {};
	for (const machineType of MACHINE_TYPES) {
		try {
			const results = await importFromMachine(machineType, {
				patientId: normalizedPatientId,
			});
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
	const normalizedPatientId = requirePatientId(
		patientId,
		"patientId is required to fetch diagnostic results",
	);
	const normalizedMachineType = normalizeOptional(machineType, normalizeMachineType);
	const normalizedStatus = normalizeOptional(status, normalizeStatus);
	const normalizedPage = parsePositiveInt(page, 1, "page");
	const normalizedLimit = parsePositiveInt(limit, 20, "limit", 100);

	const skip = (normalizedPage - 1) * normalizedLimit;

	const baseFilter = { isArchived: false, patientId: normalizedPatientId };
	const filter = {
		...baseFilter,
		...(normalizedMachineType && { machineType: normalizedMachineType }),
		...(normalizedStatus && { status: normalizedStatus }),
	};

	const total = await DiagnosticResult.countDocuments(filter);
	const dataQuery = maybePopulateVerifiedBy(DiagnosticResult.find(filter));

	const data = await dataQuery
		.sort({ importedAt: -1 })
		.skip(skip)
		.limit(normalizedLimit);

	return {
		count: data.length,
		total,
		page: normalizedPage,
		totalPages: Math.ceil(total / normalizedLimit),
		data,
	};
};

// ─────────────────────────────────────────────────────────────────────────────
// getResultById
// GET /api/diagnostics/:id
// ─────────────────────────────────────────────────────────────────────────────
const getResultById = async (id) => {
	const normalizedId = normalizeObjectId(id);
	return maybePopulateVerifiedBy(DiagnosticResult.findById(normalizedId));
};

// ─────────────────────────────────────────────────────────────────────────────
// getResultsByPatient
// GET /api/diagnostics/patient/:patientId
// ─────────────────────────────────────────────────────────────────────────────
const getResultsByPatient = async (patientId) => {
	const normalizedPatientId = requirePatientId(
		patientId,
		"patientId is required to fetch diagnostic results by patient",
	);
	return maybePopulateVerifiedBy(
		DiagnosticResult.find({ patientId: normalizedPatientId, isArchived: false }),
	).sort({ importedAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// getResultsByMachine
// GET /api/diagnostics/machine/:machineType
// ─────────────────────────────────────────────────────────────────────────────
const getResultsByMachine = async (machineType, query = {}) => {
	const { status, patientId } = query;
	const normalizedPatientId = requirePatientId(
		patientId,
		"patientId is required to fetch diagnostic results by machine",
	);
	const normalizedMachineType = normalizeMachineType(machineType);
	const normalizedStatus = normalizeOptional(status, normalizeStatus);

	return maybePopulateVerifiedBy(
		DiagnosticResult.find({
			machineType: normalizedMachineType,
			isArchived: false,
			patientId: normalizedPatientId,
			...(normalizedStatus && { status: normalizedStatus }),
		}),
	).sort({ importedAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// getCriticalResults
// GET /api/diagnostics/critical
// ─────────────────────────────────────────────────────────────────────────────
const getCriticalResults = async (patientId) => {
	const normalizedPatientId = requirePatientId(
		patientId,
		"patientId is required to fetch critical diagnostic results",
	);
	return maybePopulateVerifiedBy(
		DiagnosticResult.find({
			status: "critical",
			isArchived: false,
			patientId: normalizedPatientId,
		}),
	).sort({ importedAt: -1 });
};

// ─────────────────────────────────────────────────────────────────────────────
// verifyResult
// PATCH /api/diagnostics/:id/verify
// ─────────────────────────────────────────────────────────────────────────────
const verifyResult = async (id, userId) => {
	const normalizedId = normalizeObjectId(id);
	const normalizedUserId = normalizeObjectId(userId, "userId");
	const result = await DiagnosticResult.findById(normalizedId);
	if (!result) throw new Error("Diagnostic result not found");

	result.verifiedBy = normalizedUserId;
	result.verifiedAt = new Date();
	await result.save();

	return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// deleteResult  (soft delete — sets isArchived: true)
// DELETE /api/diagnostics/:id
// ─────────────────────────────────────────────────────────────────────────────
const deleteResult = async (id) => {
	const normalizedId = normalizeObjectId(id);
	const result = await DiagnosticResult.findByIdAndUpdate(
		normalizedId,
		{ isArchived: true },
		{ new: true },
	);
	if (!result) throw new Error("Diagnostic result not found");
	return result;
};

// ─────────────────────────────────────────────────────────────────────────────
// getImportStats
// GET /api/diagnostics/stats
// ─────────────────────────────────────────────────────────────────────────────
const getImportStats = async (patientId) => {
	const normalizedPatientId = requirePatientId(
		patientId,
		"patientId is required to fetch diagnostic import stats",
	);
	const [total, critical, pending, abnormal, byMachine] = await Promise.all([
		DiagnosticResult.countDocuments({
			isArchived: false,
			patientId: normalizedPatientId,
		}),
		DiagnosticResult.countDocuments({
			status: "critical",
			isArchived: false,
			patientId: normalizedPatientId,
		}),
		DiagnosticResult.countDocuments({
			status: "pending",
			isArchived: false,
			patientId: normalizedPatientId,
		}),
		DiagnosticResult.countDocuments({
			status: "abnormal",
			isArchived: false,
			patientId: normalizedPatientId,
		}),
		DiagnosticResult.aggregate([
			{ $match: { isArchived: false, patientId: normalizedPatientId } },
			{ $group: { _id: "$machineType", count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
		]),
	]);

	// Today's imports
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const today = await DiagnosticResult.countDocuments({
		importedAt: { $gte: startOfDay },
		isArchived: false,
		patientId: normalizedPatientId,
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
