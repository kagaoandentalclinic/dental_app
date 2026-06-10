require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const app = express();
app.set('trust proxy', 1); // Required for correct IP detection behind Railway's proxy

// ─── Middleware ───────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.CLIENT_URL,
].filter(Boolean).map(o => o.replace(/\/$/, ''));

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Routes ──────────────────────────────────────
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

app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/patients/:id/dental-chart', dentalChartRoutes);
app.use('/api/patients/:id/visits', visitsRoutes);
app.use('/api/patients/:id/medical-history', medicalHistoryRoutes);
app.use('/api/patients/:id/orthodontics', orthodonticsRoutes);
app.use('/api/patients/:id/photos', photosRoutes);
// Standalone visit update/delete
const visitsRouter = require('./routes/visits');
app.use('/api/visits', visitsRouter);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/intake', intakeRoutes);
app.use('/api/appointment-form', appointmentFormRoutes);
app.use('/api/kiosk', kioskRoutes);

// ─── Health check ─────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

// ─── Global error handler ─────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🦷 Dental Clinic API running on http://localhost:${PORT}`);
});
