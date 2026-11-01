// Shared helpers for visit payment ledgers, orthodontic entries and visit history.

// Seeds one ledger row for visits paid before visit_payments existed.
// Idempotent: visits that already have ledger rows are skipped.
// Keep in sync with the backfill in db/schema.sql.
const BACKFILL_VISIT_PAYMENTS_SQL = `
INSERT INTO visit_payments (visit_id, patient_id, amount, payment_date, notes, recorded_by, created_at)
SELECT v.id, v.patient_id,
       CASE WHEN v.payment_status = 'partial' THEN v.partial_amount_paid ELSE v.cost END,
       v.visit_date::date,
       'Recorded before payment history',
       v.dentist_id,
       v.created_at
FROM visits v
WHERE v.patient_id IS NOT NULL
  AND (
    (v.payment_status = 'partial' AND COALESCE(v.partial_amount_paid, 0) > 0)
    OR (v.payment_status = 'paid' AND COALESCE(v.cost, 0) > 0)
  )
  AND NOT EXISTS (SELECT 1 FROM visit_payments vp WHERE vp.visit_id = v.id)
`;

// Tags legacy "Record Payment" rows (from before entry_type existed) as payments.
const BACKFILL_ORTHO_ENTRY_TYPE_SQL = `
UPDATE orthodontic_adjustments
SET entry_type = 'payment'
WHERE notes = 'Payment entry' AND entry_type = 'adjustment'
`;

function toAmount(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

// Derives the visit's payment status from its ledger total.
// Insurance stays insurance; a zero-cost visit keeps "paid" if it was marked paid.
function derivePaymentSummary(cost, paidTotal, statusHint) {
    if (statusHint === 'insurance') {
        return { paymentStatus: 'insurance', partialAmountPaid: null };
    }

    const totalCost = toAmount(cost);
    const paid = toAmount(paidTotal);

    if (paid <= 0) {
        return {
            paymentStatus: totalCost <= 0 && statusHint === 'paid' ? 'paid' : 'pending',
            partialAmountPaid: null,
        };
    }
    if (totalCost <= 0 || paid >= totalCost) {
        return { paymentStatus: 'paid', partialAmountPaid: null };
    }
    return { paymentStatus: 'partial', partialAmountPaid: Math.round(paid * 100) / 100 };
}

async function getVisitPaidTotal(db, visitId) {
    const result = await db.query(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM visit_payments WHERE visit_id = $1',
        [visitId]
    );
    return toAmount(result.rows[0]?.total);
}

// Recomputes visits.payment_status / partial_amount_paid from the ledger.
async function syncVisitPaymentSummary(db, visitId, statusHint) {
    const visitRes = await db.query('SELECT cost, payment_status FROM visits WHERE id = $1', [visitId]);
    const visit = visitRes.rows[0];
    if (!visit) return null;

    const paidTotal = await getVisitPaidTotal(db, visitId);
    const summary = derivePaymentSummary(visit.cost, paidTotal, statusHint || visit.payment_status);
    await db.query(
        'UPDATE visits SET payment_status = $1, partial_amount_paid = $2 WHERE id = $3',
        [summary.paymentStatus, summary.partialAmountPaid, visitId]
    );
    return summary;
}

// Ledger rows for the given visits, oldest first, each with the balance left after it.
async function fetchVisitPayments(db, visitIds) {
    if (visitIds.length === 0) return [];
    const result = await db.query(
        `SELECT vp.*, a.full_name AS recorded_by_name,
                SUM(vp.amount) OVER w AS paid_to_date,
                CASE
                    WHEN v.cost IS NULL THEN NULL
                    ELSE GREATEST(v.cost - SUM(vp.amount) OVER w, 0)
                END AS balance_after
         FROM visit_payments vp
         JOIN visits v ON v.id = vp.visit_id
         LEFT JOIN admins a ON a.id = vp.recorded_by
         WHERE vp.visit_id = ANY($1::uuid[])
         WINDOW w AS (
             PARTITION BY vp.visit_id
             ORDER BY vp.payment_date, vp.created_at, vp.id
             ROWS UNBOUNDED PRECEDING
         )
         ORDER BY vp.visit_id, vp.payment_date, vp.created_at, vp.id`,
        [visitIds]
    );
    return result.rows;
}

async function attachVisitPayments(db, visits) {
    const payments = await fetchVisitPayments(db, visits.map(visit => visit.id));
    const byVisit = new Map();
    for (const payment of payments) {
        if (!byVisit.has(payment.visit_id)) byVisit.set(payment.visit_id, []);
        byVisit.get(payment.visit_id).push(payment);
    }
    return visits.map(visit => ({ ...visit, payments: byVisit.get(visit.id) || [] }));
}

// Orthodontic entries (adjustments and payment-only rows), newest first, each with
// the case balance left after it (downpayment + all earlier entries).
async function fetchOrthoEntries(db, patientId) {
    const result = await db.query(
        `SELECT * FROM (
             SELECT oa.*, a.full_name AS performed_by_name,
                    GREATEST(
                        COALESCE(oc.total_cost, 0) - COALESCE(oc.downpayment, 0)
                        - SUM(COALESCE(oa.amount_paid, 0)) OVER (
                            PARTITION BY oa.case_id
                            ORDER BY oa.adjustment_date, oa.created_at, oa.id
                            ROWS UNBOUNDED PRECEDING
                        ),
                        0
                    ) AS balance_after
             FROM orthodontic_adjustments oa
             JOIN orthodontic_cases oc ON oc.id = oa.case_id
             LEFT JOIN admins a ON oa.performed_by = a.id
             WHERE oa.patient_id = $1
         ) entries
         ORDER BY adjustment_date DESC, created_at DESC, id DESC`,
        [patientId]
    );
    return result.rows;
}

// Most recent visit date across regular visits and orthodontic adjustment visits.
function lastVisitSql(patientAlias = 'p') {
    return `GREATEST(
        (SELECT MAX(v_last.visit_date) FROM visits v_last WHERE v_last.patient_id = ${patientAlias}.id),
        (SELECT MAX(oa_last.adjustment_date)::timestamptz FROM orthodontic_adjustments oa_last
          WHERE oa_last.patient_id = ${patientAlias}.id AND oa_last.entry_type = 'adjustment')
    )`;
}

// Visit count across regular visits and orthodontic adjustment visits.
function visitCountSql(patientAlias = 'p') {
    return `(
        (SELECT COUNT(*) FROM visits v_count WHERE v_count.patient_id = ${patientAlias}.id)
        + (SELECT COUNT(*) FROM orthodontic_adjustments oa_count
            WHERE oa_count.patient_id = ${patientAlias}.id AND oa_count.entry_type = 'adjustment')
    )`;
}

module.exports = {
    BACKFILL_VISIT_PAYMENTS_SQL,
    BACKFILL_ORTHO_ENTRY_TYPE_SQL,
    derivePaymentSummary,
    getVisitPaidTotal,
    syncVisitPaymentSummary,
    fetchVisitPayments,
    attachVisitPayments,
    fetchOrthoEntries,
    lastVisitSql,
    visitCountSql,
};
