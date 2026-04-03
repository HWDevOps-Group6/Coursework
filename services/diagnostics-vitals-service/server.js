require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoose = require("mongoose");
const { verifyToken } = require("./middleware/verifyToken");
const { authorizeRole } = require("./middleware/authorizeRole");
const Vitals = require("./models/VitalsSchema");
const { connectDatabase } = require("./config/database");
const {
	AUDIT_SOURCES,
} = require("../../shared/models/audit");

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
} = require("./models/DiagnosticLogic");

const MACHINE_TYPES = ["XRAY", "CT", "MRI", "PCR", "ULTRASOUND", "BLOODWORK"];
const PATIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const VITALS_CREATE_FIELDS = [
	"temperature",
	"bp_systolic",
	"bp_diastolic",
	"pulse",
];

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

const optionalString = (value, fieldName) => {
	if (value === undefined || value === null || value === "") return undefined;
	return requireNonEmptyString(value, fieldName);
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

const normalizeAuditSource = (source) => {
	if (source === undefined) return "device";

	const normalized = requireNonEmptyString(source, "source").toLowerCase();
	if (!AUDIT_SOURCES.includes(normalized)) {
		throw new Error(
			`Unknown source: ${normalized}. Valid sources: ${AUDIT_SOURCES.join(", ")}`,
		);
	}

	return normalized;
};

const buildVitalsCreatePayload = (patientId, body = {}, user = {}) => {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		throw new Error("Request body must be an object");
	}

	const vitalsPayload = VITALS_CREATE_FIELDS.reduce((payload, fieldName) => {
		if (body[fieldName] !== undefined) {
			payload[fieldName] = body[fieldName];
		}
		return payload;
	}, {});

	const createdBy = user?.name ? requireNonEmptyString(user.name, "createdBy") : "IoT Device";

	return {
		patientId: normalizePatientId(patientId),
		...vitalsPayload,
		source: normalizeAuditSource(body.source),
		createdBy,
		updatedBy: createdBy,
	};
};

const app = express();

const diagnosticsAccess = [verifyToken, authorizeRole("doctor", "clinician")];

const sendServerError = (res, err) => {
	res.status(500).json({ success: false, message: err.message });
};

const sendSuccessList = (res, results) => {
	res.status(200).json({ success: true, count: results.length, data: results });
};

const diagnosticsHandler = (handler) => async (req, res) => {
	try {
		await handler(req, res);
	} catch (err) {
		sendServerError(res, err);
	}
};

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 100,
	message: {
		success: false,
		error: {
			code: "RATE_LIMIT_EXCEEDED",
			message: "Too many requests from this IP",
		},
	},
});
app.use("/api/", limiter);

// Health check
app.get("/health", (req, res) => {
	const stateMap = {
		0: "disconnected",
		1: "connected",
		2: "connecting",
		3: "disconnecting",
	};
	res.status(200).json({
		success: true,
		service: "diagnostics-vitals-service",
		message: "Diagnostics & Vitals service is running",
		timestamp: new Date().toISOString(),
		dependencies: {
			database: stateMap[mongoose.connection.readyState] || "unknown",
		},
	});
});

// Vitals endpoints (logic inlined)
app.post(
	"/api/vitals/:patientId",
	verifyToken,
	authorizeRole("doctor", "nurse"),
	async (req, res) => {
		try {
			const vitals = await Vitals.create(
				buildVitalsCreatePayload(req.params.patientId, req.body, req.user),
			);

			res.status(201).json(vitals);
		} catch (err) {
			res.status(400).json({ error: err.message });
		}
	},
);

app.get(
	"/api/vitals/:patientId",
	verifyToken,
	authorizeRole("doctor"),
	async (req, res) => {
		try {
			const patientId = normalizePatientId(req.params.patientId);
			const vitals = await Vitals.find({ patientId })
				.sort({ createdAt: -1 })
				.limit(24);
			res.json(vitals);
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	},
);

// Diagnostics
// ──────────────────────────────────────────────────────────────────────────
// IMPORT ROUTES
// ──────────────────────────────────────────────────────────────────────────

app.post(
	"/import/:machineType",
	...diagnosticsAccess,
	diagnosticsHandler(async (req, res) => {
		const machineType = normalizeMachineType(req.params.machineType);
		const results = await importFromMachine(machineType, req.body);
		res.status(201).json({
			success: true,
			message: `Imported ${results.length} result(s) from ${machineType}`,
			count: results.length,
			data: results,
		});
	}),
);

app.post(
	"/import-all",
	...diagnosticsAccess,
	diagnosticsHandler(async (req, res) => {
		const { patientId } = req.body || {};
		const summary = await importAllMachines(patientId);
		res.status(201).json({
			success: true,
			message: "All machines polled successfully",
			summary,
		});
	}),
);

// ──────────────────────────────────────────────────────────────────────────
// READ ROUTES
// ──────────────────────────────────────────────────────────────────────────

app.get(
	"/stats",
	...diagnosticsAccess,
	diagnosticsHandler(async (req, res) => {
		const patientId = normalizePatientId(req.query.patientId);
		const stats = await getImportStats(patientId);
		res.status(200).json({ success: true, data: stats });
	}),
);

app.get(
	"/critical",
	...diagnosticsAccess,
	diagnosticsHandler(async (req, res) => {
		const patientId = normalizePatientId(req.query.patientId);
		const results = await getCriticalResults(patientId);
		sendSuccessList(res, results);
	}),
);

app.get(
	"/",
	...diagnosticsAccess,
	diagnosticsHandler(async (req, res) => {
		const safeQuery = {
			patientId: normalizePatientId(req.query.patientId),
			machineType: optionalString(req.query.machineType, "machineType"),
			status: optionalString(req.query.status, "status"),
			page: optionalString(req.query.page, "page"),
			limit: optionalString(req.query.limit, "limit"),
		};
		const results = await getAllResults(safeQuery);
		res.status(200).json({ success: true, ...results });
	}),
);

app.get(
	"/machine/:machineType",
	...diagnosticsAccess,
	diagnosticsHandler(async (req, res) => {
		const machineType = normalizeMachineType(req.params.machineType);
		const safeQuery = {
			patientId: normalizePatientId(req.query.patientId),
			status: optionalString(req.query.status, "status"),
		};
		const results = await getResultsByMachine(machineType, safeQuery);
		sendSuccessList(res, results);
	}),
);

app.get(
	"/patient/:patientId",
	...diagnosticsAccess,
	diagnosticsHandler(async (req, res) => {
		const patientId = normalizePatientId(req.params.patientId);
		const results = await getResultsByPatient(patientId);
		sendSuccessList(res, results);
	}),
);

app.get(
	"/:id",
	...diagnosticsAccess,
	diagnosticsHandler(async (req, res) => {
		const result = await getResultById(req.params.id);
		if (!result)
			return res
				.status(404)
				.json({ success: false, message: "Result not found" });
		res.status(200).json({ success: true, data: result });
	}),
);

// ──────────────────────────────────────────────────────────────────────────
// UPDATE / DELETE ROUTES
// ──────────────────────────────────────────────────────────────────────────

app.patch(
	"/:id/verify",
	...diagnosticsAccess,
	diagnosticsHandler(async (req, res) => {
		const result = await verifyResult(req.params.id, req.user.userId);
		res
			.status(200)
			.json({ success: true, message: "Result verified", data: result });
	}),
);

app.delete("/:id", verifyToken, authorizeRole("admin"), async (req, res) => {
	try {
		await deleteResult(req.params.id);
		res.status(200).json({ success: true, message: "Result archived" });
	} catch (err) {
		sendServerError(res, err);
	}
});

// Vitals service

const PORT =
	process.env.DIAGNOSTICS_VITALS_SERVICE_PORT || process.env.PORT || 3004;
connectDatabase()
	.then(() => {
		app.listen(PORT, () => {
			console.log(
				`[Diagnostics Vitals] Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`,
			);
		});
	})
	.catch((error) => {
		console.error(
			"[Diagnostics Vitals] Failed to connect to MongoDB:",
			error.message,
		);
		process.exit(1);
	});

module.exports = app;
