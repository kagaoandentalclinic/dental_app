const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const {
    normalizePatientPayload,
    validateRequiredPatientFields,
    findExistingPatientId,
    createPatientWithSections,
    updatePatientSections,
} = require('../utils/patientSections');

async function getKioskRow() {
    await pool.query('ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS kiosk_token VARCHAR(64)');
    const result = await pool.query(
        'SELECT kiosk_token, clinic_name FROM clinic_settings LIMIT 1'
    );
    return result.rows[0] || null;
}

// GET /api/kiosk/validate/:token — check token validity, return clinic name
router.get('/validate/:token', async (req, res) => {
    try {
        const row = await getKioskRow();
        if (!row || !row.kiosk_token || row.kiosk_token !== req.params.token) {
            return res.status(404).json({ error: 'Invalid kiosk token' });
        }
        res.json({ ok: true, clinic_name: row.clinic_name || 'Our Clinic' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/kiosk/:token — submit patient registration from clinic iPad
// No anti-spam — the token acts as the access control for the dedicated device
router.post('/:token', async (req, res) => {
    try {
        const row = await getKioskRow();
        if (!row || !row.kiosk_token || row.kiosk_token !== req.params.token) {
            return res.status(403).json({ error: 'Invalid kiosk token' });
        }
        const sections = normalizePatientPayload(req.body);
        const missing = validateRequiredPatientFields(sections);
        if (missing.length > 0) {
            return res.status(400).json({ error: 'Last name, first name, and date of birth are required' });
        }

        const existingPatientId = await findExistingPatientId(pool, sections.patient);
        if (existingPatientId) {
            await updatePatientSections(pool, existingPatientId, sections, null);
            return res.json({ updated: true, patientName: sections.patient.first_name });
        }

        await createPatientWithSections(pool, sections, null);
        res.status(201).json({ updated: false, patientName: sections.patient.first_name });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
