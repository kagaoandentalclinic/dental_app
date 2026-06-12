const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

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
          SELECT COALESCE(SUM(
            CASE
              WHEN v.payment_status = 'partial' THEN COALESCE(v.cost, 0) * 0.5
              ELSE COALESCE(v.cost, 0)
            END
          ), 0) AS total
          FROM visits v
          JOIN patients p ON p.id = v.patient_id AND p.is_active = true
          , bounds
          WHERE v.visit_date >= bounds.period_start
            AND v.visit_date < bounds.period_end
            AND v.payment_status IN ('paid', 'insurance', 'partial')
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
          (SELECT COUNT(*) FROM dental_chart dc WHERE dc.patient_id = p.id AND dc.status IN ('cavity', 'root_fragment')) AS dental_issues
        FROM patients p WHERE p.is_active = true
        ORDER BY p.created_at DESC LIMIT 5
      `),
            pool.query(`
        WITH outstanding AS (
          SELECT
            p.id, p.last_name, p.first_name, p.profile_photo,
            COUNT(v.id) AS visit_count,
            COALESCE(SUM(
              CASE
                WHEN v.payment_status = 'partial' THEN COALESCE(v.cost, 0) * 0.5
                ELSE COALESCE(v.cost, 0)
              END
            ), 0) AS amount,
            MAX(v.visit_date::date) AS last_activity
          FROM visits v
          JOIN patients p ON p.id = v.patient_id AND p.is_active = true
          WHERE v.payment_status IN ('pending', 'partial')
          GROUP BY p.id, p.last_name, p.first_name, p.profile_photo

          UNION ALL

          SELECT
            p.id, p.last_name, p.first_name, p.profile_photo,
            0 AS visit_count,
            (oc.total_cost - oc.total_paid) AS amount,
            oc.updated_at::date AS last_activity
          FROM orthodontic_cases oc
          JOIN patients p ON p.id = oc.patient_id AND p.is_active = true
          WHERE oc.status = 'active' AND oc.total_paid < oc.total_cost
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

module.exports = router;
