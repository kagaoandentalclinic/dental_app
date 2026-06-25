const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { getDentalIssueSql } = require('../utils/dentalChart');
const { logAudit } = require('../utils/auditLogs');
const { publicFormLimiter, checkHoneypot, checkTiming, checkDuplicateCooldown, checkDeviceId } = require('../middleware/antiSpam');
const {
    normalizePatientPayload,
    validateRequiredPatientFields,
    findExistingPatientId,
    createPatientWithSections,
    updatePatientSections,
    updateCoreSection,
    updateContactSection,
    updateProfileSection,
    updateInsuranceSection,
    getPatientDetail,
} = require('../utils/patientSections');

const validatePatientPayload = body().custom((_, { req }) => {
    const sections = normalizePatientPayload(req.body);
    const missing = validateRequiredPatientFields(sections);
    if (missing.length > 0) {
        throw new Error(`${missing.join(', ')} required`);
    }
    return true;
});

async function respondWithPatientDetail(res, patientId, statusCode = 200) {
    const detail = await getPatientDetail(pool, patientId);
    if (!detail) {
        return res.status(404).json({ error: 'Patient not found' });
    }
    return res.status(statusCode).json(detail);
}

function buildAuditActor(admin, source) {
    if (!admin) {
        return { adminId: null, role: 'public', source };
    }
    return { adminId: admin.id, role: admin.role, source };
}

function handleValidationErrors(req, res) {
    const errors = validationResult(req);
    if (errors.isEmpty()) return null;
    return res.status(400).json({ errors: errors.array() });
}

function buildPatientSearchWhereClause(searchQuery, visitDate, outstandingOnly) {
    const values = [searchQuery];
    const filters = [
        `p.is_active = true`,
        `(
            p.last_name ILIKE $1 OR p.first_name ILIKE $1
            OR CONCAT(p.last_name, ' ', p.first_name) ILIKE $1
            OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $1
            OR (CASE WHEN pc.patient_id IS NOT NULL THEN pc.phone ELSE p.phone END) ILIKE $1
            OR (CASE WHEN pc.patient_id IS NOT NULL THEN pc.email ELSE p.email END) ILIKE $1
        )`,
    ];

    if (outstandingOnly) {
        filters.push(`(
            EXISTS (
                SELECT 1
                FROM visits v_balance
                WHERE v_balance.patient_id = p.id
                  AND v_balance.payment_status IN ('pending', 'partial')
            )
            OR EXISTS (
                SELECT 1
                FROM orthodontic_cases oc_balance
                WHERE oc_balance.patient_id = p.id
                  AND oc_balance.status = 'active'
                  AND oc_balance.total_paid < oc_balance.total_cost
            )
        )`);
    }

    if (visitDate) {
        const visitFilters = ['v_filter.patient_id = p.id'];

        if (visitDate) {
            values.push(visitDate);
            visitFilters.push(`v_filter.visit_date::date = $${values.length}::date`);
        }

        filters.push(`EXISTS (
            SELECT 1
            FROM visits v_filter
            WHERE ${visitFilters.join(' AND ')}
        )`);
    }

    return {
        whereSql: filters.join('\n               AND '),
        values,
    };
}

// GET /api/patients - paginated + search
router.get('/', verifyToken, async (req, res) => {
    try {
        const {
            search = '',
            page = 1,
            limit = 15,
            sort = 'last_name',
            order = 'asc',
            visitDate = '',
            outstanding = '',
        } = req.query;

        const sortMap = {
            last_name: 'p.last_name',
            first_name: 'p.first_name',
            date_of_birth: 'p.date_of_birth',
            created_at: 'p.created_at',
            phone: `CASE WHEN pc.patient_id IS NOT NULL THEN pc.phone ELSE p.phone END`,
        };
        const sortCol = sortMap[sort] || sortMap.last_name;
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const searchQuery = `%${search}%`;
        const normalizedVisitDate = /^\d{4}-\d{2}-\d{2}$/.test(String(visitDate)) ? String(visitDate) : '';
        const outstandingOnly = String(outstanding) === '1' || String(outstanding).toLowerCase() === 'true';
        const { whereSql, values } = buildPatientSearchWhereClause(searchQuery, normalizedVisitDate, outstandingOnly);

        const countRes = await pool.query(
            `SELECT COUNT(*) FROM patients p
             LEFT JOIN patient_contacts pc ON pc.patient_id = p.id
             WHERE ${whereSql}`,
            values
        );

        const patientValues = [...values, parseInt(limit, 10), offset];
        const patientsRes = await pool.query(
            `SELECT
                p.id,
                p.last_name,
                p.first_name,
                p.middle_name,
                p.date_of_birth,
                p.sex,
                CASE WHEN pc.patient_id IS NOT NULL THEN pc.phone ELSE p.phone END AS phone,
                CASE WHEN pc.patient_id IS NOT NULL THEN pc.email ELSE p.email END AS email,
                CASE WHEN pc.patient_id IS NOT NULL THEN pc.address ELSE p.address END AS address,
                p.record_date,
                p.created_at,
                p.profile_photo,
                (
                  SELECT COUNT(*) FROM dental_chart dc
                  WHERE dc.patient_id = p.id AND ${getDentalIssueSql('dc')}
                ) AS dental_issues,
                (
                  SELECT MAX(v.visit_date) FROM visits v WHERE v.patient_id = p.id
                ) AS last_visit
             FROM patients p
             LEFT JOIN patient_contacts pc ON pc.patient_id = p.id
             WHERE ${whereSql}
             ORDER BY ${sortCol} ${sortOrder}
             LIMIT $${patientValues.length - 1} OFFSET $${patientValues.length}`,
            patientValues
        );

        res.json({
            patients: patientsRes.rows,
            total: parseInt(countRes.rows[0].count, 10),
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            totalPages: Math.ceil(parseInt(countRes.rows[0].count, 10) / parseInt(limit, 10)),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/patients/:id - single patient detail
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const detail = await getPatientDetail(pool, req.params.id);
        if (!detail) return res.status(404).json({ error: 'Patient not found' });
        res.json(detail);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/patients/intake - public, no auth required
router.post('/intake', publicFormLimiter, checkHoneypot, checkTiming, checkDeviceId, checkDuplicateCooldown, [
    validatePatientPayload,
], async (req, res) => {
    if (handleValidationErrors(req, res)) return;

    const sections = normalizePatientPayload(req.body);

    try {
        const existingPatientId = await findExistingPatientId(pool, sections.patient);
        if (existingPatientId) {
            const updated = await updatePatientSections(pool, existingPatientId, sections, null, buildAuditActor(null, 'public_intake'));
            if (!updated) return res.status(404).json({ error: 'Patient not found' });
            res.locals.recordSpamKey?.();
            return res.json({ updated: true, patientName: sections.patient.first_name });
        }

        await createPatientWithSections(pool, sections, null, buildAuditActor(null, 'public_intake'));
        res.locals.recordSpamKey?.();
        res.status(201).json({ updated: false, patientName: sections.patient.first_name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/patients - create
router.post('/', verifyToken, [
    validatePatientPayload,
], async (req, res) => {
    if (handleValidationErrors(req, res)) return;

    const sections = normalizePatientPayload(req.body);

    try {
        const existingPatientId = await findExistingPatientId(pool, sections.patient);
        if (existingPatientId) {
            const existing = await pool.query(
                `SELECT id, first_name, last_name, date_of_birth
                 FROM patients
                 WHERE id = $1`,
                [existingPatientId]
            );
            return res.status(409).json({
                error: 'A patient with this name and date of birth already exists in the system.',
                existingPatient: existing.rows[0],
            });
        }

        const inserted = await createPatientWithSections(pool, sections, req.admin.id, buildAuditActor(req.admin, 'staff_portal'));
        await respondWithPatientDetail(res, inserted.id, 201);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/patients/:id - update full patient detail (compatibility endpoint)
router.put('/:id', verifyToken, [
    validatePatientPayload,
], async (req, res) => {
    if (handleValidationErrors(req, res)) return;

    const sections = normalizePatientPayload(req.body);

    try {
        const updated = await updatePatientSections(pool, req.params.id, sections, req.admin.id, buildAuditActor(req.admin, 'staff_portal'));
        if (!updated) return res.status(404).json({ error: 'Patient not found' });
        await respondWithPatientDetail(res, req.params.id);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/patients/:id/core - targeted core patient update
router.put('/:id/core', verifyToken, [
    validatePatientPayload,
], async (req, res) => {
    if (handleValidationErrors(req, res)) return;

    const sections = normalizePatientPayload(req.body);

    try {
        const updated = await updateCoreSection(pool, req.params.id, sections.patient, buildAuditActor(req.admin, 'staff_portal'));
        if (!updated) return res.status(404).json({ error: 'Patient not found' });
        await respondWithPatientDetail(res, req.params.id);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/patients/:id/contact - targeted contact update
router.put('/:id/contact', verifyToken, async (req, res) => {
    try {
        const sections = normalizePatientPayload(req.body);
        const updated = await updateContactSection(pool, req.params.id, sections.contact, buildAuditActor(req.admin, 'staff_portal'));
        if (!updated) return res.status(404).json({ error: 'Patient not found' });
        await respondWithPatientDetail(res, req.params.id);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/patients/:id/profile - targeted profile update
router.put('/:id/profile', verifyToken, async (req, res) => {
    try {
        const sections = normalizePatientPayload(req.body);
        const updated = await updateProfileSection(pool, req.params.id, sections.profile, buildAuditActor(req.admin, 'staff_portal'));
        if (!updated) return res.status(404).json({ error: 'Patient not found' });
        await respondWithPatientDetail(res, req.params.id);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/patients/:id/insurance - targeted insurance update
router.put('/:id/insurance', verifyToken, async (req, res) => {
    try {
        const sections = normalizePatientPayload(req.body);
        const updated = await updateInsuranceSection(pool, req.params.id, sections.insurance, buildAuditActor(req.admin, 'staff_portal'));
        if (!updated) return res.status(404).json({ error: 'Patient not found' });
        await respondWithPatientDetail(res, req.params.id);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/patients/:id - soft delete
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const beforeDetail = await getPatientDetail(pool, req.params.id);
        const result = await pool.query(
            'UPDATE patients SET is_active=false, updated_at=NOW() WHERE id=$1 AND is_active=true RETURNING id',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
        await logAudit(pool, {
            actorAdminId: req.admin.id,
            actorRole: req.admin.role,
            entityType: 'patient',
            entityId: req.params.id,
            patientId: req.params.id,
            action: 'patient.archive',
            beforeData: beforeDetail,
            afterData: { id: req.params.id, is_active: false },
            metadata: { source: 'staff_portal' },
        });
        res.json({ message: 'Patient deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
