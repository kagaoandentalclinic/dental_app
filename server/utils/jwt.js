const jwt = require('jsonwebtoken');

const DEFAULT_INSECURE_SECRET = 'dental_secret_key';
const JWT_EXPIRES_IN = '30d';
const PORTAL_JWT_EXPIRES_IN = '30d';

function getJwtSecret() {
    const secret = process.env.JWT_SECRET && process.env.JWT_SECRET.trim();
    if (!secret || secret === DEFAULT_INSECURE_SECRET) {
        throw new Error('JWT_SECRET must be set to a strong non-default value.');
    }
    return secret;
}

function signAdminToken(payload) {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

function verifyAdminToken(token) {
    return jwt.verify(token, getJwtSecret());
}

function signPortalToken(payload) {
    return jwt.sign({ ...payload, token_type: 'portal_patient' }, getJwtSecret(), { expiresIn: PORTAL_JWT_EXPIRES_IN });
}

function verifyPortalToken(token) {
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.token_type !== 'portal_patient') {
        throw new Error('Invalid portal token');
    }
    return decoded;
}

module.exports = {
    DEFAULT_INSECURE_SECRET,
    JWT_EXPIRES_IN,
    PORTAL_JWT_EXPIRES_IN,
    getJwtSecret,
    signAdminToken,
    verifyAdminToken,
    signPortalToken,
    verifyPortalToken,
};
