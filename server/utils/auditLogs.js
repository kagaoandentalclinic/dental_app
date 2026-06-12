let auditLogSchemaReadyPromise = null;

async function ensureAuditLogSchema(db) {
    if (!auditLogSchemaReadyPromise) {
        auditLogSchemaReadyPromise = db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
              id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
              actor_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
              actor_role VARCHAR(50),
              entity_type VARCHAR(100) NOT NULL,
              entity_id VARCHAR(100) NOT NULL,
              patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
              action VARCHAR(120) NOT NULL,
              before_data JSONB,
              after_data JSONB,
              metadata JSONB,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_patient ON audit_logs(patient_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
        `).catch(err => {
            auditLogSchemaReadyPromise = null;
            throw err;
        });
    }

    return auditLogSchemaReadyPromise;
}

async function logAudit(db, {
    actorAdminId = null,
    actorRole = null,
    entityType,
    entityId,
    patientId = null,
    action,
    beforeData = null,
    afterData = null,
    metadata = null,
}) {
    await ensureAuditLogSchema(db);
    await db.query(
        `INSERT INTO audit_logs (
            actor_admin_id, actor_role, entity_type, entity_id, patient_id, action,
            before_data, after_data, metadata, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [
            actorAdminId,
            actorRole,
            entityType,
            String(entityId),
            patientId,
            action,
            beforeData ? JSON.stringify(beforeData) : null,
            afterData ? JSON.stringify(afterData) : null,
            metadata ? JSON.stringify(metadata) : null,
        ]
    );
}

module.exports = { logAudit };
