import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, User, Calendar, Ban, AlertCircle, Stethoscope, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { VISIT_TYPES } from '../utils/constants';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: API_BASE });

function getDeviceId() {
    try {
        let id = localStorage.getItem('_did');
        if (!id) {
            id = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
            localStorage.setItem('_did', id);
        }
        return id;
    } catch {
        return '';
    }
}

const Field = ({ label, required, error, children }) => (
    <div>
        <label className="form-label">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
        {error && <p className="form-error">{error}</p>}
    </div>
);

function StatusScreen({ icon: Icon, iconBg, iconColor, title, subtitle, note }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card text-center py-14 px-6"
        >
            <div className={`w-20 h-20 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-5`}>
                <Icon className={`w-10 h-10 ${iconColor}`} />
            </div>
            <h2 className="font-display text-2xl font-bold text-text-primary mb-2">{title}</h2>
            <p className="text-text-secondary text-base mb-6">{subtitle}</p>
            {note && (
                <div className="inline-flex items-center gap-2 bg-surface text-text-secondary font-medium text-sm px-5 py-3 rounded-xl">
                    {note}
                </div>
            )}
            <p className="text-xs text-text-secondary mt-8">
                © {new Date().getFullYear()} Plaza Maestro Dental Clinic
            </p>
        </motion.div>
    );
}

export default function AppointmentForm() {
    const { slug } = useParams();

    // page states: checking | not_found | disabled | form | success
    const [pageState, setPageState] = useState('checking');
    const [redirectUrl, setRedirectUrl] = useState(null);
    const [patientName, setPatientName] = useState('');
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [formStartTime] = useState(() => Date.now());

    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const [form, setForm] = useState({
        last_name: '',
        first_name: '',
        date_of_birth: '',
        preferred_date: '',
        preferred_time: '09:00',
        appointment_type: 'checkup',
        notes: '',
    });

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    // Validate slug on mount
    useEffect(() => {
        if (!slug) { setPageState('not_found'); return; }
        api.get(`/appointment-form/status/${slug}`)
            .then(res => {
                setRedirectUrl(res.data.redirect_url || null);
                setPageState('form');
            })
            .catch(err => {
                if (err.response?.status === 403) setPageState('disabled');
                else setPageState('not_found');
            });
    }, [slug]);

    // Auto-redirect after success
    useEffect(() => {
        if (pageState === 'success' && redirectUrl) {
            const t = setTimeout(() => { window.location.href = redirectUrl; }, 2500);
            return () => clearTimeout(t);
        }
    }, [pageState, redirectUrl]);

    const validate = () => {
        const errs = {};
        if (!form.last_name.trim()) errs.last_name = 'Last name is required';
        if (!form.first_name.trim()) errs.first_name = 'First name is required';
        if (!form.date_of_birth) errs.date_of_birth = 'Date of birth is required';
        if (!form.preferred_date) errs.preferred_date = 'Preferred date is required';
        if (form.preferred_date < today) errs.preferred_date = 'Please choose a future date';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        setSaving(true);
        setErrors({});
        try {
            const res = await api.post(`/appointment-form/${slug}`, {
                ...form,
                _t: Date.now() - formStartTime,
                _did: getDeviceId(),
                fax: '',
            });
            setPatientName(res.data.patientName || form.first_name);
            setPageState('success');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            const status = err.response?.status;
            const msg = err.response?.data?.error;
            if (status === 404 && err.response?.data?.noMatch) {
                setErrors({ _global: msg });
            } else if (status === 403) {
                setPageState('disabled');
            } else if (status === 404) {
                setPageState('not_found');
            } else {
                setErrors({ _global: msg || 'Something went wrong. Please try again.' });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg">
            {/* Header */}
            <div
                style={{ background: 'linear-gradient(135deg, #051f19 0%, #0a6352 60%, #0d8a6e 100%)' }}
                className="px-4 py-5 text-white shadow-lg sticky top-0 z-10"
            >
                <div className="max-w-2xl mx-auto flex items-center gap-3 sm:gap-4 min-w-0">
                    <img src="/logo.png" alt="Clinic Logo" className="h-10 w-auto object-contain shrink-0" />
                    <p className="text-white/70 text-sm truncate">Appointment Request Form</p>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-6">
                <AnimatePresence mode="wait">

                    {pageState === 'checking' && (
                        <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="flex items-center justify-center py-32">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </motion.div>
                    )}

                    {pageState === 'not_found' && (
                        <motion.div key="not_found" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <StatusScreen
                                icon={AlertCircle} iconBg="bg-gray-100" iconColor="text-gray-400"
                                title="Form Not Found"
                                subtitle="This appointment form link is invalid or no longer available."
                                note="Please contact clinic staff for a valid link."
                            />
                        </motion.div>
                    )}

                    {pageState === 'disabled' && (
                        <motion.div key="disabled" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <StatusScreen
                                icon={Ban} iconBg="bg-amber-50" iconColor="text-amber-500"
                                title="Form Unavailable"
                                subtitle="Online appointment requests are currently closed."
                                note="Please call the clinic or visit in person to book."
                            />
                        </motion.div>
                    )}

                    {pageState === 'success' && (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                            className="card text-center py-14 px-6">
                            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                                <CheckCircle className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
                                Request Received{patientName ? `, ${patientName}` : ''}!
                            </h2>
                            <p className="text-text-secondary text-base mb-6">
                                Your appointment request has been submitted successfully.
                                Our staff will confirm your schedule shortly.
                            </p>
                            {redirectUrl
                                ? <p className="text-sm text-text-secondary">Redirecting you shortly…</p>
                                : <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-semibold text-sm px-5 py-3 rounded-xl">
                                    Please wait for a confirmation from our staff.
                                </div>
                            }
                            <p className="text-xs text-text-secondary mt-8">
                                © {new Date().getFullYear()} Plaza Maestro Dental Clinic
                            </p>
                        </motion.div>
                    )}

                    {pageState === 'form' && (
                        <motion.form key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            onSubmit={handleSubmit} className="space-y-5">

                            {/* Anti-spam honeypot — invisible to humans, filled only by bots */}
                            <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }}
                                 aria-hidden="true">
                                <input name="fax" type="text" tabIndex={-1} autoComplete="off"
                                       value="" onChange={() => {}} />
                            </div>

                            <div className="card bg-primary/5 border border-primary/20">
                                <p className="text-sm text-text-primary">
                                    Already a patient? Fill in your details below to request an appointment.
                                    Fields marked with <span className="text-red-500 font-bold mx-1">*</span> are required.
                                </p>
                            </div>

                            {errors._global && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    {errors._global}
                                </div>
                            )}

                            {/* Patient Verification */}
                            <div className="card space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-border">
                                    <User className="w-4 h-4 text-primary" />
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Patient Verification</h3>
                                </div>
                                <p className="text-xs text-text-secondary -mt-2">
                                    Enter your name and birthdate exactly as they appear on your patient record.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Last Name" required error={errors.last_name}>
                                        <input className="form-input" value={form.last_name} onChange={set('last_name')} placeholder="Dela Cruz" />
                                    </Field>
                                    <Field label="First Name" required error={errors.first_name}>
                                        <input className="form-input" value={form.first_name} onChange={set('first_name')} placeholder="Juan" />
                                    </Field>
                                </div>
                                <Field label="Date of Birth" required error={errors.date_of_birth}>
                                    <input type="date" className="form-input sm:max-w-xs" value={form.date_of_birth} onChange={set('date_of_birth')} />
                                </Field>
                            </div>

                            {/* Appointment Details */}
                            <div className="card space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-border">
                                    <Calendar className="w-4 h-4 text-primary" />
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Appointment Details</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Preferred Date" required error={errors.preferred_date}>
                                        <input type="date" className="form-input" value={form.preferred_date}
                                            onChange={set('preferred_date')} min={today} />
                                    </Field>
                                    <Field label="Preferred Time">
                                        <input type="time" className="form-input" value={form.preferred_time}
                                            onChange={set('preferred_time')} step="900" />
                                    </Field>
                                </div>
                                <Field label="Type of Appointment">
                                    <div className="flex items-center gap-2">
                                        <Stethoscope className="w-4 h-4 text-text-secondary shrink-0" />
                                        <select className="form-select flex-1" value={form.appointment_type} onChange={set('appointment_type')}>
                                            {VISIT_TYPES.map(t => (
                                                <option key={t.value} value={t.value}>{t.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </Field>
                            </div>

                            {/* Notes */}
                            <div className="card space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-border">
                                    <MessageSquare className="w-4 h-4 text-primary" />
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Additional Notes</h3>
                                </div>
                                <Field label="Reason for visit or concerns (optional)">
                                    <textarea className="form-textarea" rows={3} value={form.notes} onChange={set('notes')}
                                        placeholder="Describe your concern, pain location, or any special requests…" />
                                </Field>
                            </div>

                            {/* Submit */}
                            <div className="card">
                                <p className="text-xs text-text-secondary mb-4">
                                    This is a request only — our staff will confirm your appointment and notify you of availability.
                                </p>
                                <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-3 text-base">
                                    {saving ? 'Submitting…' : 'Request Appointment'}
                                </button>
                            </div>

                            <p className="text-center text-xs text-text-secondary pb-4">
                                © {new Date().getFullYear()} Plaza Maestro Dental Clinic
                            </p>
                        </motion.form>
                    )}

                </AnimatePresence>
            </div>
        </div>
    );
}
