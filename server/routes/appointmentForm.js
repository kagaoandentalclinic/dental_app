const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { publicFormLimiter, checkHoneypot, checkTiming, checkDuplicateCooldown, checkDeviceId } = require('../middleware/antiSpam');
const { buildClinicAppointmentDateTime } = require('../utils/appointmentDate');

async function getFormSettings(slug) {
    const result = await pool.query(
        'SELECT appt_form_enabled, appt_form_slug, appt_form_redirect_url FROM clinic_settings LIMIT 1'
    );
    if (result.rows.length === 0 || !result.rows[0].appt_form_slug) return null;
    const s = result.rows[0];
    if (s.appt_form_slug !== slug) return null;
    return s;
}

// GET /api/appointment-form/status/:slug — public: validate slug
router.get('/status/:slug', async (req, res) => {
    try {
        const settings = await getFormSettings(req.params.slug);
        if (!settings) return res.status(404).json({ error: 'Form not found' });
        if (!settings.appt_form_enabled) {
            return res.status(403).json({ error: 'Form is currently unavailable', disabled: true });
        }
        res.json({ enabled: true, redirect_url: settings.appt_form_redirect_url || null });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/appointment-form/:slug — public: submit appointment request
router.post('/:slug', publicFormLimiter, checkHoneypot, checkTiming, checkDeviceId, checkDuplicateCooldown, async (req, res) => {
    try {
        const settings = await getFormSettings(req.params.slug);
        if (!settings) return res.status(404).json({ error: 'Form not found' });
        if (!settings.appt_form_enabled) {
            return res.status(403).json({ error: 'Form is currently unavailable' });
        }

        const {
            last_name, first_name, date_of_birth,
            preferred_date, preferred_time,
            appointment_type, notes,
        } = req.body;

        if (!last_name?.trim() || !first_name?.trim() || !date_of_birth) {
            return res.status(400).json({ error: 'Last name, first name, and date of birth are required' });
        }
        if (!preferred_date) {
            return res.status(400).json({ error: 'Preferred date is required' });
        }

        // Match existing patient by full name + DOB
        const patientRes = await pool.query(`
            SELECT id, first_name, last_name
            FROM patients
            WHERE LOWER(TRIM(first_name)) = LOWER(TRIM($1))
              AND LOWER(TRIM(last_name))  = LOWER(TRIM($2))
              AND date_of_birth = $3
              AND is_active = true
            LIMIT 1
        `, [first_name.trim(), last_name.trim(), date_of_birth]);

        if (patientRes.rows.length === 0) {
            return res.status(404).json({
                error: 'No matching patient record found. Please check your name and date of birth, or contact clinic staff.',
                noMatch: true,
            });
        }

        const patient = patientRes.rows[0];

        // Build appointment datetime from preferred date + time
        const timeStr = preferred_time || '09:00';
        const appointmentDate = buildClinicAppointmentDateTime(preferred_date, timeStr);
        if (!appointmentDate) {
            return res.status(400).json({ error: 'Invalid preferred date or time' });
        }

        // Create appointment with 'pending' status (patient-submitted request)
        const apptRes = await pool.query(`
            INSERT INTO appointments
              (patient_id, appointment_date, appointment_type, status, notes)
            VALUES ($1, $2, $3, 'pending', $4)
            RETURNING id
        `, [
            patient.id,
            appointmentDate.toISOString(),
            appointment_type || 'checkup',
            notes || null,
        ]);

        res.locals.recordSpamKey?.();
        res.json({
            success: true,
            patientName: patient.first_name,
            appointmentId: apptRes.rows[0].id,
            redirect_url: settings.appt_form_redirect_url || null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
