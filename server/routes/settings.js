const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

// All routes require authentication
router.use(verifyToken);

// Middleware: admin-only
function requireAdmin(req, res, next) {
    if (req.admin.role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required' });
    }
    next();
}

// ─── Profile ──────────────────────────────────────────────────────────────────

// GET /api/settings/profile
router.get('/profile', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, full_name, role, profile_photo, created_at, last_login FROM admins WHERE id = $1',
            [req.admin.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/settings/profile/photo
router.post('/profile/photo', async (req, res) => {
    try {
        // Ensure column exists (safe for existing DBs)
        await pool.query('ALTER TABLE admins ADD COLUMN IF NOT EXISTS profile_photo TEXT');

        const { photo_data } = req.body;
        if (!photo_data || !photo_data.startsWith('data:image/')) {
            return res.status(400).json({ error: 'Invalid image data' });
        }
        // Rough size guard: base64 of 2MB image ≈ 2.7MB string
        if (photo_data.length > 3 * 1024 * 1024) {
            return res.status(413).json({ error: 'Image too large. Please use an image under 2 MB.' });
        }

        const result = await pool.query(
            'UPDATE admins SET profile_photo = $1 WHERE id = $2 RETURNING id, profile_photo',
            [photo_data, req.admin.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/settings/profile/photo
router.delete('/profile/photo', async (req, res) => {
    try {
        await pool.query('UPDATE admins SET profile_photo = NULL WHERE id = $1', [req.admin.id]);
        res.json({ message: 'Photo removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/settings/profile
router.put('/profile',
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { full_name, email, username } = req.body;
        try {
            // Check username/email uniqueness (excluding self)
            const conflict = await pool.query(
                'SELECT id FROM admins WHERE (username = $1 OR email = $2) AND id != $3',
                [username, email, req.admin.id]
            );
            if (conflict.rows.length > 0) {
                return res.status(409).json({ error: 'Username or email already in use' });
            }

            const result = await pool.query(
                `UPDATE admins
                 SET full_name = $1, email = $2, username = $3
                 WHERE id = $4
                 RETURNING id, username, email, full_name, role`,
                [full_name, email, username, req.admin.id]
            );
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// ─── Clinic Settings ──────────────────────────────────────────────────────────

// GET /api/settings/clinic
router.get('/clinic', async (req, res) => {
    try {
        let result = await pool.query('SELECT * FROM clinic_settings LIMIT 1');
        if (result.rows.length === 0) {
            // Insert default row on first access
            result = await pool.query(
                `INSERT INTO clinic_settings (clinic_name) VALUES ('Dental Clinic') RETURNING *`
            );
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/settings/clinic
router.put('/clinic',
    body('clinic_name').trim().notEmpty().withMessage('Clinic name is required'),
    body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { clinic_name, address, phone, email, website } = req.body;
        try {
            // Ensure a row exists
            const existing = await pool.query('SELECT id FROM clinic_settings LIMIT 1');
            let result;
            if (existing.rows.length === 0) {
                result = await pool.query(
                    `INSERT INTO clinic_settings (clinic_name, address, phone, email, website, updated_at)
                     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
                    [clinic_name, address || null, phone || null, email || null, website || null]
                );
            } else {
                result = await pool.query(
                    `UPDATE clinic_settings
                     SET clinic_name = $1, address = $2, phone = $3, email = $4, website = $5, updated_at = NOW()
                     WHERE id = $6 RETURNING *`,
                    [clinic_name, address || null, phone || null, email || null, website || null, existing.rows[0].id]
                );
            }
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// ─── User Management ──────────────────────────────────────────────────────────

// GET /api/settings/users (admin-only)
router.get('/users', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, username, email, full_name, role, is_active, created_at, last_login
             FROM admins ORDER BY created_at ASC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/settings/users (admin-only)
router.post('/users', requireAdmin,
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['admin', 'dentist', 'hygienist', 'receptionist']).withMessage('Invalid role'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { full_name, username, email, password, role } = req.body;
        try {
            const conflict = await pool.query(
                'SELECT id FROM admins WHERE username = $1 OR email = $2',
                [username, email]
            );
            if (conflict.rows.length > 0) {
                return res.status(409).json({ error: 'Username or email already in use' });
            }

            const password_hash = await bcrypt.hash(password, 10);
            const result = await pool.query(
                `INSERT INTO admins (full_name, username, email, password_hash, role)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, username, email, full_name, role, is_active, created_at`,
                [full_name, username, email, password_hash, role]
            );
            res.status(201).json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// PUT /api/settings/users/:id (admin-only)
router.put('/users/:id', requireAdmin,
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('role').isIn(['admin', 'dentist', 'hygienist', 'receptionist']).withMessage('Invalid role'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { id } = req.params;
        const { full_name, email, role } = req.body;
        try {
            // Prevent admin from changing their own role
            const query = req.admin.id === id
                ? `UPDATE admins SET full_name = $1, email = $2 WHERE id = $3 RETURNING id, username, email, full_name, role, is_active`
                : `UPDATE admins SET full_name = $1, email = $2, role = $3 WHERE id = $4 RETURNING id, username, email, full_name, role, is_active`;
            const params = req.admin.id === id
                ? [full_name, email, id]
                : [full_name, email, role, id];

            // Check email uniqueness
            const conflict = await pool.query(
                'SELECT id FROM admins WHERE email = $1 AND id != $2',
                [email, id]
            );
            if (conflict.rows.length > 0) {
                return res.status(409).json({ error: 'Email already in use' });
            }

            const result = await pool.query(query, params);
            if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// PATCH /api/settings/users/:id/status (admin-only)
router.patch('/users/:id/status', requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (id === req.admin.id) {
        return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }
    try {
        const result = await pool.query(
            `UPDATE admins SET is_active = NOT is_active WHERE id = $1
             RETURNING id, is_active`,
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── Intake Form Settings ─────────────────────────────────────────────────────

function generateSlug() {
    return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
}

// GET /api/settings/intake
router.get('/intake', async (req, res) => {
    try {
        let result = await pool.query(
            'SELECT id, intake_enabled, intake_slug, intake_redirect_url FROM clinic_settings LIMIT 1'
        );
        // Auto-create row if none exists
        if (result.rows.length === 0) {
            const slug = generateSlug();
            result = await pool.query(
                `INSERT INTO clinic_settings (clinic_name, intake_enabled, intake_slug)
                 VALUES ('Dental Clinic', true, $1) RETURNING id, intake_enabled, intake_slug, intake_redirect_url`,
                [slug]
            );
        }
        const row = result.rows[0];
        // Auto-generate slug if never set
        if (!row.intake_slug) {
            const slug = generateSlug();
            await pool.query('UPDATE clinic_settings SET intake_slug = $1 WHERE id = $2', [slug, row.id]);
            row.intake_slug = slug;
        }
        res.json({
            intake_enabled: row.intake_enabled ?? true,
            intake_slug: row.intake_slug,
            intake_redirect_url: row.intake_redirect_url || '',
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/settings/intake
router.put('/intake', async (req, res) => {
    const { intake_enabled, intake_slug, intake_redirect_url } = req.body;
    if (!intake_slug || !/^[a-zA-Z0-9_-]{3,50}$/.test(intake_slug.trim())) {
        return res.status(400).json({ error: 'Slug must be 3–50 characters: letters, numbers, hyphens, underscores only' });
    }
    try {
        const existing = await pool.query('SELECT id FROM clinic_settings LIMIT 1');
        let result;
        if (existing.rows.length === 0) {
            result = await pool.query(
                `INSERT INTO clinic_settings (clinic_name, intake_enabled, intake_slug, intake_redirect_url)
                 VALUES ('Dental Clinic', $1, $2, $3)
                 RETURNING intake_enabled, intake_slug, intake_redirect_url`,
                [intake_enabled !== false, intake_slug.trim(), intake_redirect_url || null]
            );
        } else {
            result = await pool.query(
                `UPDATE clinic_settings
                 SET intake_enabled = $1, intake_slug = $2, intake_redirect_url = $3, updated_at = NOW()
                 WHERE id = $4
                 RETURNING intake_enabled, intake_slug, intake_redirect_url`,
                [intake_enabled !== false, intake_slug.trim(), intake_redirect_url || null, existing.rows[0].id]
            );
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── Appointment Form Settings ────────────────────────────────────────────────

// GET /api/settings/appt-form
router.get('/appt-form', async (req, res) => {
    try {
        let result = await pool.query(
            'SELECT id, appt_form_enabled, appt_form_slug, appt_form_redirect_url FROM clinic_settings LIMIT 1'
        );
        if (result.rows.length === 0) {
            const slug = generateSlug();
            result = await pool.query(
                `INSERT INTO clinic_settings (clinic_name, appt_form_enabled, appt_form_slug)
                 VALUES ('Dental Clinic', true, $1)
                 RETURNING id, appt_form_enabled, appt_form_slug, appt_form_redirect_url`,
                [slug]
            );
        }
        const row = result.rows[0];
        if (!row.appt_form_slug) {
            const slug = generateSlug();
            await pool.query('UPDATE clinic_settings SET appt_form_slug = $1 WHERE id = $2', [slug, row.id]);
            row.appt_form_slug = slug;
        }
        res.json({
            appt_form_enabled: row.appt_form_enabled ?? true,
            appt_form_slug: row.appt_form_slug,
            appt_form_redirect_url: row.appt_form_redirect_url || '',
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/settings/appt-form
router.put('/appt-form', async (req, res) => {
    const { appt_form_enabled, appt_form_slug, appt_form_redirect_url } = req.body;
    if (!appt_form_slug || !/^[a-zA-Z0-9_-]{3,50}$/.test(appt_form_slug.trim())) {
        return res.status(400).json({ error: 'Slug must be 3–50 characters: letters, numbers, hyphens, underscores only' });
    }
    try {
        const existing = await pool.query('SELECT id FROM clinic_settings LIMIT 1');
        let result;
        if (existing.rows.length === 0) {
            result = await pool.query(
                `INSERT INTO clinic_settings (clinic_name, appt_form_enabled, appt_form_slug, appt_form_redirect_url)
                 VALUES ('Dental Clinic', $1, $2, $3)
                 RETURNING appt_form_enabled, appt_form_slug, appt_form_redirect_url`,
                [appt_form_enabled !== false, appt_form_slug.trim(), appt_form_redirect_url || null]
            );
        } else {
            result = await pool.query(
                `UPDATE clinic_settings
                 SET appt_form_enabled = $1, appt_form_slug = $2, appt_form_redirect_url = $3, updated_at = NOW()
                 WHERE id = $4
                 RETURNING appt_form_enabled, appt_form_slug, appt_form_redirect_url`,
                [appt_form_enabled !== false, appt_form_slug.trim(), appt_form_redirect_url || null, existing.rows[0].id]
            );
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/settings/appt-form/regenerate
router.post('/appt-form/regenerate', async (req, res) => {
    const slug = generateSlug();
    try {
        const existing = await pool.query('SELECT id FROM clinic_settings LIMIT 1');
        if (existing.rows.length === 0) {
            await pool.query(`INSERT INTO clinic_settings (clinic_name, appt_form_slug) VALUES ('Dental Clinic', $1)`, [slug]);
        } else {
            await pool.query('UPDATE clinic_settings SET appt_form_slug = $1, updated_at = NOW() WHERE id = $2', [slug, existing.rows[0].id]);
        }
        res.json({ appt_form_slug: slug });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ─── Clinic Kiosk ─────────────────────────────────────────────────────────────

// GET /api/settings/kiosk (admin-only)
router.get('/kiosk', requireAdmin, async (req, res) => {
    try {
        // Ensure column exists — production DB may not have had schema.sql re-run
        await pool.query('ALTER TABLE clinic_settings ADD COLUMN IF NOT EXISTS kiosk_token VARCHAR(64)');

        let result = await pool.query('SELECT id, kiosk_token FROM clinic_settings LIMIT 1');
        if (result.rows.length === 0) {
            result = await pool.query(
                `INSERT INTO clinic_settings (clinic_name) VALUES ('Dental Clinic') RETURNING id, kiosk_token`
            );
        }
        const row = result.rows[0];
        if (!row.kiosk_token) {
            const token = generateSlug() + generateSlug() + generateSlug();
            await pool.query('UPDATE clinic_settings SET kiosk_token = $1 WHERE id = $2', [token, row.id]);
            return res.json({ kiosk_token: token });
        }
        res.json({ kiosk_token: row.kiosk_token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/settings/kiosk/regenerate (admin-only)
router.post('/kiosk/regenerate', requireAdmin, async (req, res) => {
    const token = generateSlug() + generateSlug() + generateSlug();
    try {
        const existing = await pool.query('SELECT id FROM clinic_settings LIMIT 1');
        if (existing.rows.length === 0) {
            await pool.query(`INSERT INTO clinic_settings (clinic_name, kiosk_token) VALUES ('Dental Clinic', $1)`, [token]);
        } else {
            await pool.query('UPDATE clinic_settings SET kiosk_token = $1, updated_at = NOW() WHERE id = $2', [token, existing.rows[0].id]);
        }
        res.json({ kiosk_token: token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/settings/intake/regenerate
router.post('/intake/regenerate', async (req, res) => {
    const slug = generateSlug();
    try {
        const existing = await pool.query('SELECT id FROM clinic_settings LIMIT 1');
        if (existing.rows.length === 0) {
            await pool.query(
                `INSERT INTO clinic_settings (clinic_name, intake_slug) VALUES ('Dental Clinic', $1)`,
                [slug]
            );
        } else {
            await pool.query(
                'UPDATE clinic_settings SET intake_slug = $1, updated_at = NOW() WHERE id = $2',
                [slug, existing.rows[0].id]
            );
        }
        res.json({ intake_slug: slug });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
