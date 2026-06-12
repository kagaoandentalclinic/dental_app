const logger = require('./logger');

async function verifyGoogleIdToken(credential) {
    const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
        const error = new Error('Google sign-in is not configured.');
        error.statusCode = 503;
        throw error;
    }

    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!response.ok) {
        const error = new Error('Google sign-in could not be verified.');
        error.statusCode = 401;
        throw error;
    }

    const payload = await response.json();
    if (payload.aud !== clientId) {
        const error = new Error('Google sign-in client mismatch.');
        error.statusCode = 401;
        throw error;
    }

    if (String(payload.email_verified).toLowerCase() !== 'true') {
        const error = new Error('Your Google account email is not verified.');
        error.statusCode = 401;
        throw error;
    }

    if (!payload.email || !payload.sub) {
        logger.warn('Google token missing expected profile fields', { payload });
        const error = new Error('Google sign-in response is incomplete.');
        error.statusCode = 401;
        throw error;
    }

    return {
        email: String(payload.email).trim().toLowerCase(),
        sub: String(payload.sub),
        firstName: String(payload.given_name || '').trim(),
        lastName: String(payload.family_name || '').trim(),
        fullName: String(payload.name || '').trim(),
    };
}

module.exports = {
    verifyGoogleIdToken,
};
