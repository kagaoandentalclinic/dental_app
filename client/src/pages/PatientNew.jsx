import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import client from '../api/client';
import BackButton from '../components/BackButton';
import { useToast } from '../components/Toast';
import { toLocalDateInput } from '../utils/helpers';
import { BasicInfoSection, ContactSection, InsuranceSection, PreferencesSection, Section } from '../features/patient-form/PatientFormFields';
import { buildPatientPayload, createPatientFormState, validatePatientForm } from '../features/patient-form/utils';

const STEPS = ['Basic Info', 'Contact', 'Insurance & Preferences', 'Review'];

function ReviewItem({ label, value }) {
    return (
        <div>
            <p className="text-xs uppercase tracking-wide text-text-secondary">{label}</p>
            <p className="text-sm text-text-primary">{value || 'Not provided'}</p>
        </div>
    );
}

export default function PatientNew() {
    const navigate = useNavigate();
    const toast = useToast();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [duplicate, setDuplicate] = useState(null);
    const [showBusinessFields, setShowBusinessFields] = useState(false);
    const [form, setForm] = useState(() => createPatientFormState(null, {
        defaultRecordDate: toLocalDateInput(new Date()),
    }));

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

    const reviewData = useMemo(() => ({
        fullName: [form.patient.first_name, form.patient.middle_name, form.patient.last_name].filter(Boolean).join(' '),
        preferredTime: form.profile.preferred_appointment_time,
        insurance: form.insurance.has_insurance
            ? [form.insurance.insurance_provider, form.insurance.insurance_id].filter(Boolean).join(' / ')
            : 'Self-pay',
    }), [form]);

    const validateCurrentStep = () => {
        if (step !== 0) return true;
        const nextErrors = validatePatientForm(form);
        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const nextStep = () => {
        if (!validateCurrentStep()) return;
        setStep(current => Math.min(STEPS.length - 1, current + 1));
    };

    const prevStep = () => setStep(current => Math.max(0, current - 1));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setDuplicate(null);

        const nextErrors = validatePatientForm(form);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            setStep(0);
            return;
        }

        setSaving(true);
        try {
            const res = await client.post('/patients', buildPatientPayload(form));
            toast.success('Patient added successfully!');
            navigate(`/patients/${res.data.patient.id}`, { replace: true });
        } catch (err) {
            if (err.response?.status === 409) {
                setDuplicate(err.response.data.existingPatient);
                setStep(0);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else if (err.response?.data?.errors) {
                const mapped = {};
                err.response.data.errors.forEach(item => { mapped[item.path] = item.msg; });
                setErrors(mapped);
                setStep(0);
            } else {
                toast.error(err.response?.data?.error || 'Failed to add patient');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <BackButton to="/patients" />
                    <div>
                        <h1 className="font-display text-2xl font-bold text-text-primary">New Patient</h1>
                        <p className="text-text-secondary text-sm">Add one section at a time instead of filling one long sheet.</p>
                    </div>
                </div>
                {step === STEPS.length - 1 && (
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Patient</>}
                    </button>
                )}
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

            {duplicate && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-amber-800">Patient already exists</p>
                        <p className="text-sm text-amber-700 mt-0.5">
                            A record for <strong>{duplicate.last_name}, {duplicate.first_name}</strong> with
                            the same date of birth already exists in the system. Please update the existing record instead.
                        </p>
                        <Link
                            to={`/patients/${duplicate.id}`}
                            className="inline-block mt-2 text-sm font-semibold text-primary hover:underline"
                        >
                            View existing patient record →
                        </Link>
                    </div>
                </div>
            )}

            {step === 0 && (
                <BasicInfoSection form={form} setField={setField} errors={errors} showRecordDate showClinicalNote />
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
                <Section title="Review" icon={Save}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ReviewItem label="Patient" value={reviewData.fullName} />
                        <ReviewItem label="Birthdate" value={form.patient.date_of_birth} />
                        <ReviewItem label="Phone" value={form.contact.phone} />
                        <ReviewItem label="Email" value={form.contact.email} />
                        <ReviewItem label="Address" value={form.contact.address} />
                        <ReviewItem label="Preferred Time" value={reviewData.preferredTime} />
                        <ReviewItem label="Insurance" value={reviewData.insurance} />
                        <ReviewItem label="Notes" value={form.profile.notes} />
                    </div>
                </Section>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                <Link to="/patients" className="btn-secondary w-full sm:w-auto">Cancel</Link>
                <div className="flex flex-col sm:flex-row gap-3">
                    {step > 0 && (
                        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={prevStep}>
                            <ChevronLeft className="w-4 h-4" /> Back
                        </button>
                    )}
                    {step < STEPS.length - 1 ? (
                        <button type="button" className="btn-primary w-full sm:w-auto" onClick={nextStep}>
                            Next <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                            {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Patient</>}
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
}
