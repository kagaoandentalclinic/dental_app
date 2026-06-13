const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';

const pool = require('../db/pool');
const patientsRouter = require('../routes/patients');
const appointmentsRouter = require('../routes/appointments');
const settingsRouter = require('../routes/settings');
const portalRouter = require('../routes/portal');

function getRouteHandlers(router, method, path) {
    const layer = router.stack.find(entry =>
        entry.route
        && entry.route.path === path
        && entry.route.methods[method]
    );
    if (!layer) {
        throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
    }
    return layer.route.stack.map(routeLayer => routeLayer.handle);
}

async function runRouteHandlers(handlers, reqOverrides = {}) {
    const req = {
        headers: {},
        params: {},
        query: {},
        body: {},
        ip: '127.0.0.1',
        originalUrl: '/',
        ...reqOverrides,
    };
    const res = {
        statusCode: 200,
        payload: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.payload = body;
            return this;
        },
        send(body) {
            this.payload = body;
            return this;
        },
    };

    let index = 0;
    const next = async (err) => {
        if (err) throw err;
        const handler = handlers[index++];
        if (!handler) return;
        await handler(req, res, next);
    };

    await next();
    return { req, res };
}

test.after(async () => {
    await pool.end();
});

test('patients API requires authentication', async () => {
    const handlers = getRouteHandlers(patientsRouter, 'get', '/');
    const { res } = await runRouteHandlers(handlers, {
        originalUrl: '/api/patients?page=1',
        query: { page: '1' },
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, { error: 'No token provided' });
});

test('appointments API requires authentication', async () => {
    const handlers = getRouteHandlers(appointmentsRouter, 'get', '/');
    const { res } = await runRouteHandlers(handlers, {
        originalUrl: '/api/appointments?start=2026-06-12&end=2026-06-13',
        query: { start: '2026-06-12', end: '2026-06-13' },
    });
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.payload, { error: 'No token provided' });
});

test('permissions endpoint returns the current role matrix', async () => {
    const handlers = getRouteHandlers(settingsRouter, 'get', '/permissions');
    const { res } = await runRouteHandlers(handlers, {
        admin: { role: 'dentist' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.role, 'dentist');
    assert.equal(res.payload.permissions.includes('manage_patients'), true);
    assert.equal(res.payload.permissions.includes('manage_backups'), false);
});

test('backup export is restricted to roles with backup permission', async () => {
    const handlers = getRouteHandlers(settingsRouter, 'get', '/backup');
    const { res } = await runRouteHandlers(handlers, {
        admin: { role: 'dentist' },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, { error: 'manage_backups permission required' });
});

test('backup restore is restricted to roles with backup permission', async () => {
    const handlers = getRouteHandlers(settingsRouter, 'post', '/backup/restore');
    const { res } = await runRouteHandlers(handlers, {
        admin: { role: 'receptionist' },
        body: { backup: {} },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, { error: 'manage_backups permission required' });
});

test('audit logs are restricted to roles with audit permission', async () => {
    const handlers = getRouteHandlers(settingsRouter, 'get', '/audit-logs');
    const { res } = await runRouteHandlers(handlers, {
        admin: { role: 'hygienist' },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, { error: 'view_audit_logs permission required' });
});

test('public form management is restricted to roles with that permission', async () => {
    const handlers = getRouteHandlers(settingsRouter, 'post', '/intake/regenerate');
    const { res } = await runRouteHandlers(handlers, {
        admin: { role: 'dentist' },
    });
    assert.equal(res.statusCode, 403);
    assert.deepEqual(res.payload, { error: 'manage_public_forms permission required' });
});

test('portal email verification requires a token', async () => {
    const handlers = getRouteHandlers(portalRouter, 'post', '/verify-email');
    const { res } = await runRouteHandlers(handlers, {
        body: { token: '' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(Array.isArray(res.payload.errors), true);
});

test('portal password reset request requires an email', async () => {
    const handlers = getRouteHandlers(portalRouter, 'post', '/request-password-reset');
    const { res } = await runRouteHandlers(handlers, {
        body: { email: '' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(Array.isArray(res.payload.errors), true);
});

test('portal password reset route is registered', async () => {
    const handlers = getRouteHandlers(portalRouter, 'post', '/reset-password');
    assert.equal(Array.isArray(handlers), true);
    assert.equal(handlers.length > 0, true);
});

test('portal booked times route is registered', async () => {
    const handlers = getRouteHandlers(portalRouter, 'get', '/booked-times');
    assert.equal(Array.isArray(handlers), true);
    assert.equal(handlers.length > 0, true);
});

test('portal booking route is registered', async () => {
    const handlers = getRouteHandlers(portalRouter, 'post', '/book');
    assert.equal(Array.isArray(handlers), true);
    assert.equal(handlers.length > 0, true);
});

test('portal booking blocks Sunday dates before auth-sensitive work', async () => {
    const handlers = getRouteHandlers(portalRouter, 'post', '/book');
    const validationAndHandler = handlers.slice(1);
    const { res } = await runRouteHandlers(validationAndHandler, {
        body: {
            preferred_date: '2026-06-14',
            preferred_time: '09:00',
            service: 'Checkup',
        },
    });
    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.payload, { error: 'Sunday bookings are unavailable. Please choose Monday to Saturday.' });
});

test('portal Google auth returns a configuration error when client id is missing', async () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    try {
        const handlers = getRouteHandlers(portalRouter, 'post', '/google');
        const { res } = await runRouteHandlers(handlers, {
            body: { credential: 'fake-id-token' },
        });
        assert.equal(res.statusCode, 503);
        assert.deepEqual(res.payload, { error: 'Google sign-in is not configured.' });
    } finally {
        if (previousClientId) {
            process.env.GOOGLE_CLIENT_ID = previousClientId;
        }
    }
});
