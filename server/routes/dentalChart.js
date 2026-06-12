const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

const VALID_TOOTH_STATUSES = new Set([
    'healthy',
    'cavity',
    'root_fragment',
    'filled',
    'crown',
    'missing',
    'root_canal',
    'extracted',
    'implant',
    'bridge',
    'veneer',
]);
const DENTAL_CHART_STATUS_CHECK = `
    CHECK (status IN (
        'healthy', 'cavity', 'root_fragment', 'filled', 'crown', 'missing',
        'root_canal', 'extracted', 'implant', 'bridge', 'veneer'
    ))
`;
let dentalChartSchemaReadyPromise = null;

function isValidToothStatus(status) {
    return VALID_TOOTH_STATUSES.has(status || 'healthy');
}

async function ensureDentalChartSchema() {
    if (!dentalChartSchemaReadyPromise) {
        dentalChartSchemaReadyPromise = (async () => {
            await pool.query('ALTER TABLE dental_chart DROP CONSTRAINT IF EXISTS dental_chart_status_check');
            await pool.query(
                `ALTER TABLE dental_chart ADD CONSTRAINT dental_chart_status_check ${DENTAL_CHART_STATUS_CHECK}`
            );
        })().catch(err => {
            dentalChartSchemaReadyPromise = null;
            throw err;
        });
    }

    return dentalChartSchemaReadyPromise;
}

// Helper: ensure all 32 teeth exist for a patient
async function ensureTeeth(patientId, adminId) {
    const existing = await pool.query(
        'SELECT tooth_number FROM dental_chart WHERE patient_id = $1',
        [patientId]
    );
    const existingNums = new Set(existing.rows.map(r => r.tooth_number));
    const missing = [];
    for (let i = 1; i <= 32; i++) {
        if (!existingNums.has(i)) missing.push(i);
    }
    if (missing.length > 0) {
        const values = missing.map((n, i) =>
            `($1, $${i + 2}, 'healthy', $${missing.length + 2})`
        ).join(', ');
        const params = [patientId, ...missing, adminId];
        await pool.query(
            `INSERT INTO dental_chart (patient_id, tooth_number, status, updated_by) VALUES ${values} ON CONFLICT DO NOTHING`,
            params
        );
    }
}

// GET /api/patients/:id/dental-chart
router.get('/', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        await ensureDentalChartSchema();
        await ensureTeeth(id, req.admin.id);
        const result = await pool.query(
            `SELECT dc.*, a.full_name AS updated_by_name
       FROM dental_chart dc
       LEFT JOIN admins a ON dc.updated_by = a.id
       WHERE dc.patient_id = $1
       ORDER BY dc.tooth_number`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/patients/:id/dental-chart/bulk
router.put('/bulk', verifyToken, async (req, res) => {
    const { teeth } = req.body;
    if (!Array.isArray(teeth)) return res.status(400).json({ error: 'teeth must be an array' });
    const invalidTooth = teeth.find(t => !isValidToothStatus(t.status));
    if (invalidTooth) {
        return res.status(400).json({
            error: `Invalid tooth status for tooth #${invalidTooth.tooth_number || 'unknown'}`,
        });
    }

    const client = await pool.connect();
    try {
        await ensureDentalChartSchema();
        await client.query('BEGIN');
        for (const t of teeth) {
            await client.query(`
        INSERT INTO dental_chart (patient_id, tooth_number, status, surface, notes, updated_by, last_updated)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (patient_id, tooth_number) DO UPDATE SET
          status = EXCLUDED.status,
          surface = EXCLUDED.surface,
          notes = EXCLUDED.notes,
          updated_by = EXCLUDED.updated_by,
          last_updated = NOW()
      `, [req.params.id, t.tooth_number, t.status || 'healthy', t.surface || null, t.notes || null, req.admin.id]);
        }
        await client.query('COMMIT');

        const result = await pool.query(
            'SELECT * FROM dental_chart WHERE patient_id = $1 ORDER BY tooth_number',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        if (err.code === '23514') {
            return res.status(400).json({ error: 'The selected tooth status is not supported yet. Please refresh and try again.' });
        }
        res.status(500).json({ error: 'Failed to save dental chart' });
    } finally {
        client.release();
    }
});

// PUT /api/patients/:id/dental-chart/:toothNumber
router.put('/:toothNumber', verifyToken, async (req, res) => {
    const { id, toothNumber } = req.params;
    const { status, surface, notes, extra_label } = req.body;
    if (!isValidToothStatus(status)) {
        return res.status(400).json({ error: `Invalid tooth status for tooth #${toothNumber}` });
    }

    try {
        await ensureDentalChartSchema();
        const result = await pool.query(`
      INSERT INTO dental_chart (patient_id, tooth_number, status, surface, notes, extra_label, updated_by, last_updated)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (patient_id, tooth_number) DO UPDATE SET
        status = EXCLUDED.status,
        surface = EXCLUDED.surface,
        notes = EXCLUDED.notes,
        extra_label = COALESCE(EXCLUDED.extra_label, dental_chart.extra_label),
        updated_by = EXCLUDED.updated_by,
        last_updated = NOW()
      RETURNING *
    `, [id, parseInt(toothNumber), status || 'healthy', surface || null, notes || null, extra_label || null, req.admin.id]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.code === '23514') {
            return res.status(400).json({ error: 'The selected tooth status is not supported yet. Please refresh and try again.' });
        }
        res.status(500).json({ error: 'Failed to save tooth status' });
    }
});

// POST /api/patients/:id/dental-chart/extra — add a supernumerary tooth
router.post('/extra', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { extra_label } = req.body;

    if (!extra_label || !extra_label.trim()) {
        return res.status(400).json({ error: 'extra_label is required' });
    }

    try {
        await ensureDentalChartSchema();
        // Find next available tooth number >= 33
        const maxRes = await pool.query(
            'SELECT COALESCE(MAX(tooth_number), 32) AS max_num FROM dental_chart WHERE patient_id = $1 AND tooth_number >= 33',
            [id]
        );
        const nextNum = parseInt(maxRes.rows[0].max_num) + 1;

        const result = await pool.query(`
            INSERT INTO dental_chart
                (patient_id, tooth_number, status, is_extra, extra_label, updated_by, last_updated)
            VALUES ($1, $2, 'healthy', true, $3, $4, NOW())
            RETURNING *
        `, [id, nextNum, extra_label.trim(), req.admin.id]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/patients/:id/dental-chart/:toothNumber — only allowed for extra teeth
router.delete('/:toothNumber', verifyToken, async (req, res) => {
    const { id, toothNumber } = req.params;
    const num = parseInt(toothNumber);

    if (num <= 32) {
        return res.status(400).json({ error: 'Standard teeth cannot be deleted, only their status can be changed' });
    }

    try {
        const result = await pool.query(
            'DELETE FROM dental_chart WHERE patient_id = $1 AND tooth_number = $2 AND is_extra = true RETURNING id',
            [id, num]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Extra tooth not found' });
        res.json({ message: 'Extra tooth removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
