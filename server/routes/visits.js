const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const {
    attachVisitPayments,
    fetchOrthoEntries,
    getVisitPaidTotal,
    syncVisitPaymentSummary,
} = require('../utils/visitLedger');

class VisitInputError extends Error {}

function normalizeOptionalText(value) {
    if (typeof value !== 'string') return value ?? null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
}

function normalizeCurrencyAmount(value) {
    if (value == null || value === '') return null;

    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new VisitInputError('Amount must be a valid non-negative number');
    }

    return Math.round(parsed * 100) / 100;
}

function normalizeVisitPayment(cost, paymentStatus, partialAmountPaid) {
    const normalizedCost = normalizeCurrencyAmount(cost);
    const normalizedStatus = normalizeOptionalText(paymentStatus) || 'pending';
    let normalizedPartialAmount = normalizeCurrencyAmount(partialAmountPaid);

    if (normalizedStatus === 'partial') {
        if (normalizedCost == null) {
            throw new VisitInputError('Total cost is required for partial payments');
        }
        if (normalizedPartialAmount == null || normalizedPartialAmount <= 0) {
            throw new VisitInputError('Partial amount paid is required for partial payments');
        }
        if (normalizedPartialAmount > normalizedCost) {
            throw new VisitInputError('Partial amount paid cannot exceed the total cost');
        }
    } else {
        normalizedPartialAmount = null;
    }

    return {
        normalizedCost,
        normalizedStatus,
        normalizedPartialAmount,
    };
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
        throw new VisitInputError('Teeth treated must include at least one valid tooth number');
    }

    return [...new Set(normalized)];
}

function normalizePaymentInput({ amount, payment_date, notes }) {
    const normalizedAmount = normalizeCurrencyAmount(amount);
    if (normalizedAmount == null || normalizedAmount <= 0) {
        throw new VisitInputError('Enter a payment amount greater than zero');
    }
    const normalizedDate = normalizeOptionalText(payment_date);
    if (normalizedDate && !/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
        throw new VisitInputError('Payment date must be a valid date');
    }
    return {
        amount: normalizedAmount,
        paymentDate: normalizedDate,
        notes: normalizeOptionalText(notes),
    };
}

// Rows the payment routes may touch: scoped to the patient when mounted under /patients/:id.
async function lockVisit(db, req) {
    const values = [req.params.visitId];
    let sql = 'SELECT id, patient_id, cost, payment_status FROM visits WHERE id = $1';
    if (req.params.id) {
        values.push(req.params.id);
        sql += ' AND patient_id = $2';
    }
    const result = await db.query(`${sql} FOR UPDATE`, values);
    return result.rows[0] || null;
}

async function fetchFullVisit(db, visitId) {
    const result = await db.query(`
      SELECT v.*, a.full_name AS dentist_name
      FROM visits v LEFT JOIN admins a ON v.dentist_id = a.id
      WHERE v.id = $1
    `, [visitId]);
    if (result.rows.length === 0) return null;
    const [visit] = await attachVisitPayments(db, result.rows);
    return visit;
}

function assertPaymentFits(visit, projectedTotal) {
    if (visit.payment_status === 'insurance') {
        throw new VisitInputError('This visit is covered by insurance / HMO');
    }
    const cost = Number.parseFloat(visit.cost);
    if (!Number.isFinite(cost) || cost <= 0) {
        throw new VisitInputError('Set the visit total cost before recording payments');
    }
    if (projectedTotal > cost + 0.001) {
        throw new VisitInputError('Payment cannot exceed the remaining balance');
    }
}

function handleError(res, err, fallback = 'Server error') {
    if (err instanceof VisitInputError) {
        return res.status(400).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: fallback });
}

async function inTransaction(work) {
    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        const result = await work(db);
        await db.query('COMMIT');
        return result;
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    } finally {
        db.release();
    }
}

// GET /api/patients/:id/visits
// Returns all visits (or a page when ?limit is given), each with its payment ledger,
// plus orthodontic entries (adjustment visits and payments) and the case summary.
router.get('/', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const paginate = req.query.limit != null;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);

        const countRes = await pool.query(
            'SELECT COUNT(*) FROM visits WHERE patient_id = $1', [id]
        );
        const visitValues = [id];
        let pageSql = '';
        if (paginate) {
            visitValues.push(limit, (page - 1) * limit);
            pageSql = 'LIMIT $2 OFFSET $3';
        }
        const visitsRes = await pool.query(`
      SELECT v.*, a.full_name AS dentist_name
      FROM visits v
      LEFT JOIN admins a ON v.dentist_id = a.id
      WHERE v.patient_id = $1
      ORDER BY v.visit_date DESC, v.created_at DESC
      ${pageSql}
    `, visitValues);

        const [visits, orthoEntries, orthoCaseRes] = await Promise.all([
            attachVisitPayments(pool, visitsRes.rows),
            fetchOrthoEntries(pool, id),
            pool.query(
                `SELECT id, bracket_type, start_date, status, total_cost, downpayment, total_paid,
                        GREATEST(total_cost - total_paid, 0) AS remaining
                 FROM orthodontic_cases WHERE patient_id = $1`,
                [id]
            ),
        ]);

        const total = parseInt(countRes.rows[0].count, 10);
        res.json({
            visits,
            ortho_entries: orthoEntries,
            ortho_case: orthoCaseRes.rows[0] || null,
            total,
            page,
            limit: paginate ? limit : total,
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
        teeth_treated, prescriptions, next_appointment, cost, payment_status, partial_amount_paid, notes,
    } = req.body;

    const normalizedTreatment = normalizeOptionalText(treatment_performed);
    const normalizedVisitType = normalizeOptionalText(visit_type);

    if (!normalizedTreatment) return res.status(400).json({ error: 'Treatment performed is required' });
    if (!normalizedVisitType) return res.status(400).json({ error: 'Visit type is required' });

    try {
        const normalizedTeeth = normalizeTeethTreated(teeth_treated);
        const {
            normalizedCost,
            normalizedStatus,
            normalizedPartialAmount,
        } = normalizeVisitPayment(cost, payment_status, partial_amount_paid);

        const visit = await inTransaction(async (db) => {
            const result = await db.query(`
          INSERT INTO visits (
            patient_id, dentist_id, visit_date, visit_type, chief_complaint,
            diagnosis, treatment_performed, teeth_treated, prescriptions,
            next_appointment, cost, payment_status, partial_amount_paid, notes
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          RETURNING id
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
                normalizedCost,
                normalizedStatus,
                normalizedPartialAmount,
                normalizeOptionalText(notes),
            ]);
            const visitId = result.rows[0].id;

            // The payment made at the visit becomes the first ledger entry.
            const initialPayment = normalizedStatus === 'partial'
                ? normalizedPartialAmount
                : normalizedStatus === 'paid' ? normalizedCost : null;
            if (initialPayment > 0) {
                await db.query(
                    `INSERT INTO visit_payments (visit_id, patient_id, amount, payment_date, recorded_by)
                     SELECT id, patient_id, $2, visit_date::date, $3 FROM visits WHERE id = $1`,
                    [visitId, initialPayment, req.admin.id]
                );
            }
            await syncVisitPaymentSummary(db, visitId, normalizedStatus);
            return fetchFullVisit(db, visitId);
        });

        res.status(201).json(visit);
    } catch (err) {
        handleError(res, err);
    }
});

// PUT /api/visits/:id
// Payment status follows the payment ledger; only "insurance" can be set directly here.
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
        const normalizedCost = normalizeCurrencyAmount(cost);
        const statusHint = normalizeOptionalText(payment_status);

        const visit = await inTransaction(async (db) => {
            const existing = await lockVisit(db, req);
            if (!existing) return null;

            const paidTotal = await getVisitPaidTotal(db, existing.id);
            if (paidTotal > 0 && statusHint !== 'insurance' && (normalizedCost ?? 0) + 0.001 < paidTotal) {
                throw new VisitInputError('Total cost cannot be less than the amount already paid');
            }

            await db.query(`
          UPDATE visits SET
            visit_date=$1, visit_type=$2, chief_complaint=$3, diagnosis=$4,
            treatment_performed=$5, teeth_treated=$6, prescriptions=$7,
            next_appointment=$8, cost=$9, notes=$10
          WHERE id=$11
        `, [
                visit_date || new Date().toISOString(),
                normalizedVisitType,
                normalizeOptionalText(chief_complaint),
                normalizeOptionalText(diagnosis),
                normalizedTreatment,
                normalizedTeeth,
                normalizeOptionalText(prescriptions),
                next_appointment || null,
                normalizedCost,
                normalizeOptionalText(notes),
                existing.id,
            ]);
            await syncVisitPaymentSummary(db, existing.id, statusHint || existing.payment_status);
            return fetchFullVisit(db, existing.id);
        });

        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        res.json(visit);
    } catch (err) {
        handleError(res, err);
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

// POST /api/patients/:id/visits/:visitId/payments
router.post('/:visitId/payments', verifyToken, async (req, res) => {
    try {
        const input = normalizePaymentInput(req.body);
        const visit = await inTransaction(async (db) => {
            const existing = await lockVisit(db, req);
            if (!existing) return null;

            const paidTotal = await getVisitPaidTotal(db, existing.id);
            assertPaymentFits(existing, paidTotal + input.amount);

            await db.query(
                `INSERT INTO visit_payments (visit_id, patient_id, amount, payment_date, notes, recorded_by)
                 VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6)`,
                [existing.id, existing.patient_id, input.amount, input.paymentDate, input.notes, req.admin.id]
            );
            await syncVisitPaymentSummary(db, existing.id);
            return fetchFullVisit(db, existing.id);
        });

        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        res.status(201).json(visit);
    } catch (err) {
        handleError(res, err, 'Failed to record payment');
    }
});

// POST /api/patients/:id/visits/:visitId/payments/settle — pays the remaining balance
router.post('/:visitId/payments/settle', verifyToken, async (req, res) => {
    try {
        const paymentDate = normalizeOptionalText(req.body?.payment_date);
        const visit = await inTransaction(async (db) => {
            const existing = await lockVisit(db, req);
            if (!existing) return null;

            const cost = Number.parseFloat(existing.cost);
            if (!Number.isFinite(cost) || cost <= 0) {
                // Nothing to collect: just mark the visit paid.
                await syncVisitPaymentSummary(db, existing.id, 'paid');
                return fetchFullVisit(db, existing.id);
            }

            const paidTotal = await getVisitPaidTotal(db, existing.id);
            const remaining = Math.round((cost - paidTotal) * 100) / 100;
            if (remaining > 0) {
                assertPaymentFits(existing, paidTotal + remaining);
                await db.query(
                    `INSERT INTO visit_payments (visit_id, patient_id, amount, payment_date, notes, recorded_by)
                     VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6)`,
                    [existing.id, existing.patient_id, remaining, paymentDate, 'Balance settled', req.admin.id]
                );
            }
            await syncVisitPaymentSummary(db, existing.id);
            return fetchFullVisit(db, existing.id);
        });

        if (!visit) return res.status(404).json({ error: 'Visit not found' });
        res.json(visit);
    } catch (err) {
        handleError(res, err, 'Failed to update payment status');
    }
});

// PUT /api/patients/:id/visits/:visitId/payments/:paymentId
router.put('/:visitId/payments/:paymentId', verifyToken, async (req, res) => {
    try {
        const input = normalizePaymentInput(req.body);
        const visit = await inTransaction(async (db) => {
            const existing = await lockVisit(db, req);
            if (!existing) return null;

            const paymentRes = await db.query(
                'SELECT amount FROM visit_payments WHERE id = $1 AND visit_id = $2',
                [req.params.paymentId, existing.id]
            );
            if (paymentRes.rows.length === 0) return null;

            const paidTotal = await getVisitPaidTotal(db, existing.id);
            const previousAmount = Number.parseFloat(paymentRes.rows[0].amount) || 0;
            assertPaymentFits(existing, paidTotal - previousAmount + input.amount);

            await db.query(
                `UPDATE visit_payments
                 SET amount = $1, payment_date = COALESCE($2::date, payment_date), notes = $3
                 WHERE id = $4`,
                [input.amount, input.paymentDate, input.notes, req.params.paymentId]
            );
            await syncVisitPaymentSummary(db, existing.id);
            return fetchFullVisit(db, existing.id);
        });

        if (!visit) return res.status(404).json({ error: 'Payment not found' });
        res.json(visit);
    } catch (err) {
        handleError(res, err, 'Failed to update payment');
    }
});

// DELETE /api/patients/:id/visits/:visitId/payments/:paymentId
router.delete('/:visitId/payments/:paymentId', verifyToken, async (req, res) => {
    try {
        const visit = await inTransaction(async (db) => {
            const existing = await lockVisit(db, req);
            if (!existing) return null;

            const result = await db.query(
                'DELETE FROM visit_payments WHERE id = $1 AND visit_id = $2 RETURNING id',
                [req.params.paymentId, existing.id]
            );
            if (result.rows.length === 0) return null;

            await syncVisitPaymentSummary(db, existing.id);
            return fetchFullVisit(db, existing.id);
        });

        if (!visit) return res.status(404).json({ error: 'Payment not found' });
        res.json(visit);
    } catch (err) {
        handleError(res, err, 'Failed to delete payment');
    }
});

module.exports = router;
