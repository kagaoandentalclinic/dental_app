import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle, MapPin, User, Shield, Briefcase, Camera,
    Upload, RefreshCw, X, KeyRound, Tablet, LogOut,
} from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: API_BASE });

const STORAGE_KEY = '_kiosk_token';

const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function resizeImage(dataUrl, maxPx = 800) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * ratio);
            canvas.height = Math.round(img.height * ratio);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = dataUrl;
    });
}

const Section = ({ title, icon: Icon, children }) => (
    <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Icon className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">{title}</h3>
        </div>
        {children}
    </div>
);

const Field = ({ label, required, error, children }) => (
    <div>
        <label className="form-label">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
        {error && <p className="form-error">{error}</p>}
    </div>
);

const EMPTY = {
    last_name: '', first_name: '', middle_name: '', date_of_birth: '',
    sex: '', height: '', weight: '', occupation: '', marital_status: '',
    spouse_name: '', address: '', zip_code: '', phone: '', business_address: '',
    business_phone: '', email: '', referred_by: '', preferred_appointment_time: '',
    insurance_provider: '', insurance_id: '', notes: '',
    record_date: todayLocal(),
};

export default function Kiosk() {
    // pageState: checking | setup | welcome | form | success
    const [pageState, setPageState] = useState('checking');
    const [token, setToken] = useState('');
    const [clinicName, setClinicName] = useState('Our Clinic');

    // Setup screen
    const [tokenInput, setTokenInput] = useState('');
    const [tokenError, setTokenError] = useState('');
    const [tokenLoading, setTokenLoading] = useState(false);

    // Form
    const [patientName, setPatientName] = useState('');
    const [wasUpdated, setWasUpdated] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [countdown, setCountdown] = useState(15);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const fileInputRef = useRef(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [profilePhoto, setProfilePhoto] = useState(null);

    // On mount: check if a token is already saved, validate it
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) {
            setPageState('setup');
            return;
        }
        api.get(`/kiosk/validate/${saved}`)
            .then(res => {
                setToken(saved);
                setClinicName(res.data.clinic_name || 'Our Clinic');
                setPageState('welcome');
            })
            .catch(() => {
                // Saved token is no longer valid — clear it and ask for a new one
                localStorage.removeItem(STORAGE_KEY);
                setPageState('setup');
            });
    }, []);

    // Success countdown
    useEffect(() => {
        if (pageState !== 'success') return;
        setCountdown(15);
        const iv = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) { clearInterval(iv); resetKiosk(); return 0; }
                return c - 1;
            });
        }, 1000);
        return () => clearInterval(iv);
    }, [pageState]);

    const handleTokenSubmit = async e => {
        e.preventDefault();
        const t = tokenInput.trim();
        if (!t) { setTokenError('Please enter the access token.'); return; }
        setTokenError('');
        setTokenLoading(true);
        try {
            const res = await api.get(`/kiosk/validate/${t}`);
            localStorage.setItem(STORAGE_KEY, t);
            setToken(t);
            setClinicName(res.data.clinic_name || 'Our Clinic');
            setPageState('welcome');
        } catch (err) {
            if (err.response?.status === 404) {
                setTokenError('Invalid token. Please check with clinic staff.');
            } else {
                setTokenError('Could not verify token. Check your connection and try again.');
            }
        } finally {
            setTokenLoading(false);
        }
    };

    const clearDevice = () => {
        if (!window.confirm('Remove this device from kiosk mode? Staff will need to enter the token again.')) return;
        localStorage.removeItem(STORAGE_KEY);
        setToken('');
        setTokenInput('');
        setPageState('setup');
    };

    const resetKiosk = () => {
        setForm({ ...EMPTY, record_date: todayLocal() });
        setErrors({});
        setPatientName('');
        setWasUpdated(false);
        setProfilePhoto(null);
        setPageState('welcome');
        window.scrollTo({ top: 0 });
    };

    const set = field => e => setForm(s => ({ ...s, [field]: e.target.value }));

    // ── Camera ────────────────────────────────────────────────────────────────

    const openCamera = async () => {
        setCameraError('');
        setCameraOpen(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
            });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
        } catch (err) {
            setCameraError(
                err.name === 'NotAllowedError'
                    ? 'Camera access denied. Please allow camera permission or upload a photo instead.'
                    : 'Could not access camera. Please upload a photo instead.'
            );
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    };

    const capturePhoto = async () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const size = Math.min(video.videoWidth, video.videoHeight);
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        canvas.getContext('2d').drawImage(
            video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2,
            size, size, 0, 0, size, size
        );
        stopCamera();
        setCameraOpen(false);
        const compressed = await resizeImage(canvas.toDataURL('image/jpeg', 0.9), 800);
        setProfilePhoto(compressed);
        setErrors(e => ({ ...e, profile_photo: undefined }));
    };

    const handleFileUpload = async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = async ev => {
            const compressed = await resizeImage(ev.target.result, 800);
            setProfilePhoto(compressed);
            setErrors(e => ({ ...e, profile_photo: undefined }));
        };
        reader.readAsDataURL(file);
    };

    // ── Validate + Submit ─────────────────────────────────────────────────────

    const validate = () => {
        const errs = {};
        if (!form.last_name.trim()) errs.last_name = 'Last name is required';
        if (!form.first_name.trim()) errs.first_name = 'First name is required';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async e => {
        e.preventDefault();
        if (!validate()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        setSaving(true);
        try {
            const res = await api.post(`/kiosk/${token}`, {
                ...form,
                profile_photo: profilePhoto,
            });
            setPatientName(res.data.patientName || form.first_name);
            setWasUpdated(res.data.updated === true);
            setPageState('success');
            window.scrollTo({ top: 0 });
        } catch (err) {
            if (err.response?.status === 403) {
                // Token was regenerated — force re-setup
                localStorage.removeItem(STORAGE_KEY);
                setToken('');
                setPageState('setup');
                setTokenError('The kiosk token has changed. Please enter the new token.');
            } else {
                alert(err.response?.data?.error || 'Something went wrong. Please try again.');
            }
        } finally {
            setSaving(false);
        }
    };

    // ── Shared header ─────────────────────────────────────────────────────────

    const Header = () => (
        <div
            style={{ background: 'linear-gradient(135deg, #051f19 0%, #0a6352 60%, #0d8a6e 100%)' }}
            className="px-4 py-5 text-white shadow-lg sticky top-0 z-10"
        >
            <div className="max-w-3xl mx-auto flex items-center gap-3 sm:gap-4 min-w-0">
                <img src="/logo.png" alt="Clinic Logo" className="h-10 w-auto object-contain shrink-0" onError={e => { e.target.style.display = 'none'; }} />
                <div className="min-w-0">
                    <p className="font-bold text-white text-base leading-tight">{clinicName || 'Clinic Kiosk'}</p>
                    <p className="text-white/70 text-sm truncate">Patient Registration Kiosk</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {pageState !== 'setup' && pageState !== 'checking' && (
                        <button
                            type="button"
                            onClick={clearDevice}
                            title="Remove kiosk access from this device"
                            className="p-1.5 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}
                    <Tablet className="w-6 h-6 text-white/50" />
                </div>
            </div>
        </div>
    );

    // ── Render ────────────────────────────────────────────────────────────────

    if (pageState === 'checking') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (pageState === 'setup') {
        return (
            <div className="min-h-screen bg-bg">
                <Header />
                <div className="max-w-md mx-auto px-4 py-12">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                        className="card space-y-6"
                    >
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                <KeyRound className="w-8 h-8 text-primary" />
                            </div>
                            <h2 className="font-display text-2xl font-bold text-text-primary mb-1">Kiosk Setup</h2>
                            <p className="text-sm text-text-secondary">
                                Enter the access token provided by clinic staff to activate this device as a patient registration kiosk.
                            </p>
                        </div>

                        <form onSubmit={handleTokenSubmit} className="space-y-4">
                            <div>
                                <label className="form-label">Access Token</label>
                                <input
                                    className={`form-input text-center font-mono tracking-widest text-base ${tokenError ? 'border-red-400' : ''}`}
                                    value={tokenInput}
                                    onChange={e => { setTokenInput(e.target.value); setTokenError(''); }}
                                    placeholder="Enter token here"
                                    autoComplete="off"
                                    spellCheck={false}
                                    autoFocus
                                />
                                {tokenError && <p className="form-error mt-1">{tokenError}</p>}
                            </div>
                            <button
                                type="submit"
                                disabled={tokenLoading}
                                className="btn-primary w-full justify-center py-3 text-base"
                            >
                                {tokenLoading ? 'Verifying…' : 'Activate Kiosk'}
                            </button>
                        </form>

                        <p className="text-xs text-text-secondary text-center">
                            The token is saved on this device. You won't need to enter it again unless it's regenerated.
                        </p>
                    </motion.div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-bg">
            <Header />

            <div className="max-w-3xl mx-auto px-4 py-6">
                <AnimatePresence mode="wait">

                    {/* Welcome */}
                    {pageState === 'welcome' && (
                        <motion.div key="welcome"
                            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                            className="card text-center py-20">
                            <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8">
                                <User className="w-14 h-14 text-primary" />
                            </div>
                            <h1 className="font-display text-4xl font-bold text-text-primary mb-4">Welcome!</h1>
                            <p className="text-text-secondary text-xl mb-12">
                                New patient? Please fill in your information below.
                            </p>
                            <button onClick={() => setPageState('form')} className="btn-primary text-lg px-14 py-4 rounded-2xl shadow-lg">
                                Start Registration
                            </button>
                        </motion.div>
                    )}

                    {/* Success */}
                    {pageState === 'success' && (
                        <motion.div key="success"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="card text-center py-14 px-6">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5
                                            ${wasUpdated ? 'bg-blue-100' : 'bg-green-100'}`}>
                                <CheckCircle className={`w-10 h-10 ${wasUpdated ? 'text-blue-600' : 'text-green-600'}`} />
                            </div>
                            <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
                                {wasUpdated ? `Welcome back, ${patientName}!` : `Thank you, ${patientName}!`}
                            </h2>
                            <p className="text-text-secondary text-base mb-6">
                                {wasUpdated
                                    ? 'Your information has been updated. Please take a seat.'
                                    : 'Your registration has been submitted. Please take a seat.'}
                            </p>
                            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-semibold text-sm px-5 py-3 rounded-xl mb-6">
                                Staff will be with you shortly.
                            </div>
                            <p className="text-sm text-text-secondary mb-6">Resetting in {countdown} seconds…</p>
                            <button onClick={resetKiosk} className="btn-primary px-10 py-3 text-base">
                                Next Patient
                            </button>
                        </motion.div>
                    )}

                    {/* Form */}
                    {pageState === 'form' && (
                        <motion.form key="form"
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            onSubmit={handleSubmit} className="space-y-5">

                            <div className="card bg-primary/5 border border-primary/20">
                                <p className="text-sm text-text-primary">
                                    Welcome! Please fill in your information below. Fields marked with
                                    <span className="text-red-500 font-bold mx-1">*</span> are required.
                                </p>
                            </div>

                            {/* Personal Information */}
                            <div className="card space-y-5">
                                <Section title="Personal Information" icon={User}>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <Field label="Last Name" required error={errors.last_name}>
                                            <input className="form-input" value={form.last_name} onChange={set('last_name')} placeholder="Dela Cruz" autoCapitalize="words" />
                                        </Field>
                                        <Field label="First Name" required error={errors.first_name}>
                                            <input className="form-input" value={form.first_name} onChange={set('first_name')} placeholder="Juan" autoCapitalize="words" />
                                        </Field>
                                        <Field label="Middle Name">
                                            <input className="form-input" value={form.middle_name} onChange={set('middle_name')} placeholder="Reyes" autoCapitalize="words" />
                                        </Field>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Date of Birth" error={errors.date_of_birth}>
                                            <input type="date" className="form-input" value={form.date_of_birth} onChange={set('date_of_birth')} max={todayLocal()} />
                                        </Field>
                                        <Field label="Sex">
                                            <select className="form-select" value={form.sex} onChange={set('sex')}>
                                                <option value="">Select</option>
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </Field>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                        <Field label="Height">
                                            <input className="form-input" value={form.height} onChange={set('height')} placeholder="170 cm" />
                                        </Field>
                                        <Field label="Weight">
                                            <input className="form-input" value={form.weight} onChange={set('weight')} placeholder="65 kg" />
                                        </Field>
                                        <div className="sm:col-span-2">
                                            <Field label="Occupation">
                                                <input className="form-input" value={form.occupation} onChange={set('occupation')} placeholder="Engineer" autoCapitalize="words" />
                                            </Field>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">Marital Status</label>
                                        <div className="flex flex-wrap gap-4 mt-1">
                                            {['single', 'married', 'widowed', 'divorced'].map(ms => (
                                                <label key={ms} className="flex items-center gap-2 cursor-pointer">
                                                    <input type="radio" name="marital_status" value={ms}
                                                        checked={form.marital_status === ms} onChange={set('marital_status')}
                                                        className="text-primary focus:ring-primary/30" />
                                                    <span className="text-sm capitalize text-text-primary">{ms}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Spouse Name">
                                            <input className="form-input" value={form.spouse_name} onChange={set('spouse_name')} />
                                        </Field>
                                        <Field label="Referred By">
                                            <input className="form-input" value={form.referred_by} onChange={set('referred_by')} placeholder="Dr. Santos / Walk-in" />
                                        </Field>
                                    </div>
                                    <Field label="Preferred Appointment Time">
                                        <input className="form-input" value={form.preferred_appointment_time} onChange={set('preferred_appointment_time')} placeholder="Morning, 9–11 AM" />
                                    </Field>
                                </Section>
                            </div>

                            {/* Contact */}
                            <div className="card space-y-5">
                                <Section title="Contact Information" icon={MapPin}>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                        <div className="sm:col-span-3">
                                            <Field label="Home Address">
                                                <textarea className="form-textarea" rows={2} value={form.address} onChange={set('address')} placeholder="123 Burgos St., Vigan City" />
                                            </Field>
                                        </div>
                                        <Field label="ZIP Code">
                                            <input className="form-input" value={form.zip_code} onChange={set('zip_code')} placeholder="2700" />
                                        </Field>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <Field label="Phone Number">
                                            <input type="tel" className="form-input" value={form.phone} onChange={set('phone')} placeholder="09171234567" />
                                        </Field>
                                        <Field label="Email Address">
                                            <input type="email" className="form-input" value={form.email} onChange={set('email')} placeholder="email@example.com" inputMode="email" autoCapitalize="none" />
                                        </Field>
                                        <Field label="Business Phone">
                                            <input className="form-input" value={form.business_phone} onChange={set('business_phone')} />
                                        </Field>
                                    </div>
                                    <Field label="Business Address">
                                        <textarea className="form-textarea" rows={2} value={form.business_address} onChange={set('business_address')} />
                                    </Field>
                                </Section>
                            </div>

                            {/* Insurance */}
                            <div className="card space-y-5">
                                <Section title="Insurance Information" icon={Shield}>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Insurance Provider">
                                            <input className="form-input" value={form.insurance_provider} onChange={set('insurance_provider')} placeholder="PhilHealth" />
                                        </Field>
                                        <Field label="Insurance / Member ID">
                                            <input className="form-input" value={form.insurance_id} onChange={set('insurance_id')} placeholder="PH-12345678" />
                                        </Field>
                                    </div>
                                </Section>
                            </div>

                            {/* Notes */}
                            <div className="card space-y-4">
                                <Section title="Additional Notes" icon={Briefcase}>
                                    <Field label="Anything else you'd like us to know?">
                                        <textarea className="form-textarea" rows={3} value={form.notes} onChange={set('notes')} placeholder="Allergies, concerns, special requests..." />
                                    </Field>
                                </Section>
                            </div>

                            {/* Photo */}
                            <div className="card space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-border">
                                    <Camera className="w-4 h-4 text-primary" />
                                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">Patient Photo</h3>
                                    <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">Optional</span>
                                </div>
                                {profilePhoto ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <img src={profilePhoto} alt="Patient photo"
                                            className="w-40 h-40 rounded-2xl object-cover border-4 border-primary/20 shadow-md" />
                                        <button type="button"
                                            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                                            onClick={() => { setProfilePhoto(null); openCamera(); }}>
                                            <RefreshCw className="w-4 h-4" /> Retake Photo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 py-4">
                                        <div className="w-36 h-36 rounded-2xl border-2 border-dashed border-border flex items-center justify-center bg-surface">
                                            <Camera className="w-10 h-10 text-text-secondary opacity-40" />
                                        </div>
                                        <p className="text-sm text-text-secondary text-center">
                                            Add a clear photo of your face for your patient record if you would like.
                                        </p>
                                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                                            <button type="button" className="btn-primary w-full sm:w-auto" onClick={openCamera}>
                                                <Camera className="w-4 h-4" /> Open Camera
                                            </button>
                                            <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => fileInputRef.current?.click()}>
                                                <Upload className="w-4 h-4" /> Upload Photo
                                            </button>
                                        </div>
                                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                    </div>
                                )}
                            </div>

                            {/* Submit */}
                            <div className="card">
                                <p className="text-xs text-text-secondary mb-4">
                                    By submitting this form, you authorize {clinicName} to use this information for your dental treatment and care.
                                </p>
                                <div className="flex flex-col-reverse sm:flex-row gap-3">
                                    <button type="button" onClick={resetKiosk} className="btn-ghost flex-1 justify-center py-3">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={saving} className="btn-primary flex-[3] justify-center py-3 text-base">
                                        {saving ? 'Submitting…' : 'Submit My Information'}
                                    </button>
                                </div>
                            </div>

                            <p className="text-center text-xs text-text-secondary pb-4">
                                © {new Date().getFullYear()} {clinicName}
                            </p>
                        </motion.form>
                    )}

                </AnimatePresence>
            </div>

            {/* Camera modal */}
            {cameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <h3 className="font-semibold text-text-primary">Take Your Photo</h3>
                            <button type="button" className="p-1 rounded-lg hover:bg-surface transition-colors"
                                onClick={() => { stopCamera(); setCameraOpen(false); setCameraError(''); }}>
                                <X className="w-5 h-5 text-text-secondary" />
                            </button>
                        </div>
                        <div className="p-5">
                            {cameraError ? (
                                <div className="text-center py-6 space-y-4">
                                    <p className="text-sm text-red-500">{cameraError}</p>
                                    <button type="button" className="btn-secondary"
                                        onClick={() => { setCameraOpen(false); setCameraError(''); fileInputRef.current?.click(); }}>
                                        <Upload className="w-4 h-4" /> Upload a Photo Instead
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-text-secondary mb-3 text-center">
                                        Position your face in the center and tap Capture.
                                    </p>
                                    <video ref={videoRef} autoPlay playsInline muted
                                        className="w-full aspect-square rounded-xl bg-black object-cover" />
                                    <button type="button" className="btn-primary w-full justify-center mt-4" onClick={capturePhoto}>
                                        <Camera className="w-4 h-4" /> Capture Photo
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
