const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');
const { getDentalIssueSql } = require('../utils/dentalChart');

const visitCollectedAmountSql = (alias = 'v') => `
    CASE
        WHEN ${alias}.payment_status = 'partial' THEN COALESCE(${alias}.partial_amount_paid, COALESCE(${alias}.cost, 0) * 0.5)
        WHEN ${alias}.payment_status IN ('paid', 'insurance') THEN COALESCE(${alias}.cost, 0)
        ELSE 0
    END
`;

const visitOutstandingAmountSql = (alias = 'v') => `
    CASE
        WHEN ${alias}.payment_status = 'partial' THEN GREATEST(
            COALESCE(${alias}.cost, 0) - COALESCE(${alias}.partial_amount_paid, COALESCE(${alias}.cost, 0) * 0.5),
            0
        )
        WHEN ${alias}.payment_status = 'pending' THEN COALESCE(${alias}.cost, 0)
        ELSE 0
    END
`;

const orthoOutstandingAmountSql = (alias = 'oc') => `
    GREATEST(COALESCE(${alias}.total_cost, 0) - COALESCE(${alias}.total_paid, 0), 0)
`;

const revenueDateSql = {
    activity: {
        visit: (alias = 'v') => `${alias}.visit_date`,
        orthoCase: (alias = 'oc') => `${alias}.start_date::timestamptz`,
        orthoAdjustment: (alias = 'oa') => `${alias}.adjustment_date::timestamptz`,
    },
    recorded: {
        visit: (alias = 'v') => `${alias}.created_at`,
        orthoCase: (alias = 'oc') => `${alias}.created_at`,
        orthoAdjustment: (alias = 'oa') => `${alias}.created_at`,
    },
};

const DATE_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;
const allowedRevenueSources = ['all', 'visits', 'orthodontics'];
const allowedRevenueMetrics = ['collected', 'outstanding'];

function mapRevenueDrilldownRow(row) {
    return {
        entryId: row.entry_id,
        patientId: row.patient_id,
        patientName: [row.last_name, row.first_name].filter(Boolean).join(', '),
        profilePhoto: row.profile_photo,
        sourceType: row.source_type,
        label: row.label,
        amount: parseFloat(row.amount || 0),
        activityAt: row.activity_at,
        recordedAt: row.recorded_at,
        referenceAt: row.reference_at,
        details: row.details || '',
    };
}

function summarizeRevenueDrilldown(rows) {
    const labelByType = {
        visit: 'Visits',
        ortho_downpayment: 'Orthodontic downpayments',
        ortho_adjustment: 'Orthodontic adjustments',
        ortho_balance: 'Orthodontic balances',
    };

    return Object.entries(
        rows.reduce((acc, row) => {
            const current = acc[row.sourceType] || { total: 0, count: 0 };
            current.total += row.amount;
            current.count += 1;
            acc[row.sourceType] = current;
            return acc;
        }, {})
    ).map(([sourceType, summary]) => ({
        sourceType,
        label: labelByType[sourceType] || sourceType,
        total: summary.total,
        count: summary.count,
    })).sort((a, b) => b.total - a.total);
}

// GET /api/dashboard/stats
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const allowedRevenuePeriods = ['day', 'biweek', 'month', 'custom'];
        const revenuePeriod = allowedRevenuePeriods.includes(req.query.revenuePeriod)
            ? req.query.revenuePeriod
            : 'month';

        // Custom date range validation
        let customStart = null;
        let customEnd = null;
        if (revenuePeriod === 'custom') {
            const from = req.query.dateFrom;
            const to   = req.query.dateTo;
            // Basic ISO date validation (YYYY-MM-DD)
            const dateRe = /^\d{4}-\d{2}-\d{2}$/;
            if (from && dateRe.test(from) && to && dateRe.test(to)) {
                customStart = from;
                // dateTo is inclusive — add 1 day for the < bound
                const endDate = new Date(to);
                endDate.setDate(endDate.getDate() + 1);
                customEnd = endDate.toISOString().slice(0, 10);
            }
        }

        const [
            totalPatientsRes,
            visitsTodayRes,
            upcomingRes,
            monthlyRevenueRes,
            recentPatientsRes,
            outstandingRes,
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM patients WHERE is_active = true"),
            pool.query("SELECT COUNT(*) FROM appointments WHERE appointment_date >= CURRENT_DATE AND appointment_date < CURRENT_DATE + INTERVAL '1 day' AND status NOT IN ('cancelled', 'completed')"),
            pool.query("SELECT COUNT(*) FROM appointments WHERE appointment_date >= CURRENT_DATE + INTERVAL '1 day' AND appointment_date < NOW() + INTERVAL '30 days' AND status NOT IN ('cancelled', 'completed')"),
            pool.query(`
        WITH bounds AS (
          SELECT
            CASE $1
              WHEN 'day'    THEN CURRENT_DATE::timestamptz
              WHEN 'biweek' THEN (CURRENT_DATE - INTERVAL '13 days')::timestamptz
              WHEN 'custom' THEN COALESCE($2::timestamptz, date_trunc('month', CURRENT_DATE)::timestamptz)
              ELSE date_trunc('month', CURRENT_DATE)::timestamptz
            END AS period_start,
            CASE $1
              WHEN 'day'    THEN (CURRENT_DATE + INTERVAL '1 day')::timestamptz
              WHEN 'biweek' THEN (CURRENT_DATE + INTERVAL '1 day')::timestamptz
              WHEN 'custom' THEN COALESCE($3::timestamptz, (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::timestamptz)
              ELSE (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::timestamptz
            END AS period_end
        ),
        visit_revenue AS (
          SELECT COALESCE(SUM(${visitCollectedAmountSql('v')}), 0) AS total
          FROM visits v
          JOIN patients p ON p.id = v.patient_id AND p.is_active = true
          , bounds
          WHERE v.visit_date >= bounds.period_start
            AND v.visit_date < bounds.period_end
        ),
        ortho_downpayments AS (
          SELECT COALESCE(SUM(oc.downpayment), 0) AS total
          FROM orthodontic_cases oc
          JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
          , bounds
          WHERE oc.start_date >= bounds.period_start::date
            AND oc.start_date < bounds.period_end::date
        ),
        ortho_adjustments AS (
          SELECT COALESCE(SUM(oa.amount_paid), 0) AS total
          FROM orthodontic_adjustments oa
          JOIN patients p ON p.id = oa.patient_id AND p.is_active = true
          , bounds
          WHERE oa.adjustment_date >= bounds.period_start::date
            AND oa.adjustment_date < bounds.period_end::date
        )
        SELECT
          visit_revenue.total
          + ortho_downpayments.total
          + ortho_adjustments.total AS total
        FROM visit_revenue, ortho_downpayments, ortho_adjustments
      `, [revenuePeriod, customStart, customEnd]),
            pool.query(`
        SELECT p.id, p.last_name, p.first_name, p.date_of_birth, p.sex, p.profile_photo,
          (SELECT MAX(v.visit_date) FROM visits v WHERE v.patient_id = p.id) AS last_visit,
          (SELECT COUNT(*) FROM dental_chart dc WHERE dc.patient_id = p.id AND ${getDentalIssueSql('dc')}) AS dental_issues
        FROM patients p WHERE p.is_active = true
        ORDER BY p.created_at DESC LIMIT 5
      `),
            pool.query(`
        WITH outstanding AS (
          SELECT
            p.id, p.last_name, p.first_name, p.profile_photo,
            COUNT(v.id) AS visit_count,
            COALESCE(SUM(${visitOutstandingAmountSql('v')}), 0) AS amount,
            MAX(v.visit_date::date) AS last_activity
          FROM visits v
          JOIN patients p ON p.id = v.patient_id AND p.is_active = true
          WHERE v.payment_status IN ('pending', 'partial')
          GROUP BY p.id, p.last_name, p.first_name, p.profile_photo

          UNION ALL

          SELECT
            p.id, p.last_name, p.first_name, p.profile_photo,
            0 AS visit_count,
            ${orthoOutstandingAmountSql('oc')} AS amount,
            oc.updated_at::date AS last_activity
          FROM orthodontic_cases oc
          JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
          WHERE oc.status = 'active' AND ${orthoOutstandingAmountSql('oc')} > 0
        )
        SELECT
          id, last_name, first_name, profile_photo,
          SUM(visit_count) AS pending_visits,
          SUM(amount) AS outstanding_amount,
          MAX(last_activity) AS last_visit
        FROM outstanding
        GROUP BY id, last_name, first_name, profile_photo
        ORDER BY outstanding_amount DESC
        LIMIT 8
      `),
        ]);

        res.json({
            totalPatients: parseInt(totalPatientsRes.rows[0].count),
            appointmentsToday: parseInt(visitsTodayRes.rows[0].count),
            upcomingAppointments: parseInt(upcomingRes.rows[0].count),
            monthlyRevenue: parseFloat(monthlyRevenueRes.rows[0].total),
            revenuePeriod,
            recentPatients: recentPatientsRes.rows,
            outstandingPatients: outstandingRes.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/dashboard/revenue ──────────────────────────────────────────────
// Returns all data needed by the Revenue Overview Section.
router.get('/revenue', verifyToken, async (req, res) => {
    try {
        // Validate period param: 3m | 6m | 1y | custom
        const allowedTrend = ['3m', '6m', '1y', 'custom'];
        const trend = allowedTrend.includes(req.query.trend) ? req.query.trend : '6m';
        const trendMonths = trend === '3m' ? 3 : trend === '1y' ? 12 : 6;
        const allowedDateBases = ['activity', 'recorded'];
        const dateBasis = allowedDateBases.includes(req.query.dateBasis) ? req.query.dateBasis : 'activity';
        const dateSql = revenueDateSql[dateBasis];

        // Custom date range validation (YYYY-MM-DD)
        let customFrom = null;
        let customTo   = null;
        if (trend === 'custom') {
            const dateRe = /^\d{4}-\d{2}-\d{2}$/;
            const rawFrom = req.query.dateFrom;
            const rawTo   = req.query.dateTo;
            if (rawFrom && dateRe.test(rawFrom) && rawTo && dateRe.test(rawTo)) {
                customFrom = rawFrom;
                // Make dateTo inclusive by advancing 1 day for the < bound
                const endDate = new Date(rawTo);
                endDate.setDate(endDate.getDate() + 1);
                customTo = endDate.toISOString().slice(0, 10);
            } else {
                // Custom mode but dates missing/invalid — return empty trend
                return res.json({
                    thisMonth: 0, lastMonth: 0, lastMonthName: '',
                    outstanding: 0, outstandingPatientCount: 0, collectionRate: 0,
                    dateBasis,
                    trend: [], services: {}, topOutstanding: [],
                });
            }
        }

        const visitDateExpr = dateSql.visit('v');
        const orthoCaseDateExpr = dateSql.orthoCase('oc');
        const orthoAdjustmentDateExpr = dateSql.orthoAdjustment('oa');

        // ── Revenue helpers using visits + ortho tables ────────────────
        // Collected revenue = paid visits + ortho downpayments + ortho adjustments
        // dateBasis controls whether filters use the activity date or the record entry date.

        const [
            thisMonthVisitRes,
            lastMonthVisitRes,
            thisMonthOrthoRes,
            lastMonthOrthoRes,
            outstandingVisitRes,
            outstandingOrthoRes,
            outstandingPatientCountRes,
            trendRes,
            serviceRes,
            orthoServiceRes,
            topOutstandingRes,
            lifetimeVisitBilledRes,
            lifetimeVisitCollectedRes,
            lifetimeOrthoFinancialsRes,
        ] = await Promise.all([

            // ── This month collected (visits) ──────────────────────────
            pool.query(`
                SELECT COALESCE(SUM(${visitCollectedAmountSql('v')}), 0) AS total
                FROM visits v
                JOIN patients p ON p.id = v.patient_id AND p.is_active = true
                WHERE date_trunc('month', ${visitDateExpr}) = date_trunc('month', CURRENT_DATE)
            `),

            // ── Last month collected (visits) ──────────────────────────
            pool.query(`
                SELECT COALESCE(SUM(${visitCollectedAmountSql('v')}), 0) AS total
                FROM visits v
                JOIN patients p ON p.id = v.patient_id AND p.is_active = true
                WHERE date_trunc('month', ${visitDateExpr}) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
            `),

            // ── This month ortho (downpayments + adjustments) ──────────
            pool.query(`
                SELECT
                    (
                        SELECT COALESCE(SUM(oc.downpayment), 0)
                        FROM orthodontic_cases oc
                        JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                        WHERE date_trunc('month', ${orthoCaseDateExpr}) = date_trunc('month', CURRENT_DATE)
                    ) +
                    (
                        SELECT COALESCE(SUM(oa.amount_paid), 0)
                        FROM orthodontic_adjustments oa
                        JOIN patients p ON p.id = oa.patient_id AND p.is_active = true
                        WHERE date_trunc('month', ${orthoAdjustmentDateExpr}) = date_trunc('month', CURRENT_DATE)
                    ) AS total
            `),

            // ── Last month ortho ───────────────────────────────────────
            pool.query(`
                SELECT
                    (
                        SELECT COALESCE(SUM(oc.downpayment), 0)
                        FROM orthodontic_cases oc
                        JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                        WHERE date_trunc('month', ${orthoCaseDateExpr}) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                    ) +
                    (
                        SELECT COALESCE(SUM(oa.amount_paid), 0)
                        FROM orthodontic_adjustments oa
                        JOIN patients p ON p.id = oa.patient_id AND p.is_active = true
                        WHERE date_trunc('month', ${orthoAdjustmentDateExpr}) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
                    ) AS total
            `),

            // ── Outstanding visits ─────────────────────────────────────
            pool.query(`
                SELECT COALESCE(SUM(${visitOutstandingAmountSql('v')}), 0) AS total
                FROM visits v
                JOIN patients p ON p.id = v.patient_id AND p.is_active = true
                WHERE v.payment_status IN ('pending', 'partial')
            `),

            // ── Outstanding ortho balances ─────────────────────────────
            pool.query(`
                SELECT COALESCE(SUM(${orthoOutstandingAmountSql('oc')}), 0) AS total
                FROM orthodontic_cases oc
                JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                WHERE oc.status = 'active' AND ${orthoOutstandingAmountSql('oc')} > 0
            `),

            pool.query(`
                WITH outstanding_patients AS (
                    SELECT DISTINCT v.patient_id
                    FROM visits v
                    JOIN patients p ON p.id = v.patient_id AND p.is_active = true
                    WHERE v.payment_status IN ('pending', 'partial')
                      AND ${visitOutstandingAmountSql('v')} > 0

                    UNION

                    SELECT DISTINCT oc.patient_id
                    FROM orthodontic_cases oc
                    JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                    WHERE oc.status = 'active'
                      AND ${orthoOutstandingAmountSql('oc')} > 0
                )
                SELECT COUNT(*) AS total
                FROM outstanding_patients
            `),

            // ── Revenue trend (per month) ──────────────────────────────
            trend === 'custom'
                ? pool.query(`
                    WITH days AS (
                        SELECT generate_series(
                            $1::date,
                            ($2::date - INTERVAL '1 day')::date,
                            '1 day'
                        ) AS day_start
                    ),
                    visit_data AS (
                        SELECT
                            date_trunc('day', ${visitDateExpr}) AS day_start,
                            SUM(${visitCollectedAmountSql('v')}) AS collected,
                            SUM(${visitOutstandingAmountSql('v')}) AS outstanding
                        FROM visits v
                        JOIN patients p ON p.id = v.patient_id AND p.is_active = true
                        WHERE ${visitDateExpr} >= $1::timestamptz
                          AND ${visitDateExpr} <  $2::timestamptz
                        GROUP BY 1
                    ),
                    ortho_data AS (
                        SELECT
                            day_start,
                            SUM(collected) AS collected,
                            SUM(outstanding) AS outstanding
                        FROM (
                            SELECT
                                date_trunc('day', ${orthoCaseDateExpr}) AS day_start,
                                SUM(COALESCE(oc.downpayment, 0)) AS collected,
                                SUM(GREATEST(COALESCE(oc.total_cost, 0) - COALESCE(oc.downpayment, 0), 0)) AS outstanding
                            FROM orthodontic_cases oc
                            JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                            WHERE ${orthoCaseDateExpr} >= $1::timestamptz
                              AND ${orthoCaseDateExpr} <  $2::timestamptz
                            GROUP BY 1

                            UNION ALL

                            SELECT
                                date_trunc('day', ${orthoAdjustmentDateExpr}) AS day_start,
                                SUM(COALESCE(oa.amount_paid, 0)) AS collected,
                                0 AS outstanding
                            FROM orthodontic_adjustments oa
                            JOIN patients p ON p.id = oa.patient_id AND p.is_active = true
                            WHERE ${orthoAdjustmentDateExpr} >= $1::timestamptz
                              AND ${orthoAdjustmentDateExpr} <  $2::timestamptz
                            GROUP BY 1
                        ) ortho_payments
                        GROUP BY day_start
                    )
                    SELECT
                        to_char(d.day_start, 'Mon DD, YYYY') AS month_label,
                        d.day_start AS month_start,
                        d.day_start + INTERVAL '1 day' AS bucket_end,
                        COALESCE(vd.collected, 0) + COALESCE(od.collected, 0) AS collected,
                        COALESCE(vd.outstanding, 0) + COALESCE(od.outstanding, 0) AS outstanding
                    FROM days d
                    LEFT JOIN visit_data vd ON vd.day_start = d.day_start
                    LEFT JOIN ortho_data od ON od.day_start = d.day_start
                    ORDER BY d.day_start ASC
                `, [customFrom, customTo])
                : pool.query(`
                    WITH months AS (
                        SELECT generate_series(
                            date_trunc('month', CURRENT_DATE - ($1 || ' months')::interval),
                            date_trunc('month', CURRENT_DATE),
                            '1 month'
                        ) AS month_start
                    ),
                    visit_data AS (
                        SELECT
                            date_trunc('month', ${visitDateExpr}) AS month_start,
                            SUM(${visitCollectedAmountSql('v')}) AS collected,
                            SUM(${visitOutstandingAmountSql('v')}) AS outstanding
                        FROM visits v
                        JOIN patients p ON p.id = v.patient_id AND p.is_active = true
                        WHERE ${visitDateExpr} >= date_trunc('month', CURRENT_DATE - ($1 || ' months')::interval)
                        GROUP BY 1
                    ),
                    ortho_data AS (
                        SELECT
                            month_start,
                            SUM(collected) AS collected,
                            SUM(outstanding) AS outstanding
                        FROM (
                            SELECT
                                date_trunc('month', ${orthoCaseDateExpr}) AS month_start,
                                SUM(COALESCE(oc.downpayment, 0)) AS collected,
                                SUM(GREATEST(COALESCE(oc.total_cost, 0) - COALESCE(oc.downpayment, 0), 0)) AS outstanding
                            FROM orthodontic_cases oc
                            JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                            WHERE ${orthoCaseDateExpr} >= date_trunc('month', CURRENT_DATE - ($1 || ' months')::interval)
                            GROUP BY 1

                            UNION ALL

                            SELECT
                                date_trunc('month', ${orthoAdjustmentDateExpr}) AS month_start,
                                SUM(COALESCE(oa.amount_paid, 0)) AS collected,
                                0 AS outstanding
                            FROM orthodontic_adjustments oa
                            JOIN patients p ON p.id = oa.patient_id AND p.is_active = true
                            WHERE ${orthoAdjustmentDateExpr} >= date_trunc('month', CURRENT_DATE - ($1 || ' months')::interval)
                            GROUP BY 1
                        ) ortho_payments
                        GROUP BY month_start
                    )
                    SELECT
                        to_char(m.month_start, 'Mon') AS month_label,
                        m.month_start,
                        m.month_start + INTERVAL '1 month' AS bucket_end,
                        COALESCE(vd.collected, 0) + COALESCE(od.collected, 0) AS collected,
                        COALESCE(vd.outstanding, 0) + COALESCE(od.outstanding, 0) AS outstanding
                    FROM months m
                    LEFT JOIN visit_data vd ON vd.month_start = m.month_start
                    LEFT JOIN ortho_data od ON od.month_start = m.month_start
                    ORDER BY m.month_start ASC
                `, [trendMonths]),

            // ── Service breakdown (this month, grouped by visit_type) ──
            pool.query(`
                SELECT
                    LOWER(TRIM(v.visit_type)) AS visit_type,
                    COALESCE(SUM(${visitCollectedAmountSql('v')}), 0) AS total
                FROM visits v
                JOIN patients p ON p.id = v.patient_id AND p.is_active = true
                WHERE date_trunc('month', ${visitDateExpr}) = date_trunc('month', CURRENT_DATE)
                GROUP BY LOWER(TRIM(v.visit_type))
                ORDER BY total DESC
            `),

            pool.query(`
                SELECT
                    (
                        SELECT COALESCE(SUM(oc.downpayment), 0)
                        FROM orthodontic_cases oc
                        JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                        WHERE date_trunc('month', ${orthoCaseDateExpr}) = date_trunc('month', CURRENT_DATE)
                    ) +
                    (
                        SELECT COALESCE(SUM(oa.amount_paid), 0)
                        FROM orthodontic_adjustments oa
                        JOIN patients p ON p.id = oa.patient_id AND p.is_active = true
                        WHERE date_trunc('month', ${orthoAdjustmentDateExpr}) = date_trunc('month', CURRENT_DATE)
                    ) AS total
            `),

            // ── Top 5 outstanding patients ─────────────────────────────
            pool.query(`
                WITH outstanding AS (
                    SELECT
                        p.id, p.last_name, p.first_name, p.profile_photo,
                        COALESCE(SUM(${visitOutstandingAmountSql('v')}), 0) AS amount,
                        MAX(v.visit_date::date) AS last_visit
                    FROM visits v
                    JOIN patients p ON p.id = v.patient_id AND p.is_active = true
                    WHERE v.payment_status IN ('pending', 'partial')
                    GROUP BY p.id, p.last_name, p.first_name, p.profile_photo

                    UNION ALL

                    SELECT
                        p.id, p.last_name, p.first_name, p.profile_photo,
                        ${orthoOutstandingAmountSql('oc')} AS amount,
                        oc.updated_at::date AS last_visit
                    FROM orthodontic_cases oc
                    JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                    WHERE oc.status = 'active' AND ${orthoOutstandingAmountSql('oc')} > 0
                )
                SELECT
                    id, last_name, first_name, profile_photo,
                    SUM(amount) AS outstanding_amount,
                    MAX(last_visit) AS last_visit
                FROM outstanding
                GROUP BY id, last_name, first_name, profile_photo
                ORDER BY outstanding_amount DESC
                LIMIT 5
            `),

            pool.query(`
                SELECT COALESCE(SUM(COALESCE(v.cost, 0)), 0) AS total
                FROM visits v
                JOIN patients p ON p.id = v.patient_id AND p.is_active = true
            `),

            pool.query(`
                SELECT COALESCE(SUM(${visitCollectedAmountSql('v')}), 0) AS total
                FROM visits v
                JOIN patients p ON p.id = v.patient_id AND p.is_active = true
            `),

            pool.query(`
                SELECT
                    COALESCE(SUM(COALESCE(oc.total_cost, 0)), 0) AS billed,
                    COALESCE(SUM(COALESCE(oc.total_paid, 0)), 0) AS collected
                FROM orthodontic_cases oc
                JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
            `),
        ]);

        // ── Aggregate collected/outstanding totals ──────────────────────
        const thisMonthCollected =
            parseFloat(thisMonthVisitRes.rows[0].total) +
            parseFloat(thisMonthOrthoRes.rows[0].total);
        const lastMonthCollected =
            parseFloat(lastMonthVisitRes.rows[0].total) +
            parseFloat(lastMonthOrthoRes.rows[0].total);

        const outstandingTotal =
            parseFloat(outstandingVisitRes.rows[0].total) +
            parseFloat(outstandingOrthoRes.rows[0].total);

        const outstandingPatientCount = parseInt(outstandingPatientCountRes.rows[0].total, 10) || 0;

        // Collection rate = all collected revenue / all billed revenue
        const totalCollected =
            parseFloat(lifetimeVisitCollectedRes.rows[0].total) +
            parseFloat(lifetimeOrthoFinancialsRes.rows[0].collected);
        const totalBilled =
            parseFloat(lifetimeVisitBilledRes.rows[0].total) +
            parseFloat(lifetimeOrthoFinancialsRes.rows[0].billed);
        const collectionRate = totalBilled > 0
            ? Math.min(100, Math.round((totalCollected / totalBilled) * 100))
            : 0;

        // ── Service breakdown — map visit_type to 6 categories ──────────
        const SERVICE_MAP = {
            orthodontics: ['orthodontics', 'ortho', 'braces', 'retainer'],
            restorations: ['restoration', 'filling', 'composite', 'amalgam', 'crown', 'veneer', 'onlay', 'inlay'],
            extractions: ['extraction', 'surgery', 'oral surgery', 'tooth removal'],
            cleaning: ['cleaning', 'prophylaxis', 'prophy', 'scaling', 'polishing', 'teeth cleaning'],
            consultations: ['consultation', 'checkup', 'check-up', 'exam', 'examination', 'x-ray', 'xray', 'radiograph'],
        };

        const serviceBreakdown = { orthodontics: 0, restorations: 0, extractions: 0, cleaning: 0, consultations: 0, others: 0 };

        for (const row of serviceRes.rows) {
            const type = (row.visit_type || '').toLowerCase();
            let matched = false;
            for (const [category, keywords] of Object.entries(SERVICE_MAP)) {
                if (keywords.some(kw => type.includes(kw))) {
                    serviceBreakdown[category] += parseFloat(row.total);
                    matched = true;
                    break;
                }
            }
            if (!matched) serviceBreakdown.others += parseFloat(row.total);
        }

        serviceBreakdown.orthodontics += parseFloat(orthoServiceRes.rows[0].total || 0);

        // Get last month name
        const lastMonthDate = new Date();
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        const lastMonthName = lastMonthDate.toLocaleString('en-US', { month: 'long' });

        res.json({
            thisMonth: thisMonthCollected,
            lastMonth: lastMonthCollected,
            lastMonthName,
            dateBasis,
            outstanding: outstandingTotal,
            outstandingPatientCount,
            collectionRate,
            trend: trendRes.rows.map(r => ({
                label: r.month_label,
                bucketStart: r.month_start,
                bucketEnd: r.bucket_end,
                collected: parseFloat(r.collected),
                outstanding: parseFloat(r.outstanding),
            })),
            services: serviceBreakdown,
            topOutstanding: topOutstandingRes.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/revenue/drilldown', verifyToken, async (req, res) => {
    try {
        const allowedDateBases = ['activity', 'recorded'];
        const dateBasis = allowedDateBases.includes(req.query.dateBasis) ? req.query.dateBasis : 'activity';
        const source = allowedRevenueSources.includes(req.query.source) ? req.query.source : 'all';
        const metric = allowedRevenueMetrics.includes(req.query.metric) ? req.query.metric : 'collected';
        const dateSql = revenueDateSql[dateBasis];

        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        if (!DATE_PARAM_RE.test(startDate || '') || !DATE_PARAM_RE.test(endDate || '')) {
            return res.status(400).json({ error: 'startDate and endDate are required in YYYY-MM-DD format.' });
        }

        const visitDateExpr = dateSql.visit('v');
        const orthoCaseDateExpr = dateSql.orthoCase('oc');
        const orthoAdjustmentDateExpr = dateSql.orthoAdjustment('oa');
        const visitAmountExpr = metric === 'collected'
            ? visitCollectedAmountSql('v')
            : visitOutstandingAmountSql('v');
        const visitAmountWhere = metric === 'collected'
            ? `${visitAmountExpr} > 0`
            : `v.payment_status IN ('pending', 'partial') AND ${visitAmountExpr} > 0`;
        const orthoBalanceExpr = orthoOutstandingAmountSql('oc');
        const orthoCreatedOutstandingExpr = `
            GREATEST(COALESCE(oc.total_cost, 0) - COALESCE(oc.downpayment, 0), 0)
        `;

        const queries = [];

        if (source === 'all' || source === 'visits') {
            queries.push(pool.query(`
                SELECT
                    v.id AS entry_id,
                    p.id AS patient_id,
                    p.first_name,
                    p.last_name,
                    p.profile_photo,
                    'visit' AS source_type,
                    COALESCE(NULLIF(v.visit_type, ''), 'Visit') AS label,
                    ${visitAmountExpr} AS amount,
                    v.visit_date AS activity_at,
                    v.created_at AS recorded_at,
                    ${visitDateExpr} AS reference_at,
                    COALESCE(v.payment_status, '') AS details
                FROM visits v
                JOIN patients p ON p.id = v.patient_id AND p.is_active = true
                WHERE ${visitDateExpr} >= $1::timestamptz
                  AND ${visitDateExpr} < $2::timestamptz
                  AND ${visitAmountWhere}
            `, [startDate, endDate]));
        }

        if (source === 'all' || source === 'orthodontics') {
            if (metric === 'collected') {
                queries.push(
                    pool.query(`
                        SELECT
                            oc.id AS entry_id,
                            p.id AS patient_id,
                            p.first_name,
                            p.last_name,
                            p.profile_photo,
                            'ortho_downpayment' AS source_type,
                            'Orthodontic downpayment' AS label,
                            COALESCE(oc.downpayment, 0) AS amount,
                            oc.start_date::timestamptz AS activity_at,
                            oc.created_at AS recorded_at,
                            ${orthoCaseDateExpr} AS reference_at,
                            COALESCE(oc.status, '') AS details
                        FROM orthodontic_cases oc
                        JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                        WHERE ${orthoCaseDateExpr} >= $1::timestamptz
                          AND ${orthoCaseDateExpr} < $2::timestamptz
                          AND COALESCE(oc.downpayment, 0) > 0
                    `, [startDate, endDate]),
                    pool.query(`
                        SELECT
                            oa.id AS entry_id,
                            p.id AS patient_id,
                            p.first_name,
                            p.last_name,
                            p.profile_photo,
                            'ortho_adjustment' AS source_type,
                            'Orthodontic adjustment' AS label,
                            COALESCE(oa.amount_paid, 0) AS amount,
                            oa.adjustment_date::timestamptz AS activity_at,
                            oa.created_at AS recorded_at,
                            ${orthoAdjustmentDateExpr} AS reference_at,
                            COALESCE(oa.notes, '') AS details
                        FROM orthodontic_adjustments oa
                        JOIN patients p ON p.id = oa.patient_id AND p.is_active = true
                        WHERE ${orthoAdjustmentDateExpr} >= $1::timestamptz
                          AND ${orthoAdjustmentDateExpr} < $2::timestamptz
                          AND COALESCE(oa.amount_paid, 0) > 0
                    `, [startDate, endDate])
                );
            } else {
                queries.push(pool.query(`
                    SELECT
                        oc.id AS entry_id,
                        p.id AS patient_id,
                        p.first_name,
                        p.last_name,
                        p.profile_photo,
                        'ortho_balance' AS source_type,
                        'Orthodontic balance after downpayment' AS label,
                        ${orthoCreatedOutstandingExpr} AS amount,
                        oc.start_date::timestamptz AS activity_at,
                        oc.created_at AS recorded_at,
                        ${orthoCaseDateExpr} AS reference_at,
                        COALESCE(oc.status, '') AS details
                    FROM orthodontic_cases oc
                    JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
                    WHERE ${orthoCaseDateExpr} >= $1::timestamptz
                      AND ${orthoCaseDateExpr} < $2::timestamptz
                      AND ${orthoCreatedOutstandingExpr} > 0
                `, [startDate, endDate]));
            }
        }

        const results = await Promise.all(queries);
        const rows = results
            .flatMap(result => result.rows)
            .map(mapRevenueDrilldownRow)
            .sort((a, b) => {
                const timeDiff = new Date(b.referenceAt).getTime() - new Date(a.referenceAt).getTime();
                if (timeDiff !== 0) return timeDiff;
                if (b.amount !== a.amount) return b.amount - a.amount;
                return a.patientName.localeCompare(b.patientName);
            });

        res.json({
            dateBasis,
            source,
            metric,
            startDate,
            endDate,
            total: rows.reduce((sum, row) => sum + row.amount, 0),
            count: rows.length,
            breakdown: summarizeRevenueDrilldown(rows),
            rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
