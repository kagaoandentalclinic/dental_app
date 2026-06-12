'use strict';
const rateLimit = require('express-rate-limit');

// Rate limiter: 15 submissions per IP per 1 hour (backstop against bots)
// Per-person limiting is handled by device fingerprint (5/device/hr) + name+DOB cooldown
const publicFormLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many submissions from this network. Please wait and try again.' },
});

// ── In-memory stores ──────────────────────────────────────────────────────────

// name+DOB+IP cooldown: same identity blocked 60 min after success
const recentSubmissions = new Map();
const COOLDOWN_MS = 60 * 60 * 1000;

// device fingerprint: max 5 submissions per device per hour
const deviceSubmissions = new Map();
const DEVICE_LIMIT = 5;
const DEVICE_WINDOW_MS = 60 * 60 * 1000;

// Prune stale entries periodically to prevent memory growth
const pruneTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of recentSubmissions) {
        if (now - ts > COOLDOWN_MS) recentSubmissions.delete(key);
    }
    for (const [key, times] of deviceSubmissions) {
        const fresh = times.filter(t => now - t < DEVICE_WINDOW_MS);
        if (fresh.length === 0) deviceSubmissions.delete(key);
        else deviceSubmissions.set(key, fresh);
    }
}, 15 * 60 * 1000);
pruneTimer.unref?.();

// ── Middleware ────────────────────────────────────────────────────────────────

// Reject if the hidden fax field is filled — bots do this, humans never see it
function checkHoneypot(req, res, next) {
    if (req.body.fax && req.body.fax.trim() !== '') {
        return res.status(400).json({ ok: true }); // silent fake-success to confuse bots
    }
    next();
}

// Reject if form was submitted in under 4 seconds — bots submit instantly
function checkTiming(req, res, next) {
    const elapsed = parseInt(req.body._t, 10);
    if (!elapsed || isNaN(elapsed) || elapsed < 4000) {
        return res.status(400).json({ ok: true }); // silent fake-success
    }
    next();
}

// Block the same name+DOB+IP from resubmitting within 60 minutes
function checkDuplicateCooldown(req, res, next) {
    const ip = req.ip || 'unknown';
    const key = [
        ip,
        (req.body.last_name || '').toLowerCase().trim(),
        (req.body.first_name || '').toLowerCase().trim(),
        req.body.date_of_birth || '',
    ].join('|');

    const lastSeen = recentSubmissions.get(key);
    if (lastSeen && Date.now() - lastSeen < COOLDOWN_MS) {
        const remainingMin = Math.ceil((COOLDOWN_MS - (Date.now() - lastSeen)) / 60000);
        return res.status(429).json({
            error: `You already submitted recently. Please wait ${remainingMin} more minute(s) before trying again.`,
        });
    }
    // Route handlers call this after a confirmed successful DB write
    res.locals.recordSpamKey = () => recentSubmissions.set(key, Date.now());
    next();
}

// Block a device that has submitted more than DEVICE_LIMIT times in the past hour.
// The device ID is a UUID generated and stored in the browser's localStorage —
// it persists across page loads and survives name/DOB changes.
function checkDeviceId(req, res, next) {
    const did = (req.body._did || '').toString().slice(0, 128).trim();
    if (!did) return next(); // no device ID sent — IP limiter is the backstop

    const now = Date.now();
    const times = (deviceSubmissions.get(did) || []).filter(t => now - t < DEVICE_WINDOW_MS);

    if (times.length >= DEVICE_LIMIT) {
        return res.status(429).json({
            error: 'Too many submissions from this device. Please wait before trying again.',
        });
    }

    times.push(now);
    deviceSubmissions.set(did, times);
    next();
}

module.exports = { publicFormLimiter, checkHoneypot, checkTiming, checkDuplicateCooldown, checkDeviceId };
