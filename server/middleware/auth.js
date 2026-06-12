const { verifyAdminToken } = require('../utils/jwt');
const logger = require('../utils/logger');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyAdminToken(token);
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
