const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const pool = require('../db/pool');
const { verifyPortalPatient } = require('../middleware/portalAuth');
const { signPortalToken } = require('../utils/jwt');
const { logAudit } = require('../utils/auditLogs');
const logger = require('../utils/logger');
const { sendPortalPasswordResetEmail, sendPortalVerificationEmail } = require('../utils/portalEmail');
const { verifyGoogleIdToken } = require('../utils/googleAuth');
const { buildClinicAppointmentDateTime } = require('../utils/appointmentDate');

const VERIFICATION_WINDOW_HOURS = 48;
const PASSWORD_RESET_WINDOW_HOURS = 2;

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function normalizePhone(phone) {
    return String(phone || '').trim();
}

function isSundayBookingDate(preferredDate) {
    const value = String(preferredDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    return new Date(`${value}T12:00:00Z`).getUTCDay() === 0;
}

function hashVerificationToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function createVerificationToken() {
    const rawToken = crypto.randomBytes(32).toString('hex');
    return {
        rawToken,
        tokenHash: hashVerificationToken(rawToken),
    };
}

function portalPatientPayload(row) {
    return {
        id: row.id,
        first_name: row.first_name,
        last_name: row.last_name,
        full_name: `${row.first_name} ${row.last_name}`.trim(),
        portal_email: row.portal_email,
        portal_email_verified: Boolean(row.portal_email_verified),
        phone: row.phone || '',
        address: row.address || '',
        emergency_contact_name: row.emergency_contact_name || '',
        emergency_contact_phone: row.emergency_contact_phone || '',
        date_of_birth: row.date_of_birth,
        profile_photo: row.profile_photo || null,
    };
}

async function getPortalPatientDetail(db, patientId) {
    const result = await db.query(
        `SELECT
            p.id,
            p.first_name,
            p.last_name,
            p.date_of_birth,
            p.profile_photo,
            p.portal_email,
            p.portal_email_verified,
            COALESCE(pc.phone, p.phone) AS phone,
            COALESCE(pc.address, p.address) AS address,
            pc.emergency_contact_name,
            pc.emergency_contact_phone
         FROM patients p
         LEFT JOIN patient_contacts pc ON pc.patient_id = p.id
         WHERE p.id = $1 AND p.is_active = true`,
        [patientId]
    );
    return result.rows[0] || null;
}

async function findPortalPatientByEmail(db, email) {
    const result = await db.query(
        `SELECT p.*, COALESCE(pc.phone, p.phone) AS phone
         FROM patients p
         LEFT JOIN patient_contacts pc ON pc.patient_id = p.id
         WHERE LOWER(p.portal_email) = LOWER($1)
           AND p.is_active = true
         LIMIT 1`,
        [email]
    );
    return result.rows[0] || null;
}

async function findPortalPatientByGoogleSub(db, googleSub) {
    const result = await db.query(
        `SELECT p.*, COALESCE(pc.phone, p.phone) AS phone
         FROM patients p
         LEFT JOIN patient_contacts pc ON pc.patient_id = p.id
         WHERE p.portal_google_sub = $1
           AND p.is_active = true
         LIMIT 1`,
        [googleSub]
    );
    return result.rows[0] || null;
}

async function findPortalPatientByVerificationToken(db, rawToken) {
    const result = await db.query(
        `SELECT id
         FROM patients
         WHERE portal_email_verification_token_hash = $1
           AND portal_email_verification_sent_at >= NOW() - $2::interval
           AND is_active = true
         LIMIT 1`,
        [hashVerificationToken(rawToken), `${VERIFICATION_WINDOW_HOURS} hours`]
    );
    return result.rows[0] || null;
}

async function findPortalPatientByPasswordResetToken(db, rawToken) {
    const result = await db.query(
        `SELECT id
         FROM patients
         WHERE portal_password_reset_token_hash = $1
           AND portal_password_reset_sent_at >= NOW() - $2::interval
           AND is_active = true
         LIMIT 1`,
        [hashVerificationToken(rawToken), `${PASSWORD_RESET_WINDOW_HOURS} hours`]
    );
    return result.rows[0] || null;
}

async function findMatchingPatient(db, email, phone) {
    const result = await db.query(
        `SELECT
            p.id,
            p.first_name,
            p.last_name,
            p.date_of_birth,
            p.profile_photo,
            p.portal_email,
            p.portal_password_hash,
            p.portal_registered,
            p.portal_email_verified,
            p.portal_google_sub,
            COALESCE(pc.email, p.email) AS email,
            COALESCE(pc.phone, p.phone) AS phone
         FROM patients p
         LEFT JOIN patient_contacts pc ON pc.patient_id = p.id
         WHERE p.is_active = true
           AND (
             LOWER(COALESCE(pc.email, p.email, '')) = LOWER($1)
             OR COALESCE(pc.phone, p.phone, '') = $2
           )
         ORDER BY p.created_at DESC
         LIMIT 1`,
        [email, phone]
    );
    return result.rows[0] || null;
}

async function findMatchingPatientByEmail(db, email) {
    const result = await db.query(
        `SELECT
            p.id,
            p.first_name,
            p.last_name,
            p.date_of_birth,
            p.profile_photo,
            p.portal_email,
            p.portal_password_hash,
            p.portal_registered,
            p.portal_email_verified,
            p.portal_google_sub,
            COALESCE(pc.email, p.email) AS email,
            COALESCE(pc.phone, p.phone) AS phone
         FROM patients p
         LEFT JOIN patient_contacts pc ON pc.patient_id = p.id
         WHERE p.is_active = true
           AND LOWER(COALESCE(pc.email, p.email, '')) = LOWER($1)
         ORDER BY p.created_at DESC
         LIMIT 1`,
        [email]
    );
    return result.rows[0] || null;
}

async function upsertPortalContact(db, patientId, values) {
    await db.query(
        `INSERT INTO patient_contacts (
            patient_id, address, phone, email, emergency_contact_name, emergency_contact_phone, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (patient_id) DO UPDATE SET
            address = EXCLUDED.address,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            emergency_contact_name = EXCLUDED.emergency_contact_name,
            emergency_contact_phone = EXCLUDED.emergency_contact_phone,
            updated_at = NOW()`,
        [
            patientId,
            values.address || null,
            values.phone || null,
            values.email || null,
            values.emergency_contact_name || null,
            values.emergency_contact_phone || null,
        ]
    );
}

async function issuePortalAuthResponse(res, db, patientId) {
    const detail = await getPortalPatientDetail(db, patientId);
    const token = signPortalToken({
        patient_id: detail.id,
        first_name: detail.first_name,
        last_name: detail.last_name,
    });
    res.json({
        token,
        patient: portalPatientPayload(detail),
    });
}

async function sendVerificationForPatient(detail, rawToken) {
    try {
        return await sendPortalVerificationEmail({
            to: detail.portal_email,
            firstName: detail.first_name,
            token: rawToken,
        });
    } catch (err) {
        logger.error('Failed to send portal verification email', err, { patientId: detail.id, email: detail.portal_email });
        throw err;
    }
}

async function sendPasswordResetForPatient(detail, rawToken) {
    try {
        return await sendPortalPasswordResetEmail({
            to: detail.portal_email,
            firstName: detail.first_name,
            token: rawToken,
        });
    } catch (err) {
        logger.error('Failed to send portal password reset email', err, { patientId: detail.id, email: detail.portal_email });
        throw err;
    }
}

async function issueVerificationRequiredResponse(res, detail, rawToken, fallbackMessage) {
    const delivery = await sendVerificationForPatient(detail, rawToken);
    return res.status(201).json({
        requires_verification: true,
        email: detail.portal_email,
        message: delivery.sent
            ? 'We sent a confirmation email. Please verify your address before signing in.'
            : fallbackMessage || 'Account created. Email delivery is not configured yet, so use the preview verification link below.',
        delivery_mode: delivery.mode,
        preview_link: delivery.previewLink,
    });
}

router.post('/register',
    body('first_name').trim().notEmpty(),
    body('last_name').trim().notEmpty(),
    body('email').isEmail(),
    body('phone').trim().notEmpty(),
    body('password').isLength({ min: 6 }),
    body('confirm_password').custom((value, { req }) => value === req.body.password),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        if (String(req.body.confirm_password || '') !== String(req.body.password || '')) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        const firstName = req.body.first_name.trim();
        const lastName = req.body.last_name.trim();
        const email = normalizeEmail(req.body.email);
        const phone = normalizePhone(req.body.phone);
        const passwordHash = await bcrypt.hash(req.body.password, 10);
        const { rawToken, tokenHash } = createVerificationToken();

        const db = await pool.connect();
        let committed = false;
        try {
            await db.query('BEGIN');

            const existingPortal = await findPortalPatientByEmail(db, email);
            if (existingPortal && existingPortal.portal_email_verified) {
                await db.query('ROLLBACK');
                return res.status(409).json({ error: 'A verified portal account already exists for this email.' });
            }

            let patient = existingPortal || await findMatchingPatient(db, email, phone);

            if (patient && patient.portal_password_hash && patient.portal_email_verified && normalizeEmail(patient.portal_email) !== email) {
                await db.query('ROLLBACK');
                return res.status(409).json({ error: 'This patient record already has a portal account. Please log in instead.' });
            }

            let patientId;
            let beforeDetail = null;

            if (patient) {
                patientId = patient.id;
                beforeDetail = await getPortalPatientDetail(db, patientId);
                await db.query(
                    `UPDATE patients
                     SET portal_registered = true,
                         portal_email = $1,
                         portal_password_hash = $2,
                         portal_email_verified = false,
                         portal_email_verification_token_hash = $3,
                         portal_email_verification_sent_at = NOW(),
                         portal_registered_at = COALESCE(portal_registered_at, NOW()),
                         portal_last_login = NULL,
                         portal_google_sub = NULL,
                         email = COALESCE(email, $1),
                         phone = COALESCE(phone, $4),
                         updated_at = NOW()
                     WHERE id = $5`,
                    [email, passwordHash, tokenHash, phone, patientId]
                );
            } else {
                const created = await db.query(
                    `INSERT INTO patients (
                        record_date, last_name, first_name, email, phone,
                        portal_registered, portal_email, portal_password_hash,
                        portal_email_verified, portal_email_verification_token_hash,
                        portal_email_verification_sent_at, portal_registered_at,
                        created_at, updated_at
                    ) VALUES (
                        CURRENT_DATE, $1, $2, $3, $4,
                        true, $3, $5, false, $6, NOW(), NOW(),
                        NOW(), NOW()
                    )
                    RETURNING id`,
                    [lastName, firstName, email, phone, passwordHash, tokenHash]
                );
                patientId = created.rows[0].id;
            }

            await upsertPortalContact(db, patientId, { email, phone });
            const afterDetail = await getPortalPatientDetail(db, patientId);

            await logAudit(db, {
                actorRole: 'portal_patient',
                entityType: 'patient',
                entityId: patientId,
                patientId,
                action: patient ? 'portal.register_pending_link_existing' : 'portal.register_pending_create_patient',
                beforeData: beforeDetail,
                afterData: afterDetail,
                metadata: { source: 'patient_portal', verified: false },
            });

            await db.query('COMMIT');
            committed = true;
            return issueVerificationRequiredResponse(res, afterDetail, rawToken);
        } catch (err) {
            if (!committed) {
                await db.query('ROLLBACK');
            }
            logger.error('Failed to register portal account', err, { email });
            return res.status(500).json({ error: 'Failed to register portal account' });
        } finally {
            db.release();
        }
    }
);

router.post('/resend-verification',
    body('email').isEmail(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const email = normalizeEmail(req.body.email);
        const db = await pool.connect();
        let committed = false;
        try {
            await db.query('BEGIN');
            const patient = await findPortalPatientByEmail(db, email);
            if (!patient || patient.portal_email_verified || !patient.portal_password_hash) {
                await db.query('ROLLBACK');
                return res.json({ message: 'If that account exists, a new confirmation email has been sent.' });
            }

            const { rawToken, tokenHash } = createVerificationToken();
            await db.query(
                `UPDATE patients
                 SET portal_email_verification_token_hash = $1,
                     portal_email_verification_sent_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $2`,
                [tokenHash, patient.id]
            );
            const detail = await getPortalPatientDetail(db, patient.id);
            await db.query('COMMIT');
            committed = true;

            const delivery = await sendVerificationForPatient(detail, rawToken);
            return res.json({
                message: delivery.sent
                    ? 'A new confirmation email has been sent.'
                    : 'Email delivery is not configured yet, so use the preview verification link below.',
                delivery_mode: delivery.mode,
                preview_link: delivery.previewLink,
            });
        } catch (err) {
            if (!committed) {
                await db.query('ROLLBACK');
            }
            logger.error('Failed to resend portal verification email', err, { email });
            return res.status(500).json({ error: 'Failed to resend confirmation email' });
        } finally {
            db.release();
        }
    }
);

router.post('/verify-email',
    body('token').trim().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const token = String(req.body.token || '').trim();
        const matched = await findPortalPatientByVerificationToken(pool, token);
        if (!matched) {
            return res.status(400).json({ error: 'This confirmation link is invalid or has expired.' });
        }

        const db = await pool.connect();
        try {
            await db.query('BEGIN');
            const beforeDetail = await getPortalPatientDetail(db, matched.id);

            await db.query(
                `UPDATE patients
                 SET portal_email_verified = true,
                     portal_email_verification_token_hash = NULL,
                     portal_email_verification_sent_at = NULL,
                     portal_last_login = NOW(),
                     updated_at = NOW()
                 WHERE id = $1`,
                [matched.id]
            );

            const afterDetail = await getPortalPatientDetail(db, matched.id);
            await logAudit(db, {
                actorRole: 'portal_patient',
                entityType: 'patient',
                entityId: matched.id,
                patientId: matched.id,
                action: 'portal.verify_email',
                beforeData: beforeDetail,
                afterData: afterDetail,
                metadata: { source: 'patient_portal' },
            });

            await db.query('COMMIT');
            return issuePortalAuthResponse(res, db, matched.id);
        } catch (err) {
            await db.query('ROLLBACK');
            logger.error('Failed to verify portal email', err, { patientId: matched.id });
            return res.status(500).json({ error: 'Failed to confirm email' });
        } finally {
            db.release();
        }
    }
);

router.post('/request-password-reset',
    body('email').isEmail(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const email = normalizeEmail(req.body.email);
        const genericResponse = {
            message: 'If that portal account exists, a password reset link has been sent.',
        };
        const db = await pool.connect();
        let committed = false;

        try {
            await db.query('BEGIN');
            const patient = await findPortalPatientByEmail(db, email);
            if (!patient || !patient.portal_password_hash || !patient.portal_email_verified) {
                await db.query('ROLLBACK');
                return res.json(genericResponse);
            }

            const { rawToken, tokenHash } = createVerificationToken();
            await db.query(
                `UPDATE patients
                 SET portal_password_reset_token_hash = $1,
                     portal_password_reset_sent_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $2`,
                [tokenHash, patient.id]
            );
            const detail = await getPortalPatientDetail(db, patient.id);
            await logAudit(db, {
                actorRole: 'portal_patient',
                entityType: 'patient',
                entityId: patient.id,
                patientId: patient.id,
                action: 'portal.request_password_reset',
                afterData: {
                    portal_password_reset_sent_at: new Date().toISOString(),
                },
                metadata: { source: 'patient_portal' },
            });
            await db.query('COMMIT');
            committed = true;

            const delivery = await sendPasswordResetForPatient(detail, rawToken);
            return res.json({
                message: delivery.sent
                    ? genericResponse.message
                    : 'Email delivery is not configured yet, so use the preview reset link below.',
                delivery_mode: delivery.mode,
                preview_link: delivery.previewLink,
            });
        } catch (err) {
            if (!committed) {
                await db.query('ROLLBACK');
            }
            logger.error('Failed to request portal password reset', err, { email });
            return res.status(500).json({ error: 'Failed to request password reset' });
        } finally {
            db.release();
        }
    }
);

router.post('/reset-password',
    body('token').trim().notEmpty(),
    body('password').isLength({ min: 6 }),
    body('confirm_password').custom((value, { req }) => value === req.body.password),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        if (String(req.body.confirm_password || '') !== String(req.body.password || '')) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        const token = String(req.body.token || '').trim();
        const matched = await findPortalPatientByPasswordResetToken(pool, token);
        if (!matched) {
            return res.status(400).json({ error: 'That password reset link is invalid or has expired.' });
        }

        const passwordHash = await bcrypt.hash(req.body.password, 10);
        const db = await pool.connect();
        try {
            await db.query('BEGIN');
            const beforeDetail = await getPortalPatientDetail(db, matched.id);

            await db.query(
                `UPDATE patients
                 SET portal_password_hash = $1,
                     portal_password_reset_token_hash = NULL,
                     portal_password_reset_sent_at = NULL,
                     updated_at = NOW()
                 WHERE id = $2`,
                [passwordHash, matched.id]
            );

            const afterDetail = await getPortalPatientDetail(db, matched.id);
            await logAudit(db, {
                actorRole: 'portal_patient',
                entityType: 'patient',
                entityId: matched.id,
                patientId: matched.id,
                action: 'portal.reset_password',
                beforeData: beforeDetail,
                afterData: afterDetail,
                metadata: { source: 'patient_portal' },
            });

            await db.query('COMMIT');
            return res.json({
                message: 'Your password has been updated. You can sign in now.',
            });
        } catch (err) {
            await db.query('ROLLBACK');
            logger.error('Failed to reset portal password', err, { patientId: matched.id });
            return res.status(500).json({ error: 'Failed to reset password' });
        } finally {
            db.release();
        }
    }
);

router.post('/google',
    body('credential').trim().notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        try {
            const profile = await verifyGoogleIdToken(String(req.body.credential || '').trim());
            const db = await pool.connect();

            try {
                await db.query('BEGIN');

                const googleLinkedPatient = await findPortalPatientByGoogleSub(db, profile.sub);
                if (googleLinkedPatient) {
                    await db.query('UPDATE patients SET portal_last_login = NOW(), updated_at = NOW() WHERE id = $1', [googleLinkedPatient.id]);
                    await db.query('COMMIT');
                    return issuePortalAuthResponse(res, db, googleLinkedPatient.id);
                }

                const existingPortal = await findPortalPatientByEmail(db, profile.email);
                const matchedPatient = existingPortal || await findMatchingPatientByEmail(db, profile.email);

                let patientId;
                let beforeDetail = null;
                let action = 'portal.google_register_create_patient';

                if (matchedPatient) {
                    patientId = matchedPatient.id;
                    beforeDetail = await getPortalPatientDetail(db, patientId);

                    if (matchedPatient.portal_google_sub && matchedPatient.portal_google_sub !== profile.sub) {
                        await db.query('ROLLBACK');
                        return res.status(409).json({ error: 'This email is already linked to another Google account.' });
                    }

                    action = existingPortal ? 'portal.google_login_link_existing' : 'portal.google_register_link_existing';

                    await db.query(
                        `UPDATE patients
                         SET portal_registered = true,
                             portal_email = $1,
                             portal_email_verified = true,
                             portal_google_sub = $2,
                             portal_registered_at = COALESCE(portal_registered_at, NOW()),
                             portal_last_login = NOW(),
                             email = COALESCE(email, $1),
                             updated_at = NOW()
                         WHERE id = $3`,
                        [profile.email, profile.sub, patientId]
                    );
                } else {
                    const created = await db.query(
                        `INSERT INTO patients (
                            record_date, last_name, first_name, email,
                            portal_registered, portal_email, portal_email_verified,
                            portal_google_sub, portal_registered_at, portal_last_login,
                            created_at, updated_at
                        ) VALUES (
                            CURRENT_DATE, $1, $2, $3,
                            true, $3, true, $4, NOW(), NOW(),
                            NOW(), NOW()
                        )
                        RETURNING id`,
                        [
                            profile.lastName || profile.fullName || 'Patient',
                            profile.firstName || 'Google',
                            profile.email,
                            profile.sub,
                        ]
                    );
                    patientId = created.rows[0].id;
                }

                await upsertPortalContact(db, patientId, { email: profile.email });
                const afterDetail = await getPortalPatientDetail(db, patientId);

                await logAudit(db, {
                    actorRole: 'portal_patient',
                    entityType: 'patient',
                    entityId: patientId,
                    patientId,
                    action,
                    beforeData: beforeDetail,
                    afterData: afterDetail,
                    metadata: { source: 'patient_portal', auth_method: 'google' },
                });

                await db.query('COMMIT');
                return issuePortalAuthResponse(res, db, patientId);
            } catch (err) {
                await db.query('ROLLBACK');
                throw err;
            } finally {
                db.release();
            }
        } catch (err) {
            const statusCode = err.statusCode || 500;
            logger.error('Failed to authenticate with Google portal sign-in', err);
            return res.status(statusCode).json({ error: err.message || 'Failed to continue with Google' });
        }
    }
);

router.post('/login',
    body('email').isEmail(),
    body('password').notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const email = normalizeEmail(req.body.email);
        try {
            const patient = await findPortalPatientByEmail(pool, email);
            if (!patient || !patient.portal_password_hash) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const valid = await bcrypt.compare(req.body.password, patient.portal_password_hash);
            if (!valid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            if (!patient.portal_email_verified) {
                return res.status(403).json({
                    error: 'Please confirm your email before signing in.',
                    code: 'email_not_verified',
                });
            }

            await pool.query('UPDATE patients SET portal_last_login = NOW() WHERE id = $1', [patient.id]);
            return issuePortalAuthResponse(res, pool, patient.id);
        } catch (err) {
            logger.error('Failed to log in portal patient', err, { email });
            return res.status(500).json({ error: 'Failed to log in' });
        }
    }
);

router.get('/me', verifyPortalPatient, async (req, res) => {
    try {
        const detail = await getPortalPatientDetail(pool, req.portalPatient.patient_id);
        if (!detail) return res.status(404).json({ error: 'Patient not found' });
        res.json(portalPatientPayload(detail));
    } catch (err) {
        logger.error('Failed to load portal profile', err, { patientId: req.portalPatient.patient_id });
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

router.get('/dashboard', verifyPortalPatient, async (req, res) => {
    const patientId = req.portalPatient.patient_id;
    try {
        const [profile, upcoming, lastVisit, balance] = await Promise.all([
            getPortalPatientDetail(pool, patientId),
            pool.query(
                `SELECT appointment_date, appointment_type, status
                 FROM appointments
                 WHERE patient_id = $1
                   AND appointment_date >= NOW()
                   AND status IN ('pending', 'scheduled')
                 ORDER BY appointment_date ASC
                 LIMIT 1`,
                [patientId]
            ),
            pool.query(
                `SELECT MAX(visit_date) AS last_visit
                 FROM visits
                 WHERE patient_id = $1`,
                [patientId]
            ),
            pool.query(
                `WITH visit_due AS (
                    SELECT COALESCE(SUM(
                        CASE
                            WHEN payment_status = 'partial' THEN COALESCE(cost, 0) * 0.5
                            WHEN payment_status = 'pending' THEN COALESCE(cost, 0)
                            ELSE 0
                        END
                    ), 0) AS total
                    FROM visits
                    WHERE patient_id = $1 AND payment_status IN ('pending', 'partial')
                ),
                ortho_due AS (
                    SELECT COALESCE(SUM(total_cost - total_paid), 0) AS total
                    FROM orthodontic_cases
                    WHERE patient_id = $1 AND status = 'active' AND total_paid < total_cost
                )
                SELECT visit_due.total + ortho_due.total AS outstanding_balance
                FROM visit_due, ortho_due`,
                [patientId]
            ),
        ]);

        res.json({
            patient: portalPatientPayload(profile),
            upcoming_appointment: upcoming.rows[0] || null,
            last_visit: lastVisit.rows[0]?.last_visit || null,
            outstanding_balance: Number(balance.rows[0]?.outstanding_balance || 0),
        });
    } catch (err) {
        logger.error('Failed to load portal dashboard', err, { patientId });
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});

router.get('/history', verifyPortalPatient, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT appointment_date, appointment_type, status, notes
             FROM appointments
             WHERE patient_id = $1
               AND (appointment_date < NOW() OR status IN ('completed', 'cancelled', 'no_show'))
             ORDER BY appointment_date DESC`,
            [req.portalPatient.patient_id]
        );
        res.json(result.rows);
    } catch (err) {
        logger.error('Failed to load portal appointment history', err, { patientId: req.portalPatient.patient_id });
        res.status(500).json({ error: 'Failed to load appointment history' });
    }
});

router.get('/booked-times', verifyPortalPatient, async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end) {
        return res.status(400).json({ error: 'start and end are required' });
    }

    try {
        const result = await pool.query(
            `SELECT appointment_date, duration_minutes
             FROM appointments
             WHERE appointment_date >= $1
               AND appointment_date <= $2
               AND status != 'cancelled'
             ORDER BY appointment_date`,
            [start, end]
        );
        res.json(result.rows);
    } catch (err) {
        logger.error('Failed to load portal booked times', err, { patientId: req.portalPatient.patient_id });
        res.status(500).json({ error: 'Failed to load booked times' });
    }
});

router.post('/book', verifyPortalPatient, async (req, res) => {
    const { preferred_date, preferred_time, duration_minutes, service, notes } = req.body;
    if (!preferred_date || !preferred_time || !service) {
        return res.status(400).json({ error: 'Preferred date, time, and service are required.' });
    }
    if (isSundayBookingDate(preferred_date)) {
        return res.status(400).json({ error: 'Sunday bookings are unavailable. Please choose Monday to Saturday.' });
    }

    const appointmentDate = buildClinicAppointmentDateTime(preferred_date, preferred_time);
    if (!appointmentDate) {
        return res.status(400).json({ error: 'Invalid appointment date or time.' });
    }

    const requestedDuration = Number(duration_minutes || 60);
    if (![30, 60].includes(requestedDuration)) {
        return res.status(400).json({ error: 'Appointment duration must be 30 minutes or 1 hour.' });
    }

    try {
        const conflict = await pool.query(
            `SELECT id FROM appointments
             WHERE status != 'cancelled'
               AND appointment_date < ($1::timestamptz + ($2 || ' minutes')::interval)
               AND (appointment_date + (duration_minutes || ' minutes')::interval) > $1::timestamptz
             LIMIT 1`,
            [appointmentDate.toISOString(), requestedDuration]
        );
        if (conflict.rows.length > 0) {
            return res.status(409).json({ error: 'That time slot is already requested. Please choose another one.' });
        }

        const result = await pool.query(
            `INSERT INTO appointments (
                patient_id, dentist_id, appointment_date, duration_minutes,
                appointment_type, status, notes, created_by, source
            ) VALUES ($1, NULL, $2, $3, $4, 'pending', $5, NULL, 'patient_portal')
             RETURNING id, appointment_date, duration_minutes, appointment_type, status, source`,
            [req.portalPatient.patient_id, appointmentDate.toISOString(), requestedDuration, service, notes || null]
        );

        await logAudit(pool, {
            actorRole: 'portal_patient',
            entityType: 'appointment',
            entityId: result.rows[0].id,
            patientId: req.portalPatient.patient_id,
            action: 'portal.book_appointment',
            afterData: result.rows[0],
            metadata: { source: 'patient_portal' },
        });

        res.status(201).json({
            message: 'Your appointment request has been sent!',
            appointment: result.rows[0],
        });
    } catch (err) {
        logger.error('Failed to submit portal appointment request', err, { patientId: req.portalPatient.patient_id });
        res.status(500).json({ error: 'Failed to submit appointment request' });
    }
});

router.put('/profile', verifyPortalPatient, async (req, res) => {
    const patientId = req.portalPatient.patient_id;
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const address = String(req.body.address || '').trim();
    const emergencyContactName = String(req.body.emergency_contact_name || '').trim();
    const emergencyContactPhone = normalizePhone(req.body.emergency_contact_phone);

    if (!email) return res.status(400).json({ error: 'Email is required.' });
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const db = await pool.connect();
    try {
        await db.query('BEGIN');
        const beforeDetail = await getPortalPatientDetail(db, patientId);
        const conflict = await db.query(
            `SELECT id FROM patients
             WHERE LOWER(portal_email) = LOWER($1)
               AND id != $2
               AND portal_email IS NOT NULL
             LIMIT 1`,
            [email, patientId]
        );
        if (conflict.rows.length > 0) {
            await db.query('ROLLBACK');
            return res.status(409).json({ error: 'Another portal account already uses that email.' });
        }

        await db.query(
            `UPDATE patients
             SET portal_email = $1,
                 email = $1,
                 phone = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [email, phone, patientId]
        );
        await upsertPortalContact(db, patientId, {
            email,
            phone,
            address,
            emergency_contact_name: emergencyContactName,
            emergency_contact_phone: emergencyContactPhone,
        });

        const afterDetail = await getPortalPatientDetail(db, patientId);
        await logAudit(db, {
            actorRole: 'portal_patient',
            entityType: 'patient',
            entityId: patientId,
            patientId,
            action: 'portal.profile_update',
            beforeData: beforeDetail,
            afterData: afterDetail,
            metadata: { source: 'patient_portal' },
        });

        await db.query('COMMIT');
        res.json(portalPatientPayload(afterDetail));
    } catch (err) {
        await db.query('ROLLBACK');
        logger.error('Failed to update portal profile', err, { patientId });
        res.status(500).json({ error: 'Failed to update profile' });
    } finally {
        db.release();
    }
});

module.exports = router;
