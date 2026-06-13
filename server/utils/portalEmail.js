const nodemailer = require('nodemailer');
const logger = require('./logger');

function getPortalAppUrl() {
    return (
        process.env.PORTAL_APP_URL
        || process.env.CLIENT_URL
        || 'http://localhost:5173'
    ).replace(/\/+$/, '');
}

function getVerificationLink(token) {
    return `${getPortalAppUrl()}/portal?verify=${encodeURIComponent(token)}`;
}

function getPasswordResetLink(token) {
    return `${getPortalAppUrl()}/portal?reset=${encodeURIComponent(token)}`;
}

function hasSmtpConfig() {
    return Boolean(
        process.env.SMTP_HOST
        && process.env.SMTP_PORT
        && process.env.SMTP_FROM
    );
}

let cachedTransporter = null;

function getTransporter() {
    if (!hasSmtpConfig()) return null;
    if (!cachedTransporter) {
        cachedTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
            auth: process.env.SMTP_USER
                ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS || '',
                }
                : undefined,
        });
    }
    return cachedTransporter;
}

async function sendPortalVerificationEmail({ to, firstName, token }) {
    const verificationLink = getVerificationLink(token);
    const transporter = getTransporter();

    if (!transporter) {
        logger.warn('SMTP not configured. Portal verification email logged instead.', {
            email: to,
            verificationLink,
        });
        return {
            mode: 'preview',
            sent: false,
            previewLink: verificationLink,
        };
    }

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject: 'Confirm your Kagaoan Dental Clinic portal account',
            text: [
                `Hi ${firstName || 'Patient'},`,
                '',
                'Please confirm your patient portal account by opening the link below:',
                verificationLink,
                '',
                'If you did not create this account, you can ignore this email.',
            ].join('\n'),
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.6;color:#16362d;max-width:640px;margin:0 auto;padding:24px;">
                    <h2 style="margin:0 0 16px;">Confirm your portal account</h2>
                    <p>Hi ${firstName || 'Patient'},</p>
                    <p>Please confirm your Kagaoan Dental Clinic patient portal account by clicking the button below.</p>
                    <p style="margin:24px 0;">
                        <a href="${verificationLink}" style="display:inline-block;background:#176b56;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">Confirm Email</a>
                    </p>
                    <p>If the button does not work, copy and paste this link into your browser:</p>
                    <p><a href="${verificationLink}" style="color:#176b56;">${verificationLink}</a></p>
                    <p>If you did not create this account, you can ignore this email.</p>
                </div>
            `,
        });
    } catch (err) {
        logger.error('Failed to send portal verification email. Falling back to preview link.', err, {
            email: to,
            verificationLink,
        });
        return {
            mode: 'preview',
            sent: false,
            previewLink: verificationLink,
        };
    }

    return {
        mode: 'email',
        sent: true,
        previewLink: null,
    };
}

async function sendPortalPasswordResetEmail({ to, firstName, token }) {
    const resetLink = getPasswordResetLink(token);
    const transporter = getTransporter();

    if (!transporter) {
        logger.warn('SMTP not configured. Portal password reset email logged instead.', {
            email: to,
            resetLink,
        });
        return {
            mode: 'preview',
            sent: false,
            previewLink: resetLink,
        };
    }

    try {
        await transporter.sendMail({
            from: process.env.SMTP_FROM,
            to,
            subject: 'Reset your Kagaoan Dental Clinic portal password',
            text: [
                `Hi ${firstName || 'Patient'},`,
                '',
                'We received a request to reset your patient portal password.',
                'Open the link below to choose a new password:',
                resetLink,
                '',
                'If you did not request this change, you can ignore this email.',
            ].join('\n'),
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.6;color:#16362d;max-width:640px;margin:0 auto;padding:24px;">
                    <h2 style="margin:0 0 16px;">Reset your portal password</h2>
                    <p>Hi ${firstName || 'Patient'},</p>
                    <p>We received a request to reset your Kagaoan Dental Clinic patient portal password.</p>
                    <p style="margin:24px 0;">
                        <a href="${resetLink}" style="display:inline-block;background:#176b56;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;">Reset Password</a>
                    </p>
                    <p>If the button does not work, copy and paste this link into your browser:</p>
                    <p><a href="${resetLink}" style="color:#176b56;">${resetLink}</a></p>
                    <p>If you did not request this change, you can ignore this email.</p>
                </div>
            `,
        });
    } catch (err) {
        logger.error('Failed to send portal password reset email. Falling back to preview link.', err, {
            email: to,
            resetLink,
        });
        return {
            mode: 'preview',
            sent: false,
            previewLink: resetLink,
        };
    }

    return {
        mode: 'email',
        sent: true,
        previewLink: null,
    };
}

module.exports = {
    getPortalAppUrl,
    getVerificationLink,
    getPasswordResetLink,
    sendPortalVerificationEmail,
    sendPortalPasswordResetEmail,
};
