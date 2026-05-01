const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

// GET /api/dashboard/stats
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const allowedRevenuePeriods = ['day', 'biweek', 'month'];
        const revenuePeriod = allowedRevenuePeriods.includes(req.query.revenuePeriod)
            ? req.query.revenuePeriod
            : 'month';

        const [
            totalPatientsRes,
            visitsTodayRes,
            upcomingRes,
            monthlyRevenueRes,
            recentPatientsRes,
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM patients WHERE is_active = true"),
            pool.query("SELECT COUNT(*) FROM appointments WHERE appointment_date >= CURRENT_DATE AND appointment_date < CURRENT_DATE + INTERVAL '1 day' AND status NOT IN ('cancelled', 'completed')"),
            pool.query("SELECT COUNT(*) FROM appointments WHERE appointment_date >= CURRENT_DATE + INTERVAL '1 day' AND appointment_date < NOW() + INTERVAL '30 days' AND status NOT IN ('cancelled', 'completed')"),
            pool.query(`
        WITH bounds AS (
          SELECT
            CASE $1
              WHEN 'day' THEN CURRENT_DATE::timestamptz
              WHEN 'biweek' THEN (CURRENT_DATE - INTERVAL '13 days')::timestamptz
              ELSE date_trunc('month', CURRENT_DATE)::timestamptz
            END AS period_start,
            CASE $1
              WHEN 'day' THEN (CURRENT_DATE + INTERVAL '1 day')::timestamptz
              WHEN 'biweek' THEN (CURRENT_DATE + INTERVAL '1 day')::timestamptz
              ELSE (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::timestamptz
            END AS period_end
        ),
        visit_revenue AS (
          SELECT COALESCE(SUM(v.cost), 0) AS total
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
      `, [revenuePeriod]),
            pool.query(`
        SELECT p.id, p.last_name, p.first_name, p.date_of_birth, p.sex, p.profile_photo,
          (SELECT MAX(v.visit_date) FROM visits v WHERE v.patient_id = p.id) AS last_visit,
          (SELECT COUNT(*) FROM dental_chart dc WHERE dc.patient_id = p.id AND dc.status != 'healthy') AS dental_issues
        FROM patients p WHERE p.is_active = true
        ORDER BY p.created_at DESC LIMIT 5
      `),
        ]);

        res.json({
            totalPatients: parseInt(totalPatientsRes.rows[0].count),
            appointmentsToday: parseInt(visitsTodayRes.rows[0].count),
            upcomingAppointments: parseInt(upcomingRes.rows[0].count),
            monthlyRevenue: parseFloat(monthlyRevenueRes.rows[0].total),
            revenuePeriod,
            recentPatients: recentPatientsRes.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
