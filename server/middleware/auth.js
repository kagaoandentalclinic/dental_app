const { verifyAdminToken } = require('../utils/jwt');
const logger = require('../utils/logger');
const pool = require('../db/pool');

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyAdminToken(token);
        const result = await pool.query('SELECT is_active FROM admins WHERE id = $1', [decoded.id]);
        if (result.rows.length === 0 || !result.rows[0].is_active) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.admin = decoded;
        next();
    } catch (err) {
        logger.warn('Rejected invalid or expired token', {
            path: req.originalUrl,
            ip: req.ip,
        });
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = { verifyToken };
