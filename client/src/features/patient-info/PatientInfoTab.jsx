import { useEffect, useMemo, useState } from 'react';
import { Save, Shield } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../components/Toast';
import { printPatientRecord } from '../../utils/print';
import { createPatientFormState, validatePatientForm } from '../patient-form/utils';
import { BasicInfoSection, ContactSection, Field, InsuranceSection, Section } from '../patient-form/PatientFormFields';
import { toLocalDateInput } from '../../utils/helpers';

export default function PatientInfoTab({ detail, patient, onSave }) {
    const toast = useToast();
    const [form, setForm] = useState(() => createPatientFormState(detail));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState({ core: false, contact: false, preferences: false });
    const [savedAt, setSavedAt] = useState(null);
    const [showBusinessFields, setShowBusinessFields] = useState(false);

    useEffect(() => {
        const next = createPatientFormState(detail);
        setForm(next);
        setShowBusinessFields(Boolean(next.contact.business_address || next.contact.business_phone));
    }, [detail]);

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

    const printForm = useMemo(() => ({
        ...form.patient,
        ...form.contact,
        ...form.profile,
        insurance_provider: form.insurance.has_insurance ? form.insurance.insurance_provider : '',
        insurance_id: form.insurance.has_insurance ? form.insurance.insurance_id : '',
        ...form.medical,
    }), [form]);

    const saveSuccess = () => {
        setSavedAt(new Date());
        onSave?.();
    };

    const handleSaveCore = async (e) => {
        e.preventDefault();
        const nextErrors = validatePatientForm(form);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setSaving(current => ({ ...current, core: true }));
        try {
            await client.put(`/patients/${patient.id}/core`, { patient: form.patient });
            toast.success('Basic info saved');
            saveSuccess();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save basic info');
        } finally {
            setSaving(current => ({ ...current, core: false }));
        }
    };

    const handleSaveContact = async (e) => {
        e.preventDefault();
        setSaving(current => ({ ...current, contact: true }));
        try {
            await client.put(`/patients/${patient.id}/contact`, { contact: form.contact });
            toast.success('Contact info saved');
            saveSuccess();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save contact info');
        } finally {
            setSaving(current => ({ ...current, contact: false }));
        }
    };

    const handleSavePreferences = async (e) => {
        e.preventDefault();
        setSaving(current => ({ ...current, preferences: true }));
        try {
            await client.put(`/patients/${patient.id}/profile`, { profile: form.profile });
            await client.put(`/patients/${patient.id}/insurance`, {
                insurance: {
                    insurance_provider: form.insurance.has_insurance ? form.insurance.insurance_provider : '',
                    insurance_id: form.insurance.has_insurance ? form.insurance.insurance_id : '',
                    has_insurance: form.insurance.has_insurance,
                },
            });
            toast.success('Insurance and preferences saved');
            saveSuccess();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save insurance and preferences');
        } finally {
            setSaving(current => ({ ...current, preferences: false }));
        }
    };

    const timeSince = (d) => {
        if (!d) return 'Unsaved changes';
        const mins = Math.floor((Date.now() - d) / 60000);
        if (mins < 1) return 'Saved just now';
        if (mins === 1) return 'Saved 1 minute ago';
        return `Saved ${mins} minutes ago`;
    };

    return (
        <div className="space-y-6">
            <div className="card flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="font-display text-xl font-bold text-text-primary">Patient Overview</h2>
                    <p className="text-sm text-text-secondary">
                        Record date: {form.patient.record_date ? toLocalDateInput(form.patient.record_date) : 'Not set'}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <button type="button" className="btn-secondary" onClick={() => printPatientRecord(printForm, patient)}>
                        Print Record
                    </button>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        Height and weight are now edited in Medical History.
                    </div>
                </div>
            </div>

            <form onSubmit={handleSaveCore} className="space-y-4">
                <BasicInfoSection form={form} setField={setField} errors={errors} showRecordDate showClinicalNote />
                <div className="flex justify-end">
                    <button type="submit" className="btn-primary" disabled={saving.core}>
                        {saving.core ? 'Saving...' : <><Save className="w-4 h-4" /> Save Basic Info</>}
                    </button>
                </div>
            </form>

            <form onSubmit={handleSaveContact} className="space-y-4">
                <ContactSection
                    form={form}
                    setField={setField}
                    showBusinessFields={showBusinessFields}
                    setShowBusinessFields={setShowBusinessFields}
                />
                <div className="flex justify-end">
                    <button type="submit" className="btn-primary" disabled={saving.contact}>
                        {saving.contact ? 'Saving...' : <><Save className="w-4 h-4" /> Save Contact</>}
                    </button>
                </div>
            </form>

            <form onSubmit={handleSavePreferences} className="space-y-4">
                <Section title="Insurance & Preferences" icon={Shield}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Occupation">
                            <input className="form-input" value={form.profile.occupation} onChange={setField('profile', 'occupation')} placeholder="Engineer" />
                        </Field>
                        <Field label="Referred By">
                            <input className="form-input" value={form.profile.referred_by} onChange={setField('profile', 'referred_by')} placeholder="Dr. Santos / Walk-in" />
                        </Field>
                    </div>

                    <div>
                        <label className="form-label">Marital Status</label>
                        <div className="flex flex-wrap gap-4 mt-1">
                            {['single', 'married', 'widowed', 'divorced'].map(option => (
                                <label key={option} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="marital_status"
                                        value={option}
                                        checked={form.profile.marital_status === option}
                                        onChange={setField('profile', 'marital_status')}
                                        className="text-primary focus:ring-primary/30"
                                    />
                                    <span className="text-sm capitalize text-text-primary">{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {form.profile.marital_status === 'married' && (
                        <Field label="Spouse Name">
                            <input className="form-input" value={form.profile.spouse_name} onChange={setField('profile', 'spouse_name')} placeholder="Maria Dela Cruz" />
                        </Field>
                    )}

                    <Field label="Preferred Appointment Time">
                        <input className="form-input" value={form.profile.preferred_appointment_time} onChange={setField('profile', 'preferred_appointment_time')} placeholder="Morning, 9-11 AM" />
                    </Field>

                    <Field label="Notes">
                        <textarea className="form-textarea" rows={3} value={form.profile.notes} onChange={setField('profile', 'notes')} placeholder="Additional patient notes..." />
                    </Field>

                    <InsuranceSection form={form} setField={setField} embedded />
                </Section>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-text-secondary">{timeSince(savedAt)}</p>
                    <button type="submit" className="btn-primary" disabled={saving.preferences}>
                        {saving.preferences ? 'Saving...' : <><Save className="w-4 h-4" /> Save Insurance & Preferences</>}
                    </button>
                </div>
            </form>
        </div>
    );
}
