const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { normalizeClinicTimezoneOffset } = require('../utils/appointmentDate');

function normalizeCurrencyAmount(value, fieldName) {
    if (value == null || value === '') return 0;

    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`${fieldName} must be a valid non-negative number`);
    }

    return Math.round(parsed * 100) / 100;
}

function assertCasePaymentBounds(totalCost, downpayment, adjustmentTotal) {
    if (downpayment > totalCost) {
        throw new Error('Downpayment cannot exceed the total treatment cost');
    }

    if (downpayment + adjustmentTotal > totalCost) {
        throw new Error('Recorded orthodontic payments cannot exceed the total treatment cost');
    }
}

async function getCaseFinancials(client, caseId, patientId, { forUpdate = false } = {}) {
    const result = await client.query(
        `SELECT
            oc.id,
            COALESCE(oc.total_cost, 0) AS total_cost,
            COALESCE(oc.downpayment, 0) AS downpayment,
            COALESCE(oc.total_paid, 0) AS total_paid,
            COALESCE(
                (SELECT SUM(amount_paid) FROM orthodontic_adjustments WHERE case_id = oc.id),
                0
            ) AS adjustment_total
         FROM orthodontic_cases oc
         WHERE oc.id = $1 AND oc.patient_id = $2
         ${forUpdate ? 'FOR UPDATE' : ''}`,
        [caseId, patientId]
    );

    return result.rows[0] || null;
}

function getClinicTodayDateString() {
    const clinicOffset = normalizeClinicTimezoneOffset(process.env.CLINIC_TIMEZONE_OFFSET);
    const now = new Date();
    let localDate = now;

    if (clinicOffset !== 'Z') {
        const [, sign, hours, minutes] = clinicOffset.match(/^([+-])(\d{2}):(\d{2})$/) || [];
        if (sign && hours && minutes) {
            const offsetMinutes = (Number.parseInt(hours, 10) * 60) + Number.parseInt(minutes, 10);
            const direction = sign === '+' ? 1 : -1;
            const utcMillis = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
            localDate = new Date(utcMillis + (direction * offsetMinutes * 60 * 1000));
        }
    }

    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// GET /api/patients/:id/orthodontics
router.get('/', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const caseRes = await pool.query(
            `SELECT oc.*, a.full_name AS dentist_name,
                    GREATEST(oc.total_cost - oc.total_paid, 0) AS remaining
             FROM orthodontic_cases oc
             LEFT JOIN admins a ON oc.dentist_id = a.id
             WHERE oc.patient_id = $1`,
            [id]
        );
        if (caseRes.rows.length === 0) return res.json({ case: null, adjustments: [] });

        const orthoCase = caseRes.rows[0];
        const adjRes = await pool.query(
            `SELECT oa.*, a.full_name AS performed_by_name
             FROM orthodontic_adjustments oa
             LEFT JOIN admins a ON oa.performed_by = a.id
             WHERE oa.patient_id = $1
             ORDER BY oa.adjustment_date DESC`,
            [id]
        );
        res.json({ case: orthoCase, adjustments: adjRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/patients/:id/orthodontics
router.post('/', verifyToken, async (req, res) => {
    const { bracket_type, start_date, estimated_end_date, total_cost, downpayment, notes } = req.body;
    try {
        const normalizedTotalCost = normalizeCurrencyAmount(total_cost, 'Total treatment cost');
        const normalizedDownpayment = normalizeCurrencyAmount(downpayment, 'Downpayment');

        assertCasePaymentBounds(normalizedTotalCost, normalizedDownpayment, 0);

        const result = await pool.query(
            `INSERT INTO orthodontic_cases
               (patient_id, dentist_id, bracket_type, start_date, estimated_end_date,
                total_cost, downpayment, total_paid, status, notes, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$2)
             RETURNING *`,
            [
                req.params.id, req.admin.id,
                bracket_type || 'metal',
                start_date || null,
                estimated_end_date || null,
                normalizedTotalCost,
                normalizedDownpayment,
                'active',
                notes || null,
            ]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        if (err.message.includes('must be a valid non-negative number')
            || err.message === 'Downpayment cannot exceed the total treatment cost'
            || err.message === 'Recorded orthodontic payments cannot exceed the total treatment cost') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/patients/:id/orthodontics/:caseId
router.put('/:caseId', verifyToken, async (req, res) => {
    const {
        bracket_type, start_date, estimated_end_date, actual_end_date,
        total_cost, downpayment, status, notes,
    } = req.body;
    const db = await pool.connect();
    try {
        await db.query('BEGIN');

        const existingCase = await getCaseFinancials(db, req.params.caseId, req.params.id, { forUpdate: true });
        if (!existingCase) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Case not found' });
        }

        const normalizedTotalCost = normalizeCurrencyAmount(total_cost, 'Total treatment cost');
        const normalizedDownpayment = normalizeCurrencyAmount(downpayment, 'Downpayment');
        const adjustmentTotal = Number.parseFloat(existingCase.adjustment_total) || 0;

        assertCasePaymentBounds(normalizedTotalCost, normalizedDownpayment, adjustmentTotal);

        const updateRes = await db.query(
            `UPDATE orthodontic_cases SET
               bracket_type=$1, start_date=$2, estimated_end_date=$3, actual_end_date=$4,
               total_cost=$5, downpayment=$6, status=$7, notes=$8,
               updated_at=NOW()
             WHERE id=$9 AND patient_id=$10
             RETURNING id`,
            [
                bracket_type || 'metal',
                start_date || null,
                estimated_end_date || null,
                actual_end_date || null,
                normalizedTotalCost,
                normalizedDownpayment,
                status || 'active',
                notes || null,
                req.params.caseId,
                req.params.id,
            ]
        );
        if (updateRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Case not found' });
        }

        await recalcTotalPaid(db, req.params.caseId);

        const result = await db.query(
            `SELECT *, GREATEST(total_cost - total_paid, 0) AS remaining
             FROM orthodontic_cases
             WHERE id=$1 AND patient_id=$2`,
            [req.params.caseId, req.params.id]
        );

        await db.query('COMMIT');
        res.json(result.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        if (err.message.includes('must be a valid non-negative number')
            || err.message === 'Downpayment cannot exceed the total treatment cost'
            || err.message === 'Recorded orthodontic payments cannot exceed the total treatment cost') {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error' });
    } finally {
        db.release();
    }
});

// Helper: recalculate total_paid on the case as downpayment + SUM of adjustment payments
async function recalcTotalPaid(client, caseId) {
    await client.query(
        `UPDATE orthodontic_cases
         SET total_paid = downpayment + COALESCE(
               (SELECT SUM(amount_paid) FROM orthodontic_adjustments WHERE case_id = $1), 0
             ),
             updated_at = NOW()
         WHERE id = $1`,
        [caseId]
    );
}

// POST /api/patients/:id/orthodontics/:caseId/adjustments
router.post('/:caseId/adjustments', verifyToken, async (req, res) => {
    const { adjustment_date, notes, next_adjustment_date, amount_paid, payment_notes } = req.body;
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        const normalizedAmountPaid = normalizeCurrencyAmount(amount_paid, 'Amount paid');
        const existingCase = await getCaseFinancials(db, req.params.caseId, req.params.id, { forUpdate: true });
        if (!existingCase) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Case not found' });
        }

        const remainingBalance = Math.max(
            0,
            (Number.parseFloat(existingCase.total_cost) || 0) - (Number.parseFloat(existingCase.total_paid) || 0)
        );

        if (normalizedAmountPaid > remainingBalance) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Payment cannot exceed the remaining balance' });
        }

        const result = await db.query(
            `INSERT INTO orthodontic_adjustments
               (case_id, patient_id, adjustment_date, notes, next_adjustment_date,
                performed_by, amount_paid, payment_notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [
                req.params.caseId,
                req.params.id,
                adjustment_date || getClinicTodayDateString(),
                notes || null,
                next_adjustment_date || null,
                req.admin.id,
                normalizedAmountPaid,
                payment_notes || null,
            ]
        );
        await recalcTotalPaid(db, req.params.caseId);
        await db.query('COMMIT');
        const full = await pool.query(
            `SELECT oa.*, a.full_name AS performed_by_name
             FROM orthodontic_adjustments oa
             LEFT JOIN admins a ON oa.performed_by = a.id
             WHERE oa.id = $1`,
            [result.rows[0].id]
        );
        res.status(201).json(full.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        if (err.message.includes('must be a valid non-negative number')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error' });
    } finally {
        db.release();
    }
});

// PUT /api/patients/:id/orthodontics/:caseId/adjustments/:adjId
router.put('/:caseId/adjustments/:adjId', verifyToken, async (req, res) => {
    const { adjustment_date, notes, next_adjustment_date, amount_paid, payment_notes } = req.body;
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        const normalizedAmountPaid = normalizeCurrencyAmount(amount_paid, 'Amount paid');
        const existingCase = await getCaseFinancials(db, req.params.caseId, req.params.id, { forUpdate: true });
        if (!existingCase) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Case not found' });
        }

        const existingAdjustmentRes = await db.query(
            `SELECT amount_paid
             FROM orthodontic_adjustments
             WHERE id = $1 AND case_id = $2 AND patient_id = $3`,
            [req.params.adjId, req.params.caseId, req.params.id]
        );
        if (existingAdjustmentRes.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Adjustment not found' });
        }

        const previousAmountPaid = Number.parseFloat(existingAdjustmentRes.rows[0].amount_paid) || 0;
        const projectedTotalPaid =
            (Number.parseFloat(existingCase.total_paid) || 0)
            - previousAmountPaid
            + normalizedAmountPaid;

        if (projectedTotalPaid > (Number.parseFloat(existingCase.total_cost) || 0)) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Payment cannot exceed the remaining balance' });
        }

        const result = await db.query(
            `UPDATE orthodontic_adjustments SET
               adjustment_date=$1, notes=$2, next_adjustment_date=$3,
               amount_paid=$4, payment_notes=$5
             WHERE id=$6 AND case_id=$7 AND patient_id=$8
             RETURNING *`,
            [
                adjustment_date,
                notes || null,
                next_adjustment_date || null,
                normalizedAmountPaid,
                payment_notes || null,
                req.params.adjId,
                req.params.caseId,
                req.params.id,
            ]
        );
        if (result.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Adjustment not found' });
        }
        await recalcTotalPaid(db, req.params.caseId);
        await db.query('COMMIT');
        const full = await pool.query(
            `SELECT oa.*, a.full_name AS performed_by_name
             FROM orthodontic_adjustments oa
             LEFT JOIN admins a ON oa.performed_by = a.id
             WHERE oa.id = $1`,
            [result.rows[0].id]
        );
        res.json(full.rows[0]);
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        if (err.message.includes('must be a valid non-negative number')) {
            return res.status(400).json({ error: err.message });
        }
        res.status(500).json({ error: 'Server error' });
    } finally {
        db.release();
    }
});

// DELETE /api/patients/:id/orthodontics/:caseId/adjustments/:adjId
router.delete('/:caseId/adjustments/:adjId', verifyToken, async (req, res) => {
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        const result = await db.query(
            'DELETE FROM orthodontic_adjustments WHERE id=$1 AND case_id=$2 AND patient_id=$3 RETURNING id',
            [req.params.adjId, req.params.caseId, req.params.id]
        );
        if (result.rows.length === 0) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Adjustment not found' });
        }
        await recalcTotalPaid(db, req.params.caseId);
        await db.query('COMMIT');
        res.json({ message: 'Adjustment deleted' });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        db.release();
    }
});

module.exports = router;
