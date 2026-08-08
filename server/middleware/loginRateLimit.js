const DEFAULT_LIMIT = 5;
const DEFAULT_WINDOW_MS = 60 * 1000;

function createLoginRateLimiter({ limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS } = {}) {
    const attempts = new Map();

    setInterval(() => {
        const now = Date.now();
        for (const [ip, record] of attempts) {
            if (now - record.resetAt > windowMs) attempts.delete(ip);
        }
    }, windowMs).unref();

    return function loginRateLimit(req, res, next) {
        const ip = req.ip;
        const now = Date.now();
        const record = attempts.get(ip);

        if (!record || now - record.resetAt > windowMs) {
            attempts.set(ip, { count: 1, resetAt: now });
            return next();
        }
        if (record.count >= limit) {
            return res.status(429).json({ error: 'Too many login attempts. Please wait a minute.' });
        }
        record.count++;
        next();
    };
}

module.exports = { createLoginRateLimiter };
