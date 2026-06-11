import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle, Ban, Camera, CheckCircle, ChevronLeft, ChevronRight,
    RefreshCw, Upload, X,
} from 'lucide-react';
import axios from 'axios';
import { BasicInfoSection, ContactSection, InsuranceSection, PreferencesSection, Section } from '../features/patient-form/PatientFormFields';
import { buildPatientPayload, createPatientFormState, validatePatientForm } from '../features/patient-form/utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const api = axios.create({ baseURL: API_BASE });
const STEPS = ['Basic Info', 'Contact', 'Insurance & Preferences', 'Photo & Review'];

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

const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function resizeImage(dataUrl, maxPx = 800) {
    return new Promise((resolve) => {
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

function StatusScreen({ icon: Icon, iconBg, iconColor, title, subtitle, note }) {
    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card text-center py-14 px-6">
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

function ReviewItem({ label, value }) {
    return (
        <div>
            <p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p>
            <p className="text-sm text-text-primary">{value || 'Not provided'}</p>
        </div>
    );
}

export default function PatientIntake() {
    const { slug } = useParams();
    const [pageState, setPageState] = useState('checking');
    const [redirectUrl, setRedirectUrl] = useState(null);
    const [patientName, setPatientName] = useState('');
    const [wasUpdated, setWasUpdated] = useState(false);
    const [formStartTime] = useState(() => Date.now());
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [step, setStep] = useState(0);
    const [showBusinessFields, setShowBusinessFields] = useState(false);
    const [form, setForm] = useState(() => createPatientFormState(null, {
        defaultRecordDate: todayLocal(),
    }));

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const fileInputRef = useRef(null);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [profilePhoto, setProfilePhoto] = useState(null);

    useEffect(() => {
        if (!slug) { setPageState('not_found'); return; }
        api.get(`/intake/status/${slug}`)
            .then(res => {
                setRedirectUrl(res.data.redirect_url || null);
                setPageState('form');
            })
            .catch(err => {
                if (err.response?.status === 403) setPageState('disabled');
                else setPageState('not_found');
            });
    }, [slug]);

    useEffect(() => {
        if (pageState === 'success' && redirectUrl) {
            const t = setTimeout(() => { window.location.href = redirectUrl; }, 2500);
            return () => clearTimeout(t);
        }
    }, [pageState, redirectUrl]);

    const setField = (section, field) => (e) => {
        const value = typeof e === 'boolean'
            ? e
            : e?.target?.type === 'checkbox'
                ? e.target.checked
                : e?.target?.value ?? e;

        setForm(current => ({
            ...current,
            [section]: {
                ...current[section],
                [field]: value,
            },
        }));
    };

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
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    };

    const capturePhoto = async () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const size = Math.min(video.videoWidth, video.videoHeight);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        canvas.getContext('2d').drawImage(
            video,
            (video.videoWidth - size) / 2,
            (video.videoHeight - size) / 2,
            size,
            size,
            0,
            0,
            size,
            size
        );
        stopCamera();
        setCameraOpen(false);
        setProfilePhoto(await resizeImage(canvas.toDataURL('image/jpeg', 0.9), 800));
        setErrors(current => ({ ...current, profile_photo: undefined }));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        const reader = new FileReader();
        reader.onload = async (event) => {
            setProfilePhoto(await resizeImage(event.target.result, 800));
            setErrors(current => ({ ...current, profile_photo: undefined }));
        };
        reader.readAsDataURL(file);
    };

    const reviewData = useMemo(() => ({
        fullName: [form.patient.first_name, form.patient.middle_name, form.patient.last_name].filter(Boolean).join(' '),
        insurance: form.insurance.has_insurance
            ? [form.insurance.insurance_provider, form.insurance.insurance_id].filter(Boolean).join(' / ')
            : 'Self-pay',
    }), [form]);

    const validateStep = () => {
        if (step !== 0) return true;
        const nextErrors = validatePatientForm(form);
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const nextStep = () => {
        if (!validateStep()) return;
        setStep(current => Math.min(STEPS.length - 1, current + 1));
    };

    const prevStep = () => setStep(current => Math.max(0, current - 1));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nextErrors = validatePatientForm(form);
        setErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            if (nextErrors.last_name || nextErrors.first_name || nextErrors.date_of_birth) {
                setStep(0);
            } else {
                setStep(3);
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setSaving(true);
        try {
            const payload = buildPatientPayload(form);
            payload.patient.profile_photo = profilePhoto;

            const res = await api.post('/patients/intake', {
                ...payload,
                _t: Date.now() - formStartTime,
                _did: getDeviceId(),
                fax: '',
            });
            setPatientName(res.data.patientName || form.patient.first_name);
            setWasUpdated(res.data.updated === true);
            setPageState('success');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            const apiErrors = err.response?.data?.errors;
            if (apiErrors) {
                const mapped = {};
                apiErrors.forEach(item => { mapped[item.path] = item.msg; });
                setErrors(mapped);
            } else {
                setErrors({ _global: err.response?.data?.error || 'Something went wrong. Please try again.' });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg">
            <div
                style={{ background: 'linear-gradient(135deg, #051f19 0%, #0a6352 60%, #0d8a6e 100%)' }}
                className="px-4 py-5 text-white shadow-lg sticky top-0 z-10"
            >
                <div className="max-w-3xl mx-auto flex items-center gap-3 sm:gap-4 min-w-0">
                    <img src="/logo.png" alt="Clinic Logo" className="h-10 w-auto object-contain shrink-0" />
                    <p className="text-white/70 text-sm truncate">New Patient Registration Form</p>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 py-6">
                <AnimatePresence mode="wait">
                    {pageState === 'checking' && (
                        <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-32">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </motion.div>
                    )}

                    {pageState === 'not_found' && (
                        <motion.div key="not_found" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <StatusScreen
                                icon={AlertCircle}
                                iconBg="bg-gray-100"
                                iconColor="text-gray-400"
                                title="Form Not Found"
                                subtitle="This registration form link is invalid or no longer available."
                                note="Please contact clinic staff for a valid link."
                            />
                        </motion.div>
                    )}

                    {pageState === 'disabled' && (
                        <motion.div key="disabled" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <StatusScreen
                                icon={Ban}
                                iconBg="bg-amber-50"
                                iconColor="text-amber-500"
                                title="Registration Unavailable"
                                subtitle="The new patient registration form is currently closed."
                                note="Please check back later or contact staff directly."
                            />
                        </motion.div>
                    )}

                    {pageState === 'success' && (
                        <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card text-center py-14 px-6">
                            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${wasUpdated ? 'bg-blue-100' : 'bg-green-100'}`}>
                                <CheckCircle className={`w-10 h-10 ${wasUpdated ? 'text-blue-600' : 'text-green-600'}`} />
                            </div>
                            <h2 className="font-display text-2xl font-bold text-text-primary mb-2">
                                {wasUpdated ? `Welcome back, ${patientName}!` : `Thank you, ${patientName}!`}
                            </h2>
                            <p className="text-text-secondary text-base mb-6">
                                {wasUpdated
                                    ? 'We found your existing record and refreshed your details successfully.'
                                    : 'Your information has been received successfully.'}
                            </p>
                            {redirectUrl ? (
                                <p className="text-sm text-text-secondary">Redirecting you shortly...</p>
                            ) : null}
                            <p className="text-xs text-text-secondary mt-8">
                                © {new Date().getFullYear()} Plaza Maestro Dental Clinic
                            </p>
                        </motion.div>
                    )}

                    {pageState === 'form' && (
                        <motion.form key="form" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSubmit} className="space-y-5">
                            <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
                                <input name="fax" type="text" tabIndex={-1} autoComplete="off" value="" onChange={() => {}} />
                            </div>

                            <div className="card bg-primary/5 border border-primary/20">
                                <p className="text-sm text-text-primary">
                                    Welcome! Please fill in your information below. Fields marked with
                                    <span className="text-red-500 font-bold mx-1">*</span> are required.
                                </p>
                            </div>

                            <div className="card">
                                <div className="flex flex-wrap gap-2">
                                    {STEPS.map((label, index) => (
                                        <div
                                            key={label}
                                            className={`px-3 py-2 rounded-full text-sm font-medium ${index === step ? 'bg-primary text-white' : 'bg-surface text-text-secondary'}`}
                                        >
                                            {index + 1}. {label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {errors._global && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    {errors._global}
                                </div>
                            )}

                            {step === 0 && (
                                <BasicInfoSection form={form} setField={setField} errors={errors} showRecordDate={false} />
                            )}

                            {step === 1 && (
                                <ContactSection
                                    form={form}
                                    setField={setField}
                                    showBusinessFields={showBusinessFields}
                                    setShowBusinessFields={setShowBusinessFields}
                                />
                            )}

                            {step === 2 && (
                                <div className="space-y-5">
                                    <PreferencesSection form={form} setField={setField} />
                                    <InsuranceSection form={form} setField={setField} />
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-5">
                                    <Section title="Patient Photo (Optional)" icon={Camera}>
                                        {profilePhoto ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <img src={profilePhoto} alt="Patient photo" className="w-40 h-40 rounded-2xl object-cover border-4 border-primary/20 shadow-md" />
                                                <button
                                                    type="button"
                                                    className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                                                    onClick={() => { setProfilePhoto(null); openCamera(); }}
                                                >
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
                                    </Section>

                                    <Section title="Review" icon={CheckCircle}>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <ReviewItem label="Patient" value={reviewData.fullName} />
                                            <ReviewItem label="Birthdate" value={form.patient.date_of_birth} />
                                            <ReviewItem label="Phone" value={form.contact.phone} />
                                            <ReviewItem label="Email" value={form.contact.email} />
                                            <ReviewItem label="Address" value={form.contact.address} />
                                            <ReviewItem label="Preferred Time" value={form.profile.preferred_appointment_time} />
                                            <ReviewItem label="Insurance" value={reviewData.insurance} />
                                            <ReviewItem label="Notes" value={form.profile.notes} />
                                        </div>
                                    </Section>
                                </div>
                            )}

                            <div className="card">
                                <p className="text-xs text-text-secondary mb-4">
                                    By submitting this form, you authorize Plaza Maestro Dental Clinic to use this information for your dental treatment and care.
                                </p>
                                <div className="flex flex-col sm:flex-row justify-between gap-3">
                                    <div className="flex gap-3">
                                        {step > 0 && (
                                            <button type="button" className="btn-secondary" onClick={prevStep}>
                                                <ChevronLeft className="w-4 h-4" /> Back
                                            </button>
                                        )}
                                        {step < STEPS.length - 1 && (
                                            <button type="button" className="btn-primary" onClick={nextStep}>
                                                Next <ChevronRight className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {step === STEPS.length - 1 && (
                                        <button type="submit" disabled={saving} className="btn-primary justify-center">
                                            {saving ? 'Submitting...' : 'Submit My Information'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <p className="text-center text-xs text-text-secondary pb-4">
                                © {new Date().getFullYear()} Plaza Maestro Dental Clinic
                            </p>
                        </motion.form>
                    )}
                </AnimatePresence>
            </div>

            {cameraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <h3 className="font-semibold text-text-primary">Take Your Photo</h3>
                            <button
                                type="button"
                                className="p-1 rounded-lg hover:bg-surface transition-colors"
                                onClick={() => { stopCamera(); setCameraOpen(false); setCameraError(''); }}
                            >
                                <X className="w-5 h-5 text-text-secondary" />
                            </button>
                        </div>
                        <div className="p-5">
                            {cameraError ? (
                                <div className="text-center py-6 space-y-4">
                                    <p className="text-sm text-red-500">{cameraError}</p>
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => { setCameraOpen(false); setCameraError(''); fileInputRef.current?.click(); }}
                                    >
                                        <Upload className="w-4 h-4" /> Upload a Photo Instead
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm text-text-secondary mb-3 text-center">
                                        Position your face in the center and tap Capture.
                                    </p>
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-square rounded-xl bg-black object-cover" />
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
