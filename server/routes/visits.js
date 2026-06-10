const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

function normalizeOptionalText(value) {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

function normalizeTeethTreated(value) {
    if (value == null || value === '') return null;

    const rawValues = Array.isArray(value)
        ? value
        : String(value).match(/\d+/g) || [];

    const normalized = rawValues
        .map((item) => Number.parseInt(String(item), 10))
        .filter((item) => Number.isInteger(item) && item > 0);

    if (normalized.length === 0) {
        throw new Error('Teeth treated must include at least one valid tooth number');
    }

    return [...new Set(normalized)];
}

// GET /api/patients/:id/visits
router.get('/', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const countRes = await pool.query(
            'SELECT COUNT(*) FROM visits WHERE patient_id = $1', [id]
        );
        const visitsRes = await pool.query(`
      SELECT v.*, a.full_name AS dentist_name
      FROM visits v
      LEFT JOIN admins a ON v.dentist_id = a.id
      WHERE v.patient_id = $1
      ORDER BY v.visit_date DESC
      LIMIT $2 OFFSET $3
    `, [id, parseInt(limit), offset]);

        res.json({
            visits: visitsRes.rows,
            total: parseInt(countRes.rows[0].count),
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/patients/:id/visits
router.post('/', verifyToken, async (req, res) => {
    const {
        visit_date, visit_type, chief_complaint, diagnosis, treatment_performed,
        teeth_treated, prescriptions, next_appointment, cost, payment_status, notes,
    } = req.body;

    const normalizedTreatment = normalizeOptionalText(treatment_performed);
    const normalizedVisitType = normalizeOptionalText(visit_type);

    if (!normalizedTreatment) return res.status(400).json({ error: 'Treatment performed is required' });
    if (!normalizedVisitType) return res.status(400).json({ error: 'Visit type is required' });

    try {
        const normalizedTeeth = normalizeTeethTreated(teeth_treated);
        const result = await pool.query(`
      INSERT INTO visits (
        patient_id, dentist_id, visit_date, visit_type, chief_complaint,
        diagnosis, treatment_performed, teeth_treated, prescriptions,
        next_appointment, cost, payment_status, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `, [
            req.params.id, req.admin.id,
            visit_date || new Date().toISOString(),
            normalizedVisitType,
            normalizeOptionalText(chief_complaint),
            normalizeOptionalText(diagnosis),
            normalizedTreatment,
            normalizedTeeth,
            normalizeOptionalText(prescriptions),
            next_appointment || null,
            cost || null,
            normalizeOptionalText(payment_status) || 'pending',
            normalizeOptionalText(notes),
        ]);

        // Fetch with dentist name
        const full = await pool.query(`
      SELECT v.*, a.full_name AS dentist_name
      FROM visits v LEFT JOIN admins a ON v.dentist_id = a.id
      WHERE v.id = $1
    `, [result.rows[0].id]);

        res.status(201).json(full.rows[0]);
    } catch (err) {
        if (err.message === 'Teeth treated must include at least one valid tooth number') {
            return res.status(400).json({ error: err.message });
        }
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/visits/:id
router.put('/:visitId', verifyToken, async (req, res) => {
    const {
        visit_date, visit_type, chief_complaint, diagnosis, treatment_performed,
        teeth_treated, prescriptions, next_appointment, cost, payment_status, notes,
    } = req.body;
    const normalizedTreatment = normalizeOptionalText(treatment_performed);
    const normalizedVisitType = normalizeOptionalText(visit_type);

    if (!normalizedTreatment) return res.status(400).json({ error: 'Treatment performed is required' });
    if (!normalizedVisitType) return res.status(400).json({ error: 'Visit type is required' });

    try {
        const normalizedTeeth = normalizeTeethTreated(teeth_treated);
        const result = await pool.query(`
      UPDATE visits SET
        visit_date=$1, visit_type=$2, chief_complaint=$3, diagnosis=$4,
        treatment_performed=$5, teeth_treated=$6, prescriptions=$7,
        next_appointment=$8, cost=$9, payment_status=$10, notes=$11
      WHERE id=$12
      RETURNING *
    `, [
            visit_date || new Date().toISOString(),
            normalizedVisitType,
            normalizeOptionalText(chief_complaint),
            normalizeOptionalText(diagnosis),
            normalizedTreatment,
            normalizedTeeth,
            normalizeOptionalText(prescriptions),
            next_appointment || null,
            cost || null,
            normalizeOptionalText(payment_status) || 'pending',
            normalizeOptionalText(notes),
            req.params.visitId,
        ]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Visit not found' });

        const full = await pool.query(`
      SELECT v.*, a.full_name AS dentist_name
      FROM visits v LEFT JOIN admins a ON v.dentist_id = a.id
      WHERE v.id = $1
    `, [result.rows[0].id]);

        res.json(full.rows[0]);
    } catch (err) {
        if (err.message === 'Teeth treated must include at least one valid tooth number') {
            return res.status(400).json({ error: err.message });
        }
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/visits/:id
router.delete('/:visitId', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM visits WHERE id=$1 RETURNING id',
            [req.params.visitId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Visit not found' });
        res.json({ message: 'Visit deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
