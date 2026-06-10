const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

// Rate limiting store (simple in-memory)
const loginAttempts = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip) {
    const now = Date.now();
    const record = loginAttempts.get(ip);
    if (!record || now - record.resetAt > RATE_WINDOW) {
        loginAttempts.set(ip, { count: 1, resetAt: now });
        return true;
    }
    if (record.count >= RATE_LIMIT) return false;
    record.count++;
    return true;
}

// POST /api/auth/login
router.post('/login',
    body('username').trim().notEmpty(),
    body('password').notEmpty(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const ip = req.ip;
        if (!checkRateLimit(ip)) {
            return res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });
        }

        try {
            const { username, password } = req.body;
            const result = await pool.query(
                'SELECT * FROM admins WHERE username = $1 AND is_active = true',
                [username]
            );
            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            const admin = result.rows[0];
            const valid = await bcrypt.compare(password, admin.password_hash);
            if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

            // Update last login
            await pool.query('UPDATE admins SET last_login = NOW() WHERE id = $1', [admin.id]);

            const token = jwt.sign(
                { id: admin.id, username: admin.username, role: admin.role, full_name: admin.full_name },
                process.env.JWT_SECRET || 'dental_secret_key',
                { expiresIn: '24h' }
            );

            res.json({
                token,
                admin: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    full_name: admin.full_name,
                    role: admin.role,
                }
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    }
);

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, full_name, role, profile_photo, created_at, last_login FROM admins WHERE id = $1',
            [req.admin.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/auth/change-password
router.put('/change-password', verifyToken,
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 6 }),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const { currentPassword, newPassword } = req.body;
        try {
            const result = await pool.query('SELECT password_hash FROM admins WHERE id = $1', [req.admin.id]);
            if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });

            const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
            if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

            const newHash = await bcrypt.hash(newPassword, 10);
            await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [newHash, req.admin.id]);
            res.json({ message: 'Password changed successfully' });
        } catch (err) {
            res.status(500).json({ error: 'Server error' });
        }
    }
);

module.exports = router;
