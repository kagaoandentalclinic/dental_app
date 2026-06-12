const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_INSECURE_SECRET,
    getJwtSecret,
    signAdminToken,
    verifyAdminToken,
} = require('../utils/jwt');
const { verifyToken } = require('../middleware/auth');

function withJwtSecret(secret, fn) {
    const previous = process.env.JWT_SECRET;
    if (secret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = secret;
    }

    try {
        return fn();
    } finally {
        if (previous === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = previous;
        }
    }
}

test('JWT secret must be configured and not use the insecure default', () => {
    assert.throws(
        () => withJwtSecret(undefined, () => getJwtSecret()),
        /JWT_SECRET must be set/
    );
    assert.throws(
        () => withJwtSecret(DEFAULT_INSECURE_SECRET, () => getJwtSecret()),
        /JWT_SECRET must be set/
    );
});

test('admin tokens round-trip with the configured secret', () => {
    withJwtSecret('super-secure-test-secret', () => {
        const token = signAdminToken({
            id: 'admin-1',
            username: 'admin',
            role: 'admin',
            full_name: 'System Administrator',
        });

        const decoded = verifyAdminToken(token);
        assert.equal(decoded.id, 'admin-1');
        assert.equal(decoded.username, 'admin');
        assert.equal(decoded.role, 'admin');
    });
});

test('auth middleware attaches the decoded admin payload', () => {
    withJwtSecret('super-secure-test-secret', () => {
        const token = signAdminToken({
            id: 'admin-2',
            username: 'mikael',
            role: 'admin',
            full_name: 'Mikael Admin',
        });

        const req = {
            headers: { authorization: `Bearer ${token}` },
            originalUrl: '/api/auth/me',
            ip: '127.0.0.1',
        };
        const res = {
            statusCode: null,
            payload: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                this.payload = body;
                return this;
            },
        };
        let nextCalled = false;

        verifyToken(req, res, () => {
            nextCalled = true;
        });

        assert.equal(nextCalled, true);
        assert.equal(req.admin.username, 'mikael');
        assert.equal(res.statusCode, null);
    });
});

test('auth middleware rejects malformed bearer tokens', () => {
    withJwtSecret('super-secure-test-secret', () => {
        const req = {
            headers: { authorization: 'Bearer bad.token.value' },
            originalUrl: '/api/auth/me',
            ip: '127.0.0.1',
        };
        const res = {
            statusCode: null,
            payload: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                this.payload = body;
                return this;
            },
        };

        verifyToken(req, res, () => {
            throw new Error('next should not be called for invalid tokens');
        });

        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.payload, { error: 'Invalid or expired token' });
    });
});
