const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const logger = require('./utils/logger');
const { getJwtSecret } = require('./utils/jwt');

const app = express();
app.set('trust proxy', 1);
const BODY_LIMIT = '200mb';

app.use(helmet({ contentSecurityPolicy: false }));

const normalizeOrigin = (origin) => origin.replace(/\/$/, '');
const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL,
].filter(Boolean).map(normalizeOrigin));

const isSameOriginRequest = (origin, req) => {
    try {
        const requestHost = req.get('host');
        if (!requestHost) return false;

        const originUrl = new URL(origin);
        const requestProtocol = req.get('x-forwarded-proto') || req.protocol;
        return originUrl.host === requestHost && originUrl.protocol === `${requestProtocol}:`;
    } catch {
        return false;
    }
};

app.use(cors((req, callback) => {
    const origin = req.header('Origin');
    if (!origin) {
        callback(null, { origin: true, credentials: true });
        return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.has(normalizedOrigin) || isSameOriginRequest(normalizedOrigin, req)) {
        callback(null, { origin: true, credentials: true });
        return;
    }

    callback(new Error('Not allowed by CORS'));
}));

app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const dentalChartRoutes = require('./routes/dentalChart');
const visitsRoutes = require('./routes/visits');
const medicalHistoryRoutes = require('./routes/medicalHistory');
const dashboardRoutes = require('./routes/dashboard');
const orthodonticsRoutes = require('./routes/orthodontics');
const settingsRoutes = require('./routes/settings');
const photosRoutes = require('./routes/photos');
const appointmentsRoutes = require('./routes/appointments');
const intakeRoutes = require('./routes/intake');
const appointmentFormRoutes = require('./routes/appointmentForm');
const kioskRoutes = require('./routes/kiosk');
const portalRoutes = require('./routes/portal');
const visitsRouter = require('./routes/visits');

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients/:id/dental-chart', dentalChartRoutes);
app.use('/api/patients/:id/visits', visitsRoutes);
app.use('/api/patients/:id/medical-history', medicalHistoryRoutes);
app.use('/api/patients/:id/orthodontics', orthodonticsRoutes);
app.use('/api/patients/:id/photos', photosRoutes);
app.use('/api/visits', visitsRouter);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/intake', intakeRoutes);
app.use('/api/appointment-form', appointmentFormRoutes);
app.use('/api/kiosk', kioskRoutes);
app.use('/api/portal', portalRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

const clientDistPath = path.resolve(__dirname, '../client/dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientIndexPath)) {
    app.use(express.static(clientDistPath));

    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
            next();
            return;
        }

        res.sendFile(clientIndexPath);
    });
}

app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({
            error: 'Uploaded backup is too large for the current server limit.',
        });
    }

    logger.error('Unhandled Express error', err, {
        method: req.method,
        path: req.originalUrl,
    });
    res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;

if (require.main === module) {
    try {
        getJwtSecret();
    } catch (err) {
        logger.error('Server startup blocked by invalid JWT configuration', err);
        process.exit(1);
    }

    app.listen(PORT, () => {
        logger.info(`Dental Clinic API running on http://localhost:${PORT}`);
    });
}

module.exports = app;
