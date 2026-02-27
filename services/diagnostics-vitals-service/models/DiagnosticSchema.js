// Stores results imported from X-Ray, CT, MRI, PCR machines via API

const mongoose = require("mongoose");

const DiagnosticResultSchema = new mongoose.Schema(
  {
    // ── Patient reference ─────────────────────────────────────────────
    patientId: {
      type: String,
      required: true,
      trim: true,
    },

    // ── Accession & machine info ───────────────────────────────────────
    accessionNo: {
      type: String,
      required: true,
      trim: true,
    },

    machineType: {
      type: String,
      required: true,
      enum: ["XRAY", "CT", "MRI", "PCR", "ULTRASOUND", "BLOODWORK"],
      uppercase: true,
    },

    machineId: {
      type: String,
      required: true,
      trim: true,
      // e.g. "XRAY-01", "CT-02", "MRI-01", "PCR-03"
    },

    // ── Study / test details ──────────────────────────────────────────
    finding: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Chest PA View", "MRI Lumbar Spine", "SARS-CoV-2 RT-PCR"
    },

    result: {
      type: String,
      required: true,
      trim: true,
      // Free-text result/impression from the machine or radiologist
    },

    status: {
      type: String,
      required: true,
      enum: ["normal", "abnormal", "critical", "pending"],
      default: "pending",
      lowercase: true,
    },

    // ── Assigned clinician ────────────────────────────────────────────
    reportedBy: {
      type: String,
      trim: true,
      // Radiologist or Pathologist name
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      // Doctor/admin who verified the imported result
    },

    verifiedAt: {
      type: Date,
      default: null,
    },

    // ── Import metadata ───────────────────────────────────────────────
    importSource: {
      type: String,
      enum: ["api", "manual", "hl7", "dicom", "lis"],
      default: "api",
    },

    importedAt: {
      type: Date,
      default: Date.now,
    },

    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // Stores original JSON from the machine API for audit/debugging
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
DiagnosticResultSchema.index({ patient: 1, machineType: 1 });
DiagnosticResultSchema.index({ accessionNo: 1 }, { unique: true });
DiagnosticResultSchema.index({ status: 1 });
DiagnosticResultSchema.index({ importedAt: -1 });

// ── Virtual: isCritical ────────────────────────────────────────────────────
DiagnosticResultSchema.virtual("isCritical").get(function () {
  return this.status === "critical";
});

module.exports = mongoose.model("DiagnosticResult", DiagnosticResultSchema);
