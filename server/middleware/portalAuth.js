const { verifyPortalToken } = require('../utils/jwt');

function verifyPortalPatient(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No portal token provided' });
    }

    try {
        const token = authHeader.split(' ')[1];
        req.portalPatient = verifyPortalToken(token);
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired portal token' });
    }
}

module.exports = { verifyPortalPatient };
