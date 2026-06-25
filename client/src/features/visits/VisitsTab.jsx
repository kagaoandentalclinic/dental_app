import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, Calendar, User, RefreshCw, Printer, Receipt, FileText, CheckCircle } from 'lucide-react';

import client from '../../api/client';
import { useToast } from '../../components/Toast';
import { formatDate, formatCurrency, capitalize, toLocalDateInput } from '../../utils/helpers';

import { VISIT_TYPES, PAYMENT_STATUSES, VISIT_TYPE_COLORS } from '../../utils/constants';
import Modal from '../../components/Modal';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { printVisitReceipt, printPrescription } from '../../utils/print';

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

function getVisitCollectedAmount(visit) {
    const totalCost = parseFloat(visit.cost || 0);
    if (visit.payment_status === 'partial') {
        const partialPaid = parseFloat(visit.partial_amount_paid);
        if (Number.isFinite(partialPaid)) return partialPaid;
        return totalCost * 0.5;
    }
    if (visit.payment_status === 'paid' || visit.payment_status === 'insurance') {
        return totalCost;
    }
    return 0;
}

function getVisitOutstandingAmount(visit) {
    const totalCost = parseFloat(visit.cost || 0);
    if (visit.payment_status === 'partial') {
        return Math.max(0, totalCost - getVisitCollectedAmount(visit));
    }
    if (visit.payment_status === 'pending') {
        return totalCost;
    }
    return 0;
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

function VisitForm({ patientId, visit, onSave, onClose }) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        visit_date: visit?.visit_date ? toLocalDateInput(visit.visit_date) : toLocalDateInput(new Date()),
        visit_types: parseVisitTypes(visit?.visit_type),   // array of selected types
        chief_complaint: visit?.chief_complaint || '',
        diagnosis: visit?.diagnosis || '',
        treatment_performed: visit?.treatment_performed || '',
        teeth_treated: formatTeethTreated(visit?.teeth_treated),
        prescriptions: visit?.prescriptions || '',
        next_appointment: visit?.next_appointment ? toLocalDateInput(visit.next_appointment) : '',
        cost: visit?.cost || '',
        payment_status: visit?.payment_status || 'pending',
        partial_amount_paid: visit?.partial_amount_paid || '',
        notes: visit?.notes || '',
    });

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));
    const setVisitTypes = (types) => setForm(f => ({ ...f, visit_types: types }));
    const preventWheelChange = (e) => e.currentTarget.blur();
    const totalCostPreview = Number.parseFloat(form.cost);
    const partialPaidPreview = Number.parseFloat(form.partial_amount_paid);
    const remainingPreview = Number.isFinite(totalCostPreview)
        ? Math.max(0, totalCostPreview - (Number.isFinite(partialPaidPreview) ? partialPaidPreview : 0))
        : 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.visit_types.length === 0) { toast.error('Please select at least one visit type'); return; }
        if (!form.treatment_performed.trim()) { toast.error('Treatment performed is required'); return; }
        if (form.payment_status === 'partial') {
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
                visit_type: form.visit_types.join(','),  // store as comma-separated string
                teeth_treated: parsedTeeth,
            };
            delete payload.visit_types;
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
            <div>
                <label className="form-label">Chief Complaint</label>
                <input className="form-input" placeholder="Patient's main complaint..." value={form.chief_complaint} onChange={set('chief_complaint')} />
            </div>
            <div>
                <label className="form-label">Diagnosis</label>
                <input className="form-input" placeholder="Diagnosis..." value={form.diagnosis} onChange={set('diagnosis')} />
            </div>
            <div>
                <label className="form-label">Treatment Performed *</label>
                <textarea className="form-textarea" rows={3} placeholder="Describe the treatment performed..." value={form.treatment_performed} onChange={set('treatment_performed')} />
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
                <div>
                    <label className="form-label">Payment Status</label>
                    <select className="form-select" value={form.payment_status} onChange={set('payment_status')}>
                        {PAYMENT_STATUSES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                </div>
            </div>
            {form.payment_status === 'partial' && (
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
            <div>
                <label className="form-label">Next Appointment</label>
                <input type="date" className="form-input" value={form.next_appointment} onChange={set('next_appointment')} />
            </div>
            <div>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} placeholder="Additional notes..." value={form.notes} onChange={set('notes')} />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                    {saving ? 'Saving...' : (visit ? 'Update Visit' : 'Add Visit')}
                </button>
            </div>
        </form>
    );
}

function FinancialSummary({ visits }) {
    const billed = visits.reduce((s, v) => s + parseFloat(v.cost || 0), 0);
    const collected = visits.reduce((sum, visit) => sum + getVisitCollectedAmount(visit), 0);
    const outstanding = visits.reduce((sum, visit) => sum + getVisitOutstandingAmount(visit), 0);

    if (visits.length === 0) return null;
    return (
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
    );
}

export default function VisitsTab({ patient }) {
    const toast = useToast();
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editVisit, setEditVisit] = useState(null);
    const [deleteVisit, setDeleteVisit] = useState(null);
    const [printMenu, setPrintMenu] = useState(null);
    const [markingPaid, setMarkingPaid] = useState(null);

    const fetchVisits = useCallback(async () => {
        setLoading(true);
        try {
            const res = await client.get(`/patients/${patient.id}/visits`);
            setVisits(res.data.visits);
        } catch {
            toast.error('Failed to load visits');
        } finally {
            setLoading(false);
        }
    }, [patient.id]);

    useEffect(() => { fetchVisits(); }, [fetchVisits]);

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

    const openAdd = () => { setEditVisit(null); setModalOpen(true); };
    const openEdit = (v) => { setEditVisit(v); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setEditVisit(null); };

    const handleMarkPaid = async (v) => {
        setMarkingPaid(v.id);
        try {
            await client.put(`/patients/${patient.id}/visits/${v.id}`, {
                ...v,
                payment_status: 'paid',
                partial_amount_paid: v.cost || '',
            });
            toast.success('Marked as paid');
            fetchVisits();
        } catch {
            toast.error('Failed to update payment status');
        } finally {
            setMarkingPaid(null);
        }
    };

    const fetchClinic = async () => {
        try {
            const res = await client.get('/settings/clinic');
            return res.data;
        } catch {
            return null;
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

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="font-semibold text-text-primary">Visit History</h2>
                    <p className="text-xs text-text-secondary">{visits.length} visit{visits.length !== 1 ? 's' : ''} recorded</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button className="btn-ghost text-xs" onClick={fetchVisits} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="btn-primary text-sm flex-1 sm:flex-none" onClick={openAdd}>
                        <Plus className="w-4 h-4" /> Add Visit
                    </button>
                </div>
            </div>

            {!loading && <FinancialSummary visits={visits} />}

            {loading ? (
                <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
            ) : visits.length === 0 ? (
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
                    {visits.map((v, i) => {
                        const payment = PAYMENT_STATUSES.find(p => p.value === v.payment_status);
                        const partialCollected = getVisitCollectedAmount(v);
                        const partialOutstanding = getVisitOutstandingAmount(v);
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
                                            {v.payment_status === 'partial' && (
                                                <span className="text-xs font-medium text-orange-600">
                                                    Paid {formatCurrency(partialCollected)} | Balance {formatCurrency(partialOutstanding)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium text-text-primary mb-1">{v.treatment_performed}</p>
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
                                        {/* Quick mark as paid */}
                                        {(v.payment_status === 'pending' || v.payment_status === 'partial') && (
                                            <button
                                                className="btn-icon text-green-600 hover:bg-green-50"
                                                title="Mark as Paid"
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
                            </motion.div>
                        );
                    })}
                </div>
            )}

            <Modal isOpen={modalOpen} onClose={closeModal} title={editVisit ? 'Edit Visit' : 'Add Visit'} size="lg">
                <VisitForm patientId={patient.id} visit={editVisit} onSave={handleSaved} onClose={closeModal} />
            </Modal>

            <ConfirmDialog
                isOpen={!!deleteVisit}
                title="Delete Visit"
                message={`Delete the visit from ${formatDate(deleteVisit?.visit_date)}? This cannot be undone.`}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setDeleteVisit(null)}
            />
        </div>
    );
}
