import { Briefcase, MapPin, Shield, User } from 'lucide-react';
import { MARITAL_STATUS_OPTIONS, SEX_OPTIONS } from './schema';

export function Section({ title, icon: Icon, children, className = '' }) {
    return (
        <div className={`card space-y-4 ${className}`.trim()}>
            <div className="flex items-center gap-2 pb-2 border-b border-border">
                <Icon className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wide">{title}</h3>
            </div>
            {children}
        </div>
    );
}

export function Field({ label, required = false, error, children }) {
    return (
        <div>
            <label className="form-label">
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {children}
            {error && <p className="form-error">{error}</p>}
        </div>
    );
}

export function BasicInfoSection({ form, setField, errors = {}, showRecordDate = true, showClinicalNote = false }) {
    return (
        <Section title="Basic Info" icon={User}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Last Name" required error={errors.last_name}>
                    <input className="form-input" value={form.patient.last_name} onChange={setField('patient', 'last_name')} placeholder="Dela Cruz" />
                </Field>
                <Field label="First Name" required error={errors.first_name}>
                    <input className="form-input" value={form.patient.first_name} onChange={setField('patient', 'first_name')} placeholder="Juan" />
                </Field>
                <Field label="Middle Name">
                    <input className="form-input" value={form.patient.middle_name} onChange={setField('patient', 'middle_name')} placeholder="Reyes" />
                </Field>
            </div>

            <div className={`grid grid-cols-1 gap-4 ${showRecordDate ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <Field label="Date of Birth" error={errors.date_of_birth}>
                    <input type="date" className="form-input" value={form.patient.date_of_birth} onChange={setField('patient', 'date_of_birth')} />
                </Field>
                <Field label="Sex">
                    <select className="form-select" value={form.patient.sex} onChange={setField('patient', 'sex')}>
                        <option value="">Select</option>
                        {SEX_OPTIONS.map(option => (
                            <option key={option} value={option}>
                                {option.charAt(0).toUpperCase() + option.slice(1)}
                            </option>
                        ))}
                    </select>
                </Field>
                {showRecordDate && (
                    <Field label="Record Date">
                        <input type="date" className="form-input" value={form.patient.record_date} onChange={setField('patient', 'record_date')} />
                    </Field>
                )}
            </div>

            {showClinicalNote && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Height and weight now live under Medical History so the patient master record stays lighter.
                </div>
            )}
        </Section>
    );
}

export function ContactSection({ form, setField, showBusinessFields, setShowBusinessFields }) {
    return (
        <Section title="Contact" icon={MapPin}>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3">
                    <Field label="Home Address">
                        <textarea className="form-textarea" rows={2} value={form.contact.address} onChange={setField('contact', 'address')} placeholder="123 Burgos St., Vigan City" />
                    </Field>
                </div>
                <Field label="ZIP Code">
                    <input className="form-input" value={form.contact.zip_code} onChange={setField('contact', 'zip_code')} placeholder="2700" />
                </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Phone Number">
                    <input className="form-input" value={form.contact.phone} onChange={setField('contact', 'phone')} placeholder="09171234567" />
                </Field>
                <Field label="Email Address">
                    <input type="email" className="form-input" value={form.contact.email} onChange={setField('contact', 'email')} placeholder="patient@email.com" />
                </Field>
            </div>

            <div className="rounded-xl border border-border bg-surface/50 px-4 py-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                        <p className="text-sm font-medium text-text-primary">Business Contact</p>
                        <p className="text-xs text-text-secondary">Only fill this out if the clinic needs alternate work details.</p>
                    </div>
                    <input
                        type="checkbox"
                        checked={showBusinessFields}
                        onChange={e => setShowBusinessFields(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                </label>
            </div>

            {showBusinessFields && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Business Phone">
                        <input className="form-input" value={form.contact.business_phone} onChange={setField('contact', 'business_phone')} placeholder="09987654321" />
                    </Field>
                    <Field label="Business Address">
                        <textarea className="form-textarea" rows={2} value={form.contact.business_address} onChange={setField('contact', 'business_address')} placeholder="Business address" />
                    </Field>
                </div>
            )}
        </Section>
    );
}

export function PreferencesSection({ form, setField }) {
    return (
        <Section title="Preferences" icon={Briefcase}>
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
                    {MARITAL_STATUS_OPTIONS.map(option => (
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
        </Section>
    );
}

export function InsuranceSection({ form, setField, embedded = false }) {
    const content = (
        <>
            <div className="rounded-xl border border-border bg-surface/50 px-4 py-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                        <p className="text-sm font-medium text-text-primary">Has insurance or HMO coverage</p>
                        <p className="text-xs text-text-secondary">Leave this off if the patient pays directly.</p>
                    </div>
                    <input
                        type="checkbox"
                        checked={form.insurance.has_insurance}
                        onChange={e => setField('insurance', 'has_insurance')(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                </label>
            </div>

            {form.insurance.has_insurance && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Insurance Provider">
                        <input className="form-input" value={form.insurance.insurance_provider} onChange={setField('insurance', 'insurance_provider')} placeholder="PhilHealth" />
                    </Field>
                    <Field label="Insurance ID">
                        <input className="form-input" value={form.insurance.insurance_id} onChange={setField('insurance', 'insurance_id')} placeholder="PH-12345678" />
                    </Field>
                </div>
            )}
        </>
    );

    if (embedded) {
        return (
            <div className="space-y-4 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wide">Insurance</h4>
                </div>
                {content}
            </div>
        );
    }

    return (
        <Section title="Insurance" icon={Shield}>
            {content}
        </Section>
    );
}
