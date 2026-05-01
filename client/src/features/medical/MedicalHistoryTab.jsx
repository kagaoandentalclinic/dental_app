import { useState, useEffect } from 'react';
import { Save, Heart, Pill, AlertTriangle, Activity } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../components/Toast';
import { formatDate, toLocalDateInput } from '../../utils/helpers';

const Section = ({ title, icon: Icon, children }) => (
    <div className="card space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
            <Icon className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">{title}</h3>
        </div>
        {children}
    </div>
);

const CheckRow = ({ label, checked, onChange }) => (
    <label className="flex items-center gap-3 cursor-pointer group">
        <input
            type="checkbox"
            checked={!!checked}
            onChange={e => onChange(e.target.checked)}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30 shrink-0"
        />
        <span className="text-sm text-text-primary group-hover:text-primary transition-colors">{label}</span>
    </label>
);

export default function MedicalHistoryTab({ patient }) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const defaultForm = {
        height: '', weight: '',
        general_health: '', physician_name_address: '', last_physical_exam: '',
        taking_medication: false, medication_details: '',
        heart_disease: false, heart_murmur: false, rheumatic_fever: false, jaundice: false,
        abnormal_blood_pressure: false, asthma_hay_fever: false, ulcers: false, sinus_trouble: false,
        tuberculosis_lung_disease: false, cough: false, diabetes: false, hepatitis: false,
        epilepsy: false, arthritis: false, anemia: false, stroke: false,
        congenital_heart_lesions: false, glaucoma: false, treated_with_xray: false,
        allergic_penicillin: false, allergic_codeine: false, allergic_local_anesthetic: false,
        allergic_other_medications: false, allergic_other_details: '',
        prolonged_bleeding: false, fainting_spells: false,
        excessive_urination_thirst: false, is_pregnant: false,
    };

    const [form, setForm] = useState(defaultForm);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await client.get(`/patients/${patient.id}/medical-history`);
                if (res.data) {
                    setForm({ ...defaultForm, ...res.data });
                    setLastUpdated(res.data.updated_at);
                }
            } catch {
                toast.error('Failed to load medical history');
            }
        };
        fetch();
    }, [patient.id]);

    const set = (field) => (value) => setForm(f => ({ ...f, [field]: value }));
    const setInput = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await client.put(`/patients/${patient.id}/medical-history`, form);
            setLastUpdated(res.data.updated_at);
            toast.success('Medical history saved successfully!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save medical history');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <Section title="Clinical Snapshot" icon={Pill}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="form-label">Height</label>
                        <input
                            className="form-input"
                            placeholder="170 cm"
                            value={form.height || ''}
                            onChange={setInput('height')}
                        />
                    </div>
                    <div>
                        <label className="form-label">Weight</label>
                        <input
                            className="form-input"
                            placeholder="65 kg"
                            value={form.weight || ''}
                            onChange={setInput('weight')}
                        />
                    </div>
                </div>
            </Section>

            {/* General Health */}
            <Section title="General Health" icon={Activity}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="form-label">General State of Health</label>
                        <select className="form-select" value={form.general_health || ''} onChange={setInput('general_health')}>
                            <option value="">Select...</option>
                            <option value="excellent">Excellent</option>
                            <option value="good">Good</option>
                            <option value="fair">Fair</option>
                            <option value="poor">Poor</option>
                        </select>
                    </div>
                    <div>
                        <label className="form-label">Last Physical Exam</label>
                        <input
                            type="date"
                            className="form-input"
                            value={toLocalDateInput(form.last_physical_exam)}
                            onChange={setInput('last_physical_exam')}
                        />
                    </div>
                </div>
                <div>
                    <label className="form-label">Physician Name &amp; Address</label>
                    <input
                        className="form-input"
                        placeholder="Dr. Santos, 123 Main St."
                        value={form.physician_name_address || ''}
                        onChange={setInput('physician_name_address')}
                    />
                </div>
                <div className="space-y-3">
                    <CheckRow
                        label="Currently taking any medication"
                        checked={form.taking_medication}
                        onChange={set('taking_medication')}
                    />
                    {form.taking_medication && (
                        <div className="ml-7">
                            <label className="form-label">Medication Details</label>
                            <textarea
                                className="form-textarea"
                                rows={2}
                                placeholder="List medications and dosages..."
                                value={form.medication_details || ''}
                                onChange={setInput('medication_details')}
                            />
                        </div>
                    )}
                </div>
            </Section>

            {/* Medical Conditions */}
            <Section title="Medical Conditions" icon={Heart}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        ['heart_disease', 'Heart Disease'],
                        ['heart_murmur', 'Heart Murmur'],
                        ['rheumatic_fever', 'Rheumatic Fever'],
                        ['jaundice', 'Jaundice'],
                        ['abnormal_blood_pressure', 'Abnormal Blood Pressure'],
                        ['asthma_hay_fever', 'Asthma / Hay Fever'],
                        ['ulcers', 'Ulcers'],
                        ['sinus_trouble', 'Sinus Trouble'],
                        ['tuberculosis_lung_disease', 'Tuberculosis / Lung Disease'],
                        ['cough', 'Persistent Cough'],
                        ['diabetes', 'Diabetes'],
                        ['hepatitis', 'Hepatitis'],
                        ['epilepsy', 'Epilepsy / Seizures'],
                        ['arthritis', 'Arthritis'],
                        ['anemia', 'Anemia'],
                        ['stroke', 'Stroke'],
                        ['congenital_heart_lesions', 'Congenital Heart Lesions'],
                        ['glaucoma', 'Glaucoma'],
                        ['treated_with_xray', 'Treated with X-ray / Radiation'],
                    ].map(([field, label]) => (
                        <CheckRow key={field} label={label} checked={form[field]} onChange={set(field)} />
                    ))}
                </div>
            </Section>

            {/* Allergies */}
            <Section title="Allergies" icon={AlertTriangle}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        ['allergic_penicillin', 'Penicillin / Antibiotics'],
                        ['allergic_codeine', 'Codeine / Pain Medications'],
                        ['allergic_local_anesthetic', 'Local Anesthetics'],
                        ['allergic_other_medications', 'Other Medications'],
                    ].map(([field, label]) => (
                        <CheckRow key={field} label={label} checked={form[field]} onChange={set(field)} />
                    ))}
                </div>
                {form.allergic_other_medications && (
                    <div>
                        <label className="form-label">Specify Other Allergies</label>
                        <input
                            className="form-input"
                            placeholder="Describe other medication allergies..."
                            value={form.allergic_other_details || ''}
                            onChange={setInput('allergic_other_details')}
                        />
                    </div>
                )}
            </Section>

            {/* Other Conditions */}
            <Section title="Other Conditions" icon={Pill}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CheckRow label="Prolonged bleeding when cut" checked={form.prolonged_bleeding} onChange={set('prolonged_bleeding')} />
                    <CheckRow label="Fainting spells / dizziness" checked={form.fainting_spells} onChange={set('fainting_spells')} />
                    <CheckRow label="Excessive urination / thirst" checked={form.excessive_urination_thirst} onChange={set('excessive_urination_thirst')} />
                    <CheckRow label="Currently pregnant" checked={form.is_pregnant} onChange={set('is_pregnant')} />
                </div>
            </Section>

            {/* Footer */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-xs text-text-secondary">
                    {lastUpdated ? `Last updated ${formatDate(lastUpdated)}` : 'Not yet saved'}
                </p>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                    {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Medical History</>}
                </button>
            </div>
        </form>
    );
}
