import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Calendar, User, RefreshCw, Printer, Receipt, FileText, CheckCircle, Smile, Wallet } from 'lucide-react';

import client from '../../api/client';
import { useToast } from '../../components/Toast';
import { formatDate, formatCurrency, capitalize, toLocalDateInput } from '../../utils/helpers';

import { VISIT_TYPES, PAYMENT_STATUSES, VISIT_TYPE_COLORS, RESTORATION_CLASSES } from '../../utils/constants';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import {
    printVisitReceipt,
    printPrescription,
    printVisitPaymentReceipt,
    printOrthoPaymentReceipt,
    printAccountStatement,
    getVisitPaymentTotals,
} from '../../utils/print';

function formatTeethTreated(value) {
    if (Array.isArray(value)) {
        return value.map(tooth => `#${tooth}`).join(', ');
    }
    return value || '';
}

function parseTeethTreated(value) {
    if (!value || !value.trim()) return null;
    const matches = value.match(/\d+/g) || [];
    const teeth = matches
        .map(item => Number.parseInt(item, 10))
        .filter(item => Number.isInteger(item) && item > 0);

    return teeth.length > 0 ? [...new Set(teeth)] : [];
}

// Parses stored visit_type string (comma-separated or single) into an array
function parseVisitTypes(value) {
    if (!value) return [];
    return String(value).split(',').map(v => v.trim()).filter(Boolean);
}

function parseStoredTreatmentList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) return [];

    if (normalizedValue.startsWith('[')) {
        try {
            const parsed = JSON.parse(normalizedValue);
            if (Array.isArray(parsed)) {
                return parsed.map((item) => String(item).trim()).filter(Boolean);
            }
        } catch {
            // Fall back to legacy comma-separated parsing below.
        }
    }

    return normalizedValue.split(',').map((item) => item.trim()).filter(Boolean);
}

const TREATMENT_OPTION_GROUPS = [
    {
        label: 'General Treatments',
        options: [
            'Checkup and Oral Examination',
            'Oral Prophylaxis / Cleaning',
            'Tooth Filling',
            'Tooth Extraction',
            'Root Canal Treatment',
            'Crown Placement',
            'Emergency Dental Treatment',
            'Dental Consultation',
            'Teeth Whitening',
            'Braces Adjustment',
            'Denture Fitting',
            'Dental Implant Procedure',
            'Medication Prescription Only',
        ],
    },
    {
        label: 'Tooth Restoration',
        options: RESTORATION_CLASSES.map((restorationClass) => `Tooth Restoration - ${restorationClass}`),
    },
];

const TREATMENT_OPTIONS = TREATMENT_OPTION_GROUPS.flatMap((group) => group.options);
const TREATMENT_OTHER_OPTION = 'Other';

function getInitialTreatmentState(value) {
    const parsedTreatments = parseStoredTreatmentList(value);
    if (parsedTreatments.length === 0) {
        return {
            treatment_performed: [],
            treatment_performed_other: '',
        };
    }

    const selectedOptions = parsedTreatments.filter((item) => TREATMENT_OPTIONS.includes(item));
    const customOptions = parsedTreatments.filter((item) => !TREATMENT_OPTIONS.includes(item));

    return {
        treatment_performed: customOptions.length > 0 ? [...selectedOptions, TREATMENT_OTHER_OPTION] : selectedOptions,
        treatment_performed_other: customOptions.join(', '),
    };
}

function getVisitCollectedAmount(visit) {
    const { totalCost, paid } = getVisitPaymentTotals(visit);
    return visit.payment_status === 'insurance' ? totalCost : paid;
}

function getVisitOutstandingAmount(visit) {
    return getVisitPaymentTotals(visit).balance;
}

function toAmount(value) {
    const amount = Number.parseFloat(value);
    return Number.isFinite(amount) ? amount : 0;
}

async function fetchClinic() {
    try {
        const res = await client.get('/settings/clinic');
        return res.data;
    } catch {
        return null;
    }
}

function formatMoneyPreview(value) {
    const amount = Number.parseFloat(value);
    return formatCurrency(Number.isFinite(amount) ? amount : 0);
}

// Multi-select pill picker for visit types
function VisitTypeMultiPicker({ selected, onChange }) {
    const toggle = (value) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    return (
        <div className="flex flex-wrap gap-2">
            {VISIT_TYPES.map(t => {
                const active = selected.includes(t.value);
                return (
                    <button
                        key={t.value}
                        type="button"
                        onClick={() => toggle(t.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                            active
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'
                        }`}
                    >
                        {t.label}
                    </button>
                );
            })}
        </div>
    );
}

function TreatmentMultiPicker({ selected, onChange }) {
    const toggle = (value) => {
        if (selected.includes(value)) {
            onChange(selected.filter((item) => item !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    return (
        <div className="space-y-3">
            {TREATMENT_OPTION_GROUPS.map((group) => (
                <div key={group.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-2">
                        {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {group.options.map((option) => {
                            const active = selected.includes(option);
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    onClick={() => toggle(option)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                                        active
                                            ? 'bg-primary text-white border-primary shadow-sm'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'
                                    }`}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary mb-2">
                    Custom
                </p>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => toggle(TREATMENT_OTHER_OPTION)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                            selected.includes(TREATMENT_OTHER_OPTION)
                                ? 'bg-primary text-white border-primary shadow-sm'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary'
                        }`}
                    >
                        Other
                    </button>
                </div>
            </div>
        </div>
    );
}

function formatTreatmentPerformed(value) {
    const treatments = parseStoredTreatmentList(value);
    return treatments.join(', ');
}

function VisitForm({ patientId, visit, orthoCase, onSave, onClose }) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const initialTreatmentState = getInitialTreatmentState(visit?.treatment_performed);
    const [form, setForm] = useState({
        visit_date: visit?.visit_date ? toLocalDateInput(visit.visit_date) : toLocalDateInput(new Date()),
        visit_types: parseVisitTypes(visit?.visit_type),   // array of selected types
        chief_complaint: visit?.chief_complaint || '',
        diagnosis: visit?.diagnosis || '',
        treatment_performed: initialTreatmentState.treatment_performed,
        treatment_performed_other: initialTreatmentState.treatment_performed_other,
        teeth_treated: formatTeethTreated(visit?.teeth_treated),
        prescriptions: visit?.prescriptions || '',
        next_appointment: visit?.next_appointment ? toLocalDateInput(visit.next_appointment) : '',
        cost: visit?.cost || '',
        payment_status: visit?.payment_status || 'pending',
        partial_amount_paid: visit?.partial_amount_paid || '',
        insurance: visit?.payment_status === 'insurance',
        notes: visit?.notes || '',
        ortho_amount_paid: '',
        ortho_payment_notes: '',
    });
    const [recordInOrtho, setRecordInOrtho] = useState(true);
    const isEdit = !!visit;
    // A new Braces visit for a patient with an active ortho case is saved as an
    // orthodontic adjustment, so its payment counts toward the ortho case balance.
    const hasBraces = form.visit_types.includes('braces');
    const orthoAvailable = !isEdit && hasBraces && orthoCase?.status === 'active';
    const orthoMode = orthoAvailable && recordInOrtho;
    const otherVisitTypes = form.visit_types.filter((type) => type !== 'braces');
    const orthoRemaining = orthoCase
        ? Math.max(0, toAmount(orthoCase.total_cost) - toAmount(orthoCase.total_paid))
        : 0;
    const orthoBalanceAfter = Math.max(0, orthoRemaining - toAmount(form.ortho_amount_paid));
    // When editing, payments come from the visit's ledger (recorded via Add Payment).
    const ledgerPaid = isEdit ? (visit.payments || []).reduce((sum, payment) => sum + toAmount(payment.amount), 0) : 0;
    const editBalancePreview = Math.max(0, toAmount(form.cost) - ledgerPaid);

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
    const setVisitTypes = (types) => setForm(f => ({ ...f, visit_types: types }));
    const setTreatments = (treatments) => setForm((f) => ({ ...f, treatment_performed: treatments }));
    const preventWheelChange = (e) => e.currentTarget.blur();
    const totalCostPreview = Number.parseFloat(form.cost);
    const partialPaidPreview = Number.parseFloat(form.partial_amount_paid);
    const remainingPreview = Number.isFinite(totalCostPreview)
        ? Math.max(0, totalCostPreview - (Number.isFinite(partialPaidPreview) ? partialPaidPreview : 0))
        : 0;
    const customTreatment = form.treatment_performed_other.trim();
    const effectiveTreatments = [
        ...form.treatment_performed.filter((item) => item !== TREATMENT_OTHER_OPTION),
        ...(form.treatment_performed.includes(TREATMENT_OTHER_OPTION) && customTreatment ? [customTreatment] : []),
    ];

    const saveOrthoAdjustment = async () => {
        if (otherVisitTypes.length > 0) {
            toast.error('Orthodontic adjustments are saved on their own. Remove the other visit types and add them as a separate visit.');
            return;
        }
        const amountPaid = toAmount(form.ortho_amount_paid);
        if (amountPaid < 0) { toast.error('Amount paid must be a valid amount'); return; }
        if (amountPaid > orthoRemaining + 0.001) {
            toast.error(`Payment cannot exceed the orthodontic balance of ${formatCurrency(orthoRemaining)}`);
            return;
        }

        setSaving(true);
        try {
            await client.post(`/patients/${patientId}/orthodontics/${orthoCase.id}/adjustments`, {
                adjustment_date: form.visit_date,
                next_adjustment_date: form.next_appointment,
                notes: form.notes,
                amount_paid: amountPaid,
                payment_notes: form.ortho_payment_notes,
                entry_type: 'adjustment',
            });
            toast.success('Orthodontic adjustment recorded');
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to record adjustment');
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.visit_types.length === 0) { toast.error('Please select at least one visit type'); return; }
        if (orthoMode) { await saveOrthoAdjustment(); return; }
        if (form.treatment_performed.length === 0) { toast.error('Please select at least one treatment performed'); return; }
        if (form.treatment_performed.includes(TREATMENT_OTHER_OPTION) && !customTreatment) {
            toast.error('Please specify the custom treatment performed');
            return;
        }
        if (effectiveTreatments.length === 0) { toast.error('Treatment performed is required'); return; }
        if (isEdit && !form.insurance && ledgerPaid > 0 && toAmount(form.cost) < ledgerPaid) {
            toast.error(`Total cost cannot be less than the ${formatCurrency(ledgerPaid)} already paid`);
            return;
        }
        if (!isEdit && form.payment_status === 'partial') {
            const cost = Number.parseFloat(form.cost);
            const partialAmount = Number.parseFloat(form.partial_amount_paid);
            if (!Number.isFinite(cost) || cost <= 0) {
                toast.error('Enter the total cost for a partial payment');
                return;
            }
            if (!Number.isFinite(partialAmount) || partialAmount <= 0) {
                toast.error('Enter the partial amount paid');
                return;
            }
            if (partialAmount > cost) {
                toast.error('Partial amount paid cannot exceed the total cost');
                return;
            }
        }
        const parsedTeeth = parseTeethTreated(form.teeth_treated);
        if (form.teeth_treated.trim() && (!parsedTeeth || parsedTeeth.length === 0)) {
            toast.error('Enter tooth numbers like #14, #15');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                ...form,
                treatment_performed: JSON.stringify(effectiveTreatments),
                visit_type: form.visit_types.join(','),  // store as comma-separated string
                teeth_treated: parsedTeeth,
            };
            delete payload.visit_types;
            delete payload.treatment_performed_other;
            delete payload.insurance;
            if (isEdit) {
                // Status follows the payment ledger; only insurance coverage is set here.
                payload.payment_status = form.insurance
                    ? 'insurance'
                    : (visit.payment_status === 'insurance' ? 'pending' : visit.payment_status);
                delete payload.partial_amount_paid;
            }
            if (visit) {
                await client.put(`/patients/${patientId}/visits/${visit.id}`, payload);
                toast.success('Visit updated successfully');
            } else {
                await client.post(`/patients/${patientId}/visits`, payload);
                toast.success('Visit added successfully');
            }
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save visit');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="form-label">Visit Date</label>
                    <input type="date" className="form-input" value={form.visit_date} onChange={set('visit_date')} />
                </div>
            </div>
            <div>
                <label className="form-label">
                    Visit Type *
                    {form.visit_types.length > 0 && (
                        <span className="ml-2 text-primary font-semibold">
                            ({form.visit_types.length} selected)
                        </span>
                    )}
                </label>
                <VisitTypeMultiPicker selected={form.visit_types} onChange={setVisitTypes} />
                {form.visit_types.length === 0 && (
                    <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> Select at least one visit type
                    </p>
                )}
            </div>
            {orthoAvailable && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-3 py-3 space-y-3">
                    <label className="flex items-start gap-2 text-sm text-text-primary">
                        <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={recordInOrtho}
                            onChange={(e) => setRecordInOrtho(e.target.checked)}
                        />
                        <span>
                            <span className="font-semibold">Record as orthodontic adjustment</span>
                            <span className="block text-xs text-text-secondary">
                                Saved to the patient's orthodontic case. Payment counts toward the ortho balance
                                ({formatCurrency(orthoRemaining)} remaining).
                            </span>
                        </span>
                    </label>
                    {orthoMode && otherVisitTypes.length > 0 && (
                        <p className="text-xs text-amber-600">
                            ⚠ Other visit types are selected. Remove them and add them as a separate visit.
                        </p>
                    )}
                    {orthoMode && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="form-label">Amount Paid (PHP)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    inputMode="decimal"
                                    className="form-input"
                                    placeholder="0.00"
                                    value={form.ortho_amount_paid}
                                    onChange={set('ortho_amount_paid')}
                                    onWheel={preventWheelChange}
                                />
                                <p className="text-xs text-text-secondary mt-1">
                                    Paid {formatMoneyPreview(form.ortho_amount_paid)} / Balance {formatCurrency(orthoBalanceAfter)}
                                </p>
                            </div>
                            <div>
                                <label className="form-label">Payment Notes <span className="text-text-secondary font-normal">(optional)</span></label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Cash, GCash, transfer"
                                    value={form.ortho_payment_notes}
                                    onChange={set('ortho_payment_notes')}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
            {!isEdit && hasBraces && !orthoAvailable && (
                <p className="text-xs text-text-secondary">
                    {orthoCase
                        ? 'The orthodontic case is not active, so this will be saved as a regular visit.'
                        : 'No orthodontic case on record. This will be saved as a regular visit. Start a case in the Orthodontics tab to track braces payments there.'}
                </p>
            )}
            {!orthoMode && (<>
            <div>
                <label className="form-label">Chief Complaint</label>
                <input className="form-input" placeholder="Patient's main complaint..." value={form.chief_complaint} onChange={set('chief_complaint')} />
            </div>
            <div>
                <label className="form-label">Diagnosis</label>
                <input className="form-input" placeholder="Diagnosis..." value={form.diagnosis} onChange={set('diagnosis')} />
            </div>
            <div>
                <label className="form-label">
                    Treatment Performed *
                    {form.treatment_performed.length > 0 && (
                        <span className="ml-2 text-primary font-semibold">
                            ({form.treatment_performed.length} selected)
                        </span>
                    )}
                </label>
                <TreatmentMultiPicker selected={form.treatment_performed} onChange={setTreatments} />
                {form.treatment_performed.length === 0 && (
                    <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> Select at least one treatment
                    </p>
                )}
                {form.treatment_performed.includes(TREATMENT_OTHER_OPTION) && (
                    <input
                        className="form-input mt-3"
                        placeholder="Specify the treatment performed..."
                        value={form.treatment_performed_other}
                        onChange={set('treatment_performed_other')}
                    />
                )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="form-label">Teeth Treated</label>
                    <input className="form-input" placeholder="e.g. #14, #15" value={form.teeth_treated} onChange={set('teeth_treated')} />
                </div>
                <div>
                    <label className="form-label">Prescriptions</label>
                    <input className="form-input" placeholder="Medications prescribed" value={form.prescriptions} onChange={set('prescriptions')} />
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="form-label">Total Cost (PHP)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="form-input"
                        placeholder="0.00"
                        value={form.cost}
                        onChange={set('cost')}
                        onWheel={preventWheelChange}
                    />
                </div>
                {isEdit ? (
                    <div>
                        <label className="form-label">Coverage</label>
                        <label className="flex items-center gap-2 h-[42px] text-sm text-text-primary">
                            <input
                                type="checkbox"
                                checked={form.insurance}
                                onChange={(e) => setForm((f) => ({ ...f, insurance: e.target.checked }))}
                            />
                            Covered by Insurance / HMO
                        </label>
                    </div>
                ) : (
                    <div>
                        <label className="form-label">Payment Status</label>
                        <select className="form-select" value={form.payment_status} onChange={set('payment_status')}>
                            {PAYMENT_STATUSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                )}
            </div>
            {isEdit && !form.insurance && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    <p className="text-text-primary">
                        Paid <span className="font-semibold text-emerald-700">{formatCurrency(ledgerPaid)}</span>
                        {' / '}Balance <span className="font-semibold text-amber-700">{formatCurrency(editBalancePreview)}</span>
                    </p>
                    <p className="text-xs text-text-secondary mt-0.5">
                        Record payments with "Add Payment" on the visit card. Each payment keeps its own date and balance.
                    </p>
                </div>
            )}
            {!isEdit && form.payment_status === 'partial' && (
                <div>
                    <label className="form-label">Partial Amount Paid (PHP)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="form-input"
                        placeholder="Enter the amount already paid"
                        value={form.partial_amount_paid}
                        onChange={set('partial_amount_paid')}
                        onWheel={preventWheelChange}
                    />
                    <p className="text-xs text-text-secondary mt-1">
                        Enter the actual amount paid. The remaining balance will be based on the total cost.
                    </p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
                            <p className="text-sm font-bold text-slate-800">{formatMoneyPreview(form.cost)}</p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500">Paid</p>
                            <p className="text-sm font-bold text-emerald-700">{formatMoneyPreview(form.partial_amount_paid)}</p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-500">Balance</p>
                            <p className="text-sm font-bold text-amber-700">{formatCurrency(remainingPreview)}</p>
                        </div>
                    </div>
                </div>
            )}
            </>)}
            <div>
                <label className="form-label">{orthoMode ? 'Next Adjustment Date' : 'Next Appointment'}</label>
                <input type="date" className="form-input" value={form.next_appointment} onChange={set('next_appointment')} />
            </div>
            <div>
                <label className="form-label">{orthoMode ? 'Clinical Notes' : 'Notes'}</label>
                <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder={orthoMode ? 'Wire change, progress observations, patient concerns...' : 'Additional notes...'}
                    value={form.notes}
                    onChange={set('notes')}
                />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                    {saving ? 'Saving...' : (visit ? 'Update Visit' : (orthoMode ? 'Record Adjustment' : 'Add Visit'))}
                </button>
            </div>
        </form>
    );
}

function PaymentForm({ patientId, visit, payment, onSave, onClose }) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        amount: payment?.amount ?? '',
        payment_date: payment?.payment_date ? toLocalDateInput(payment.payment_date) : toLocalDateInput(new Date()),
        notes: payment?.notes || '',
    });

    const totalCost = toAmount(visit.cost);
    const paidByOthers = (visit.payments || [])
        .filter((item) => item.id !== payment?.id)
        .reduce((sum, item) => sum + toAmount(item.amount), 0);
    const balanceBefore = Math.max(0, totalCost - paidByOthers);
    const balanceAfter = Math.max(0, balanceBefore - toAmount(form.amount));
    const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        const amount = toAmount(form.amount);
        if (amount <= 0) { toast.error('Enter a payment amount greater than zero'); return; }
        if (amount > balanceBefore + 0.001) { toast.error('Payment cannot exceed the remaining balance'); return; }

        setSaving(true);
        try {
            const base = `/patients/${patientId}/visits/${visit.id}/payments`;
            if (payment) {
                await client.put(`${base}/${payment.id}`, form);
                toast.success('Payment updated');
            } else {
                await client.post(base, form);
                toast.success('Payment recorded');
            }
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save payment');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-bg rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-secondary">Visit:</span><span className="font-semibold">{formatDate(visit.visit_date)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Total Cost:</span><span className="font-semibold">{formatCurrency(totalCost)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Paid (other payments):</span><span className="font-semibold text-green-600">{formatCurrency(paidByOthers)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Balance before this payment:</span><span className="font-semibold">{formatCurrency(balanceBefore)}</span></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="form-label">Payment Date</label>
                    <input type="date" className="form-input" value={form.payment_date} onChange={set('payment_date')} />
                </div>
                <div>
                    <label className="form-label">Amount Paid (PHP)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="form-input"
                        placeholder="0.00"
                        value={form.amount}
                        onChange={set('amount')}
                        onWheel={(e) => e.currentTarget.blur()}
                        autoFocus
                    />
                </div>
            </div>
            <p className="text-sm text-text-primary">
                After this payment: Paid <span className="font-semibold text-emerald-700">{formatMoneyPreview(form.amount)}</span>
                {' / '}Balance <span className="font-semibold text-amber-700">{formatCurrency(balanceAfter)}</span>
            </p>
            <div>
                <label className="form-label">Notes <span className="text-text-secondary font-normal">(optional)</span></label>
                <input className="form-input" placeholder="e.g. Cash, GCash, transfer" value={form.notes} onChange={set('notes')} />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                    {saving ? 'Saving...' : (payment ? 'Update Payment' : 'Record Payment')}
                </button>
            </div>
        </form>
    );
}

function FinancialSummary({ visits, orthoCase }) {
    const orthoTotal = toAmount(orthoCase?.total_cost);
    const orthoPaid = toAmount(orthoCase?.total_paid);
    const orthoOutstanding = orthoCase?.status === 'active' ? Math.max(0, orthoTotal - orthoPaid) : 0;
    const billed = visits.reduce((s, v) => s + toAmount(v.cost), 0) + orthoTotal;
    const collected = visits.reduce((sum, visit) => sum + getVisitCollectedAmount(visit), 0) + orthoPaid;
    const outstanding = visits.reduce((sum, visit) => sum + getVisitOutstandingAmount(visit), 0) + orthoOutstanding;

    if (visits.length === 0 && !orthoCase) return null;
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-3 gap-3">
                <div className="card p-3 sm:p-4 text-center border-t-[3px] border-t-primary">
                    <p className="text-xs text-text-secondary uppercase tracking-wide font-medium">Total Billed</p>
                    <p className="text-lg font-bold text-text-primary mt-0.5">{formatCurrency(billed)}</p>
                </div>
                <div className="card p-3 sm:p-4 text-center border-t-[3px] border-t-green-500">
                    <p className="text-xs text-text-secondary uppercase tracking-wide font-medium">Collected</p>
                    <p className="text-lg font-bold text-green-700 mt-0.5">{formatCurrency(collected)}</p>
                </div>
                <div className={`card p-3 sm:p-4 text-center border-t-[3px] ${outstanding > 0 ? 'border-t-red-500' : 'border-t-gray-300'}`}>
                    <p className="text-xs text-text-secondary uppercase tracking-wide font-medium">Outstanding</p>
                    <p className={`text-lg font-bold mt-0.5 ${outstanding > 0 ? 'text-red-600' : 'text-text-secondary'}`}>
                        {formatCurrency(Math.max(0, outstanding))}
                    </p>
                </div>
            </div>
            {orthoCase && (
                <p className="text-xs text-text-secondary">
                    Includes orthodontic treatment: Paid {formatCurrency(orthoPaid)} / Balance {formatCurrency(Math.max(0, orthoTotal - orthoPaid))}
                </p>
            )}
        </div>
    );
}

function PaymentLedger({ visit, onPrint, onEdit, onDelete }) {
    if (!visit.payments || visit.payments.length === 0) return null;
    return (
        <div className="mt-3 rounded-xl border border-slate-200 divide-y divide-slate-100">
            {visit.payments.map((payment, index) => {
                const balance = toAmount(payment.balance_after);
                return (
                    <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 px-3 py-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="text-text-secondary">#{index + 1}</span>
                            <span className="font-medium text-text-primary">{formatDate(payment.payment_date)}</span>
                            {payment.notes && <span className="text-text-secondary italic truncate">{payment.notes}</span>}
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-2">
                            <span className="text-text-primary">
                                Paid <span className="font-semibold text-emerald-700">{formatCurrency(payment.amount)}</span>
                                {payment.balance_after != null && (
                                    <>
                                        {' / '}Balance{' '}
                                        <span className={`font-semibold ${balance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                            {formatCurrency(balance)}
                                        </span>
                                    </>
                                )}
                            </span>
                            <div className="flex items-center">
                                <button className="btn-icon" title="Print payment receipt" onClick={() => onPrint(payment)}>
                                    <Receipt className="w-3.5 h-3.5" />
                                </button>
                                <button className="btn-icon" title="Edit payment" onClick={() => onEdit(payment)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button className="btn-icon text-red-500 hover:text-red-600" title="Delete payment" onClick={() => onDelete(payment)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function OrthoVisitCard({ entry, index, onPrintReceipt }) {
    const paid = toAmount(entry.amount_paid);
    const balance = toAmount(entry.balance_after);
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="card border-l-4 border-l-purple-400"
        >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="badge text-xs badge-purple">Ortho Adjustment</span>
                        {paid > 0 && (
                            <span className="text-xs font-medium text-orange-600">
                                Paid {formatCurrency(paid)} | Balance {formatCurrency(balance)}
                            </span>
                        )}
                    </div>
                    <p className="text-sm font-medium text-text-primary mb-1">{entry.notes || 'Orthodontic adjustment'}</p>
                    {entry.payment_notes && <p className="text-xs text-text-secondary italic">{entry.payment_notes}</p>}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-text-secondary">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" /> {formatDate(entry.adjustment_date)}
                        </span>
                        {entry.performed_by_name && (
                            <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" /> {entry.performed_by_name}
                            </span>
                        )}
                        {entry.next_adjustment_date && (
                            <span className="text-primary font-medium">
                                Next: {formatDate(entry.next_adjustment_date)}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Smile className="w-3.5 h-3.5" /> Managed in the Orthodontics tab
                        </span>
                    </div>
                </div>
                {paid > 0 && (
                    <div className="flex items-center justify-end gap-1 shrink-0">
                        <button className="btn-icon" title="Print payment receipt" onClick={() => onPrintReceipt(entry)}>
                            <Receipt className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default function VisitsTab({ patient }) {
    const toast = useToast();
    const [visits, setVisits] = useState([]);
    const [orthoEntries, setOrthoEntries] = useState([]);
    const [orthoCase, setOrthoCase] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editVisit, setEditVisit] = useState(null);
    const [deleteVisit, setDeleteVisit] = useState(null);
    const [printMenu, setPrintMenu] = useState(null);
    const [markingPaid, setMarkingPaid] = useState(null);
    const [paymentModal, setPaymentModal] = useState(null); // { visit, payment }
    const [deletePayment, setDeletePayment] = useState(null); // { visit, payment }

    const fetchVisits = useCallback(async () => {
        setLoading(true);
        try {
            const res = await client.get(`/patients/${patient.id}/visits`);
            setVisits(res.data.visits);
            setOrthoEntries(res.data.ortho_entries || []);
            setOrthoCase(res.data.ortho_case || null);
        } catch {
            toast.error('Failed to load visits');
        } finally {
            setLoading(false);
        }
    }, [patient.id]);

    useEffect(() => { fetchVisits(); }, [fetchVisits]);

    // Regular visits and orthodontic adjustment visits, newest first.
    const timeline = [
        ...visits.map((visit) => ({ kind: 'visit', id: visit.id, date: visit.visit_date, data: visit })),
        ...orthoEntries
            .filter((entry) => entry.entry_type !== 'payment')
            .map((entry) => ({ kind: 'ortho', id: entry.id, date: entry.adjustment_date, data: entry })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const handleSaved = () => {
        setModalOpen(false);
        setEditVisit(null);
        fetchVisits();
    };

    const handleDelete = async () => {
        try {
            await client.delete(`/patients/${patient.id}/visits/${deleteVisit.id}`);
            toast.success('Visit deleted');
            fetchVisits();
        } catch {
            toast.error('Failed to delete visit');
        } finally {
            setDeleteVisit(null);
        }
    };

    const handleDeletePayment = async () => {
        const { visit, payment } = deletePayment;
        try {
            await client.delete(`/patients/${patient.id}/visits/${visit.id}/payments/${payment.id}`);
            toast.success('Payment deleted');
            fetchVisits();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to delete payment');
        } finally {
            setDeletePayment(null);
        }
    };

    const openAdd = () => { setEditVisit(null); setModalOpen(true); };
    const openEdit = (v) => { setEditVisit(v); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setEditVisit(null); };

    const handleMarkPaid = async (v) => {
        setMarkingPaid(v.id);
        try {
            await client.post(`/patients/${patient.id}/visits/${v.id}/payments/settle`, {
                payment_date: toLocalDateInput(new Date()),
            });
            toast.success('Marked as paid');
            fetchVisits();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update payment status');
        } finally {
            setMarkingPaid(null);
        }
    };

    const handlePrintReceipt = async (v) => {
        setPrintMenu(null);
        const clinic = await fetchClinic();
        printVisitReceipt(v, patient, clinic);
    };

    const handlePrintPrescription = async (v) => {
        setPrintMenu(null);
        if (!v.prescriptions) { toast.error('No prescriptions recorded for this visit'); return; }
        const clinic = await fetchClinic();
        printPrescription(v, patient, clinic);
    };

    const handlePrintPaymentReceipt = async (visit, payment) => {
        const clinic = await fetchClinic();
        printVisitPaymentReceipt(visit, payment, patient, clinic);
    };

    const handlePrintOrthoReceipt = async (entry) => {
        if (!orthoCase) return;
        const clinic = await fetchClinic();
        printOrthoPaymentReceipt(orthoCase, {
            id: entry.id,
            date: entry.adjustment_date,
            amount: entry.amount_paid,
            balance_after: entry.balance_after,
            notes: entry.payment_notes,
            received_by: entry.performed_by_name,
            label: `Adjustment visit – ${formatDate(entry.adjustment_date)}`,
        }, patient, clinic);
    };

    const handlePrintStatement = async () => {
        const clinic = await fetchClinic();
        printAccountStatement(patient, { visits, orthoCase, orthoEntries }, clinic);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="font-semibold text-text-primary">Visit History</h2>
                    <p className="text-xs text-text-secondary">{timeline.length} visit{timeline.length !== 1 ? 's' : ''} recorded</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button className="btn-ghost text-xs" onClick={fetchVisits} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {!loading && (visits.length > 0 || orthoCase) && (
                        <button className="btn-secondary text-sm" onClick={handlePrintStatement} title="Print statement of account">
                            <Printer className="w-4 h-4" /> Statement
                        </button>
                    )}
                    {(loading || timeline.length > 0) && (
                        <button className="btn-primary text-sm flex-1 sm:flex-none" onClick={openAdd}>
                            <Plus className="w-4 h-4" /> Add Visit
                        </button>
                    )}
                </div>
            </div>

            {!loading && <FinancialSummary visits={visits} orthoCase={orthoCase} />}

            {loading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : timeline.length === 0 ? (
                <EmptyState
                    icon={Calendar}
                    title="No visits recorded"
                    message="Add the first visit record for this patient."
                    action={
                        <button className="btn-primary text-sm" onClick={openAdd}>
                            <Plus className="w-4 h-4" /> Add Visit
                        </button>
                    }
                />
            ) : (
                <div className="space-y-3">
                    {timeline.map((item, i) => {
                        if (item.kind === 'ortho') {
                            return (
                                <OrthoVisitCard
                                    key={`ortho-${item.id}`}
                                    entry={item.data}
                                    index={i}
                                    onPrintReceipt={handlePrintOrthoReceipt}
                                />
                            );
                        }
                        const v = item.data;
                        const payment = PAYMENT_STATUSES.find(p => p.value === v.payment_status);
                        const { paid: visitPaid, balance: visitBalance } = getVisitPaymentTotals(v);
                        const canTakePayment = (v.payment_status === 'pending' || v.payment_status === 'partial') && toAmount(v.cost) > 0;
                        return (
                            <motion.div
                                key={v.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="card"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                            {parseVisitTypes(v.visit_type).map(type => (
                                                <span key={type} className={`badge text-xs ${VISIT_TYPE_COLORS[type] || 'badge-gray'}`}>
                                                    {VISIT_TYPES.find(t => t.value === type)?.label || capitalize(type)}
                                                </span>
                                            ))}
                                            {payment && <span className={`badge text-xs ${payment.class}`}>{payment.label}</span>}
                                            {v.cost && <span className="text-xs font-medium text-text-secondary">{formatCurrency(v.cost)}</span>}
                                            {v.payment_status !== 'insurance' && visitPaid > 0 && visitBalance > 0 && (
                                                <span className="text-xs font-medium text-orange-600">
                                                    Paid {formatCurrency(visitPaid)} | Balance {formatCurrency(visitBalance)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-text-primary mb-1">{formatTreatmentPerformed(v.treatment_performed)}</p>
                                        {v.chief_complaint && <p className="text-xs text-text-secondary">Complaint: {v.chief_complaint}</p>}
                                        {v.diagnosis && <p className="text-xs text-text-secondary">Diagnosis: {v.diagnosis}</p>}
                                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-text-secondary">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5" /> {formatDate(v.visit_date)}
                                            </span>
                                            {v.dentist_name && (
                                                <span className="flex items-center gap-1">
                                                    <User className="w-3.5 h-3.5" /> {v.dentist_name}
                                                </span>
                                            )}
                                            {v.next_appointment && (
                                                <span className="text-primary font-medium">
                                                    Next: {formatDate(v.next_appointment)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-1 shrink-0">
                                        {canTakePayment && (
                                            <button
                                                className="btn-icon text-primary"
                                                title="Add Payment"
                                                onClick={() => setPaymentModal({ visit: v, payment: null })}
                                            >
                                                <Wallet className="w-4 h-4" />
                                            </button>
                                        )}
                                        {/* Quick mark as paid */}
                                        {(v.payment_status === 'pending' || v.payment_status === 'partial') && (
                                            <button
                                                className="btn-icon text-green-600 hover:bg-green-50"
                                                title="Mark as Paid (records the remaining balance)"
                                                disabled={markingPaid === v.id}
                                                onClick={() => handleMarkPaid(v)}
                                            >
                                                <CheckCircle className={`w-4 h-4 ${markingPaid === v.id ? 'animate-pulse' : ''}`} />
                                            </button>
                                        )}
                                        {/* Print dropdown */}
                                        <div className="relative">
                                            <button
                                                className="btn-icon"
                                                title="Print"
                                                onClick={() => setPrintMenu(prev => prev === v.id ? null : v.id)}
                                            >
                                                <Printer className="w-4 h-4" />
                                            </button>
                                            {printMenu === v.id && (
                                                <div className="absolute right-0 top-8 z-20 bg-white border border-border rounded-xl shadow-lg py-1 w-44"
                                                    onMouseLeave={() => setPrintMenu(null)}>
                                                    <button
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg text-text-primary"
                                                        onClick={() => handlePrintReceipt(v)}
                                                    >
                                                        <Receipt className="w-4 h-4 text-text-secondary" />
                                                        Print Receipt
                                                    </button>
                                                    <button
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg text-text-primary"
                                                        onClick={() => handlePrintPrescription(v)}
                                                    >
                                                        <FileText className="w-4 h-4 text-text-secondary" />
                                                        Print Prescription
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <button className="btn-icon" onClick={() => openEdit(v)}>
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            className="btn-icon text-red-500 hover:text-red-600"
                                            onClick={() => setDeleteVisit(v)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <PaymentLedger
                                    visit={v}
                                    onPrint={(p) => handlePrintPaymentReceipt(v, p)}
                                    onEdit={(p) => setPaymentModal({ visit: v, payment: p })}
                                    onDelete={(p) => setDeletePayment({ visit: v, payment: p })}
                                />
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <Modal isOpen={modalOpen} onClose={closeModal} title={editVisit ? 'Edit Visit' : 'Add Visit'} size="lg">
                <VisitForm patientId={patient.id} visit={editVisit} orthoCase={orthoCase} onSave={handleSaved} onClose={closeModal} />
            </Modal>

            <Modal
                isOpen={!!paymentModal}
                onClose={() => setPaymentModal(null)}
                title={paymentModal?.payment ? 'Edit Payment' : 'Add Payment'}
                size="sm"
            >
                {paymentModal && (
                    <PaymentForm
                        patientId={patient.id}
                        visit={paymentModal.visit}
                        payment={paymentModal.payment}
                        onSave={() => { setPaymentModal(null); fetchVisits(); }}
                        onClose={() => setPaymentModal(null)}
                    />
                )}
            </Modal>

            <ConfirmDialog
                isOpen={!!deleteVisit}
                title="Delete Visit"
                message={`Delete the visit from ${formatDate(deleteVisit?.visit_date)}? This cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setDeleteVisit(null)}
            />

            <ConfirmDialog
                isOpen={!!deletePayment}
                title="Delete Payment"
                message={`Delete the ${formatCurrency(deletePayment?.payment?.amount)} payment from ${formatDate(deletePayment?.payment?.payment_date)}? The visit balance will be recalculated.`}
                confirmLabel="Delete"
                onConfirm={handleDeletePayment}
                onCancel={() => setDeletePayment(null)}
            />
        </div>
    );
}
