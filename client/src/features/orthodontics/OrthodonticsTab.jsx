import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Trash2, RefreshCw, DollarSign, Calendar, Smile, Receipt } from 'lucide-react';
import client from '../../api/client';
import { useToast } from '../../components/Toast';
import { formatDate, formatCurrency, toLocalDateInput } from '../../utils/helpers';
import { BRACKET_TYPES, ORTHO_STATUSES } from '../../utils/constants';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';

// ── Case Modal ────────────────────────────────────────────────────────────────
function CaseModal({ patientId, orthoCase, onSave, onClose }) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        bracket_type: orthoCase?.bracket_type || 'metal',
        start_date: orthoCase?.start_date ? toLocalDateInput(orthoCase.start_date) : '',
        estimated_end_date: orthoCase?.estimated_end_date ? toLocalDateInput(orthoCase.estimated_end_date) : '',
        actual_end_date: orthoCase?.actual_end_date ? toLocalDateInput(orthoCase.actual_end_date) : '',
        total_cost: orthoCase?.total_cost || '',
        downpayment: orthoCase?.downpayment || '',
        status: orthoCase?.status || 'active',
        notes: orthoCase?.notes || '',
    });

    const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (orthoCase) {
                await client.put(`/patients/${patientId}/orthodontics/${orthoCase.id}`, form);
            } else {
                await client.post(`/patients/${patientId}/orthodontics`, form);
            }
            toast.success(orthoCase ? 'Case updated!' : 'Orthodontic case started!');
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save case');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="form-label">Bracket Type</label>
                    <select className="form-select" value={form.bracket_type} onChange={set('bracket_type')}>
                        {BRACKET_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={set('status')}>
                        {ORTHO_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-input" value={form.start_date} onChange={set('start_date')} />
                </div>
                <div>
                    <label className="form-label">Estimated End Date</label>
                    <input type="date" className="form-input" value={form.estimated_end_date} onChange={set('estimated_end_date')} />
                </div>
            </div>
            {orthoCase && (
                <div>
                    <label className="form-label">Actual End Date</label>
                    <input type="date" className="form-input" value={form.actual_end_date} onChange={set('actual_end_date')} />
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="form-label">Total Treatment Cost (PHP)</label>
                    <input type="number" className="form-input" placeholder="0.00" value={form.total_cost} onChange={set('total_cost')} />
                </div>
                <div>
                    <label className="form-label">Downpayment (PHP)</label>
                    <input type="number" className="form-input" placeholder="0.00" value={form.downpayment} onChange={set('downpayment')} />
                </div>
            </div>
            <div>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="Treatment notes..." />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                    {saving ? 'Saving...' : (orthoCase ? 'Update Case' : 'Start Case')}
                </button>
            </div>
        </form>
    );
}

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ patientId, orthoCase, onSave, onClose }) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentDate, setPaymentDate] = useState(toLocalDateInput(new Date()));
    const [paymentNotes, setPaymentNotes] = useState('');

    const totalCost = parseFloat(orthoCase?.total_cost) || 0;
    const totalPaid = parseFloat(orthoCase?.total_paid) || 0;
    const remaining = Math.max(0, totalCost - totalPaid);
    const projectedRemaining = Math.max(0, remaining - (parseFloat(amountPaid) || 0));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const normalizedAmount = parseFloat(amountPaid) || 0;

            if (normalizedAmount <= 0) {
                toast.error('Enter a payment amount greater than zero');
                return;
            }

            if (normalizedAmount > remaining) {
                toast.error('Payment cannot exceed the remaining balance');
                return;
            }

            await client.post(`/patients/${patientId}/orthodontics/${orthoCase.id}/adjustments`, {
                adjustment_date: paymentDate,
                amount_paid: normalizedAmount,
                payment_notes: paymentNotes.trim(),
                notes: 'Payment entry',
            });
            toast.success('Payment recorded!');
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to record payment');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-bg rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-secondary">Total Cost:</span><span className="font-semibold">{formatCurrency(orthoCase.total_cost)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Downpayment:</span><span className="font-semibold text-primary">{formatCurrency(orthoCase.downpayment)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Paid to Date:</span><span className="font-semibold text-green-600">{formatCurrency(totalPaid)}</span></div>
                <div className="flex justify-between"><span className="text-text-secondary">Remaining Balance:</span><span className="font-semibold">{formatCurrency(remaining)}</span></div>
            </div>
            <div>
                <label className="form-label">Payment Date</label>
                <input
                    type="date"
                    className="form-input"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                />
            </div>
            <div>
                <label className="form-label">Amount Paid (PHP)</label>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    placeholder="0.00"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    autoFocus
                />
                <p className="text-xs text-text-secondary mt-1">
                    Remaining after this payment: {formatCurrency(projectedRemaining)}
                </p>
            </div>
            <div>
                <label className="form-label">Payment Notes <span className="text-text-secondary font-normal">(optional)</span></label>
                <input
                    className="form-input"
                    placeholder="e.g. Cash, GCash, transfer"
                    value={paymentNotes}
                    onChange={e => setPaymentNotes(e.target.value)}
                />
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                    {saving ? 'Saving...' : 'Record Payment'}
                </button>
            </div>
        </form>
    );
}

// ── Adjustment Modal ──────────────────────────────────────────────────────────
function AdjustmentModal({ patientId, caseId, adjustment, orthoCase, onSave, onClose }) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        adjustment_date: adjustment?.adjustment_date ? toLocalDateInput(adjustment.adjustment_date) : toLocalDateInput(new Date()),
        notes: adjustment?.notes || '',
        next_adjustment_date: adjustment?.next_adjustment_date ? toLocalDateInput(adjustment.next_adjustment_date) : '',
        amount_paid: adjustment?.amount_paid ?? '',
        payment_notes: adjustment?.payment_notes || '',
    });

    const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (adjustment) {
                await client.put(`/patients/${patientId}/orthodontics/${caseId}/adjustments/${adjustment.id}`, form);
            } else {
                await client.post(`/patients/${patientId}/orthodontics/${caseId}/adjustments`, form);
            }
            toast.success(adjustment ? 'Adjustment updated!' : 'Adjustment recorded!');
            onSave();
        } catch (err) {
            toast.error('Failed to save adjustment');
        } finally {
            setSaving(false);
        }
    };

    const remaining = orthoCase
        ? Math.max(0, (parseFloat(orthoCase.total_cost) || 0) - (parseFloat(orthoCase.total_paid) || 0))
        : 0;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="form-label">Adjustment Date</label>
                    <input type="date" className="form-input" value={form.adjustment_date} onChange={set('adjustment_date')} />
                </div>
                <div>
                    <label className="form-label">Next Adjustment Date</label>
                    <input type="date" className="form-input" value={form.next_adjustment_date} onChange={set('next_adjustment_date')} />
                </div>
            </div>
            <div>
                <label className="form-label">Clinical Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="Wire change, progress observations, patient concerns..." />
            </div>

            {/* Payment section */}
            <div className="border-t border-border pt-4 space-y-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" /> Payment for this visit
                </p>
                {orthoCase && remaining > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                        Outstanding balance: <span className="font-semibold">{formatCurrency(remaining)}</span>
                    </div>
                )}
                <div>
                    <label className="form-label">Amount Paid (PHP)</label>
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        placeholder="0.00"
                        value={form.amount_paid}
                        onChange={set('amount_paid')}
                    />
                </div>
                <div>
                    <label className="form-label">Payment Notes <span className="text-text-secondary font-normal">(optional)</span></label>
                    <input
                        className="form-input"
                        placeholder="e.g. Cash, GCash, partial payment..."
                        value={form.payment_notes}
                        onChange={set('payment_notes')}
                    />
                </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                    {saving ? 'Saving...' : (adjustment ? 'Update' : 'Record Adjustment')}
                </button>
            </div>
        </form>
    );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────
export default function OrthodonticsTab({ patient }) {
    const toast = useToast();
    const [orthoCase, setOrthoCase] = useState(null);
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [caseModal, setCaseModal] = useState(false);
    const [paymentModal, setPaymentModal] = useState(false);
    const [adjModal, setAdjModal] = useState(null); // null | 'new' | adjustment object
    const [deleteAdj, setDeleteAdj] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await client.get(`/patients/${patient.id}/orthodontics`);
            setOrthoCase(res.data.case);
            setAdjustments(res.data.adjustments);
        } catch {
            toast.error('Failed to load orthodontic records');
        } finally {
            setLoading(false);
        }
    }, [patient.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleDeleteAdj = async () => {
        try {
            await client.delete(`/patients/${patient.id}/orthodontics/${orthoCase.id}/adjustments/${deleteAdj.id}`);
            toast.success('Adjustment deleted');
            fetchData();
        } catch {
            toast.error('Failed to delete adjustment');
        } finally {
            setDeleteAdj(null);
        }
    };

    const statusObj = ORTHO_STATUSES.find(s => s.value === orthoCase?.status);
    const bracketObj = BRACKET_TYPES.find(b => b.value === orthoCase?.bracket_type);
    const totalCost = parseFloat(orthoCase?.total_cost) || 0;
    const totalPaid = parseFloat(orthoCase?.total_paid) || 0;
    const remaining = Math.max(0, totalCost - totalPaid);
    const paidPct = totalCost > 0 ? Math.min(100, (totalPaid / totalCost) * 100) : 0;
    const barColor = paidPct >= 100 ? 'bg-green-500' : paidPct > 0 ? 'bg-amber-400' : 'bg-red-400';

    if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

    if (!orthoCase) return (
        <EmptyState
            icon={Smile}
            title="No orthodontic case"
            message="This patient has no braces or orthodontic treatment on record."
            action={
                <>
                    <button className="btn-primary" onClick={() => setCaseModal(true)}>
                        <Plus className="w-4 h-4" /> Start Orthodontic Case
                    </button>
                    <Modal isOpen={caseModal} onClose={() => setCaseModal(false)} title="Start Orthodontic Case" size="md">
                        <CaseModal patientId={patient.id} orthoCase={null} onSave={() => { setCaseModal(false); fetchData(); }} onClose={() => setCaseModal(false)} />
                    </Modal>
                </>
            }
        />
    );

    return (
        <div className="space-y-5">
            {/* ── Case Overview ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="font-semibold text-text-primary text-lg">Orthodontic Case</span>
                            {statusObj && <span className={`badge ${statusObj.class}`}>{statusObj.label}</span>}
                            {bracketObj && <span className="badge-gray text-xs">{bracketObj.label}</span>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-2 text-sm">
                            <div>
                                <p className="text-xs text-text-secondary uppercase tracking-wide">Start Date</p>
                                <p className="font-medium text-text-primary">{orthoCase.start_date ? formatDate(orthoCase.start_date) : '—'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-text-secondary uppercase tracking-wide">Est. End Date</p>
                                <p className="font-medium text-text-primary">{orthoCase.estimated_end_date ? formatDate(orthoCase.estimated_end_date) : '—'}</p>
                            </div>
                            {orthoCase.actual_end_date && (
                                <div>
                                    <p className="text-xs text-text-secondary uppercase tracking-wide">Actual End</p>
                                    <p className="font-medium text-green-600">{formatDate(orthoCase.actual_end_date)}</p>
                                </div>
                            )}
                        </div>
                        {orthoCase.notes && <p className="text-sm text-text-secondary mt-3 italic">"{orthoCase.notes}"</p>}
                    </div>
                    <button className="btn-secondary shrink-0 w-full sm:w-auto" onClick={() => setCaseModal(true)}>
                        <Pencil className="w-4 h-4" /> Edit Case
                    </button>
                </div>
            </motion.div>

            {/* ── Payment Summary ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <h3 className="font-semibold text-text-primary flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-primary" /> Payment Summary
                    </h3>
                    <button className="btn-secondary text-sm w-full sm:w-auto" onClick={() => setPaymentModal(true)}>
                        Record Payment
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    {[
                        { label: 'Total Cost', value: formatCurrency(totalCost), color: 'text-text-primary' },
                        { label: 'Downpayment', value: formatCurrency(orthoCase.downpayment), color: 'text-primary' },
                        { label: 'Total Paid', value: formatCurrency(totalPaid), color: 'text-green-600' },
                        { label: 'Remaining', value: formatCurrency(remaining), color: remaining > 0 ? 'text-red-500' : 'text-green-600' },
                    ].map(item => (
                        <div key={item.label} className="bg-bg rounded-xl p-3 text-center">
                            <p className="text-xs text-text-secondary mb-1">{item.label}</p>
                            <p className={`text-base font-bold ${item.color}`}>{item.value}</p>
                        </div>
                    ))}
                </div>

                <div>
                    <div className="flex justify-between text-xs text-text-secondary mb-1">
                        <span>Payment Progress</span>
                        <span>{paidPct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 bg-border rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${paidPct}%` }}
                        />
                    </div>
                    {remaining === 0 && totalCost > 0 && (
                        <p className="text-xs text-green-600 font-medium mt-1">✓ Fully paid</p>
                    )}
                </div>
            </motion.div>

            {/* ── Payment History ── */}
            {(parseFloat(orthoCase.downpayment) > 0 || adjustments.length > 0) && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card">
                    <h3 className="font-semibold text-text-primary flex items-center gap-2 mb-4">
                        <Receipt className="w-4 h-4 text-primary" /> Payment History
                    </h3>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[620px] text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left text-xs text-text-secondary font-medium pb-2 pr-4">#</th>
                                    <th className="text-left text-xs text-text-secondary font-medium pb-2 pr-4">Date</th>
                                    <th className="text-right text-xs text-text-secondary font-medium pb-2 pr-4">Paid</th>
                                    <th className="text-right text-xs text-text-secondary font-medium pb-2 pr-4">Running Total</th>
                                    <th className="text-right text-xs text-text-secondary font-medium pb-2">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Downpayment row */}
                                {parseFloat(orthoCase.downpayment) > 0 && (
                                    <tr className="border-b border-border/50">
                                        <td className="py-2 pr-4 text-text-secondary">—</td>
                                        <td className="py-2 pr-4">
                                            <span className="font-medium text-text-primary">
                                                {orthoCase.start_date ? formatDate(orthoCase.start_date) : 'Start'}
                                            </span>
                                            <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">Downpayment</span>
                                        </td>
                                        <td className="py-2 pr-4 text-right font-semibold text-green-600">
                                            {formatCurrency(orthoCase.downpayment)}
                                        </td>
                                        <td className="py-2 pr-4 text-right text-text-primary">
                                            {formatCurrency(orthoCase.downpayment)}
                                        </td>
                                        <td className="py-2 text-right text-text-primary">
                                            {formatCurrency(Math.max(0, totalCost - parseFloat(orthoCase.downpayment)))}
                                        </td>
                                    </tr>
                                )}

                                {/* Adjustment payment rows (oldest first for the running total) */}
                                {[...adjustments].reverse().reduce((acc, adj, i) => {
                                    const prevTotal = acc.runningTotal;
                                    const paid = parseFloat(adj.amount_paid) || 0;
                                    acc.runningTotal += paid;
                                    const balance = Math.max(0, totalCost - acc.runningTotal - parseFloat(orthoCase.downpayment || 0));
                                    acc.rows.push(
                                        <tr key={adj.id} className="border-b border-border/50 last:border-0">
                                            <td className="py-2 pr-4 text-text-secondary">{i + 1}</td>
                                            <td className="py-2 pr-4">
                                                <p className="font-medium text-text-primary">{formatDate(adj.adjustment_date)}</p>
                                                {adj.payment_notes && (
                                                    <p className="text-xs text-text-secondary">{adj.payment_notes}</p>
                                                )}
                                                {adj.performed_by_name && (
                                                    <p className="text-xs text-text-secondary">by {adj.performed_by_name}</p>
                                                )}
                                            </td>
                                            <td className="py-2 pr-4 text-right">
                                                {paid > 0
                                                    ? <span className="font-semibold text-green-600">{formatCurrency(paid)}</span>
                                                    : <span className="text-text-secondary">—</span>
                                                }
                                            </td>
                                            <td className="py-2 pr-4 text-right font-medium text-text-primary">
                                                {formatCurrency(acc.runningTotal + parseFloat(orthoCase.downpayment || 0))}
                                            </td>
                                            <td className={`py-2 text-right font-semibold ${balance === 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {formatCurrency(balance)}
                                            </td>
                                        </tr>
                                    );
                                    return acc;
                                }, { runningTotal: 0, rows: [] }).rows}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-border">
                                    <td colSpan={2} className="pt-2 text-xs font-semibold text-text-secondary uppercase">Total</td>
                                    <td className="pt-2 text-right font-bold text-green-600">{formatCurrency(totalPaid)}</td>
                                    <td />
                                    <td className={`pt-2 text-right font-bold ${remaining === 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {remaining === 0 ? '✓ Fully paid' : formatCurrency(remaining)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </motion.div>
            )}

            {/* ── Adjustments ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div>
                        <h3 className="font-semibold text-text-primary">Adjustment Records</h3>
                        <p className="text-xs text-text-secondary">{adjustments.length} adjustment{adjustments.length !== 1 ? 's' : ''} recorded</p>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button className="btn-ghost text-xs" onClick={fetchData}>
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button className="btn-primary text-sm flex-1 sm:flex-none" onClick={() => setAdjModal('new')}>
                            <Plus className="w-4 h-4" /> Add Adjustment
                        </button>
                    </div>
                </div>

                {adjustments.length === 0 ? (
                    <EmptyState
                        icon={Calendar}
                        title="No adjustments yet"
                        message="Record the first adjustment visit for this orthodontic case."
                        action={
                            <button className="btn-primary text-sm" onClick={() => setAdjModal('new')}>
                                <Plus className="w-4 h-4" /> Add Adjustment
                            </button>
                        }
                    />
                ) : (
                    <div className="space-y-2">
                        {adjustments.map((adj, i) => (
                            <motion.div
                                key={adj.id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="card flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-text-primary">
                                            {formatDate(adj.adjustment_date)}
                                        </span>
                                        {adj.next_adjustment_date && (
                                            <span className="text-xs text-primary font-medium">
                                                Next: {formatDate(adj.next_adjustment_date)}
                                            </span>
                                        )}
                                        {parseFloat(adj.amount_paid) > 0 && (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                                                Paid {formatCurrency(adj.amount_paid)}
                                            </span>
                                        )}
                                    </div>
                                    {adj.notes && <p className="text-sm text-text-secondary">{adj.notes}</p>}
                                    {adj.payment_notes && (
                                        <p className="text-xs text-text-secondary mt-0.5 italic">{adj.payment_notes}</p>
                                    )}
                                    {adj.performed_by_name && (
                                        <p className="text-xs text-text-secondary mt-1">By: {adj.performed_by_name}</p>
                                    )}
                                </div>
                                <div className="flex items-center justify-end gap-1 shrink-0">
                                    <button className="btn-icon" onClick={() => setAdjModal(adj)}>
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button className="btn-icon text-red-500 hover:text-red-600" onClick={() => setDeleteAdj(adj)}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* ── Modals ── */}
            <Modal isOpen={caseModal} onClose={() => setCaseModal(false)} title="Edit Orthodontic Case" size="md">
                <CaseModal
                    patientId={patient.id}
                    orthoCase={orthoCase}
                    onSave={() => { setCaseModal(false); fetchData(); }}
                    onClose={() => setCaseModal(false)}
                />
            </Modal>

            <Modal isOpen={paymentModal} onClose={() => setPaymentModal(false)} title="Record Payment" size="sm">
                <PaymentModal
                    patientId={patient.id}
                    orthoCase={orthoCase}
                    onSave={() => { setPaymentModal(false); fetchData(); }}
                    onClose={() => setPaymentModal(false)}
                />
            </Modal>

            <Modal
                isOpen={!!adjModal}
                onClose={() => setAdjModal(null)}
                title={adjModal && adjModal !== 'new' ? 'Edit Adjustment' : 'Record Adjustment'}
                size="sm"
            >
                {adjModal && (
                    <AdjustmentModal
                        patientId={patient.id}
                        caseId={orthoCase.id}
                        adjustment={adjModal !== 'new' ? adjModal : null}
                        orthoCase={orthoCase}
                        onSave={() => { setAdjModal(null); fetchData(); }}
                        onClose={() => setAdjModal(null)}
                    />
                )}
            </Modal>

            <ConfirmDialog
                isOpen={!!deleteAdj}
                title="Delete Adjustment"
                message={`Delete the adjustment from ${formatDate(deleteAdj?.adjustment_date)}?`}
                confirmLabel="Delete"
                onConfirm={handleDeleteAdj}
                onCancel={() => setDeleteAdj(null)}
            />
        </div>
    );
}
