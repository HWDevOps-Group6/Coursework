const AUDIT_SOURCES = ['manual', 'device', 'api'];

const auditFieldDefinitions = {
  createdBy: { type: String, required: true, trim: true },
  updatedBy: { type: String, required: true, trim: true },
  source: { type: String, required: true, enum: AUDIT_SOURCES, trim: true },
};

module.exports = {
  AUDIT_SOURCES,
  auditFieldDefinitions,
};
