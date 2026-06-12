const { hasPermission } = require('../utils/permissions');

function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.admin || !hasPermission(req.admin.role, permission)) {
            return res.status(403).json({ error: `${permission} permission required` });
        }
        next();
    };
}

module.exports = { requirePermission };
