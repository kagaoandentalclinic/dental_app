import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Save, RefreshCw, Plus, Trash2, X } from 'lucide-react';
import Odontogram from 'react-odontogram';
import 'react-odontogram/style.css';
import client from '../../api/client';
import { useToast } from '../../components/Toast';
import { TOOTH_STATUSES, TOOTH_STATUS_MAP } from '../../utils/constants';
import ToothStatusModal from './ToothStatusModal';
import ConfirmDialog from '../../components/ConfirmDialog';

const STANDARD_TOOTH_NUMBERS = Array.from({ length: 32 }, (_, index) => index + 1);
const NOTATION_OPTIONS = ['Universal', 'FDI', 'Palmer'];
const ISSUE_STATUS_VALUES = new Set(['cavity', 'root_fragment']);
const UNIVERSAL_TO_FDI = {
    1: '18', 2: '17', 3: '16', 4: '15', 5: '14', 6: '13', 7: '12', 8: '11',
    9: '21', 10: '22', 11: '23', 12: '24', 13: '25', 14: '26', 15: '27', 16: '28',
    17: '38', 18: '37', 19: '36', 20: '35', 21: '34', 22: '33', 23: '32', 24: '31',
    25: '41', 26: '42', 27: '43', 28: '44', 29: '45', 30: '46', 31: '47', 32: '48',
};
const FDI_TO_UNIVERSAL = Object.fromEntries(
    Object.entries(UNIVERSAL_TO_FDI).map(([universal, fdi]) => [fdi, Number(universal)])
);
const UNIVERSAL_TO_NAME = {
    1: 'Upper Right Third Molar', 2: 'Upper Right Second Molar', 3: 'Upper Right First Molar',
    4: 'Upper Right Second Premolar', 5: 'Upper Right First Premolar', 6: 'Upper Right Canine',
    7: 'Upper Right Lateral Incisor', 8: 'Upper Right Central Incisor',
    9: 'Upper Left Central Incisor', 10: 'Upper Left Lateral Incisor', 11: 'Upper Left Canine',
    12: 'Upper Left First Premolar', 13: 'Upper Left Second Premolar', 14: 'Upper Left First Molar',
    15: 'Upper Left Second Molar', 16: 'Upper Left Third Molar',
    17: 'Lower Left Third Molar', 18: 'Lower Left Second Molar', 19: 'Lower Left First Molar',
    20: 'Lower Left Second Premolar', 21: 'Lower Left First Premolar', 22: 'Lower Left Canine',
    23: 'Lower Left Lateral Incisor', 24: 'Lower Left Central Incisor',
    25: 'Lower Right Central Incisor', 26: 'Lower Right Lateral Incisor', 27: 'Lower Right Canine',
    28: 'Lower Right First Premolar', 29: 'Lower Right Second Premolar', 30: 'Lower Right First Molar',
    31: 'Lower Right Second Molar', 32: 'Lower Right Third Molar',
};

export default function DentalChartTab({ patient }) {
    const toast = useToast();
    const [teeth, setTeeth] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [changes, setChanges] = useState({});
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [notation, setNotation] = useState('Universal');
    const [odontogramResetKey, setOdontogramResetKey] = useState(0);
    const [viewportMode, setViewportMode] = useState('desktop');

    // Extra teeth state
    const [addExtraOpen, setAddExtraOpen] = useState(false);
    const [extraLabel, setExtraLabel] = useState('');
    const [addingExtra, setAddingExtra] = useState(false);
    const [deleteExtraTarget, setDeleteExtraTarget] = useState(null);

    const fetchChart = useCallback(async () => {
        setLoading(true);
        try {
            const res = await client.get(`/patients/${patient.id}/dental-chart`);
            const map = {};
            res.data.forEach(t => { map[t.tooth_number] = t; });
            setTeeth(map);
            setChanges({});
        } finally {
            setLoading(false);
        }
    }, [patient.id]);

    useEffect(() => { fetchChart(); }, [fetchChart]);

    useEffect(() => {
        const updateViewportMode = () => {
            if (window.innerWidth < 640) {
                setViewportMode('mobile');
            } else if (window.innerWidth < 1024) {
                setViewportMode('tablet');
            } else {
                setViewportMode('desktop');
            }
        };

        updateViewportMode();
        window.addEventListener('resize', updateViewportMode);
        return () => window.removeEventListener('resize', updateViewportMode);
    }, []);

    const getTooth = (num) => {
        const change = changes[num];
        const base = teeth[num];
        if (change) return { ...(base || {}), ...change };
        return base || { tooth_number: num, status: 'healthy' };
    };

    const handleToothUpdate = (num, update) => {
        setChanges(prev => ({
            ...prev,
            [num]: { ...(prev[num] || {}), tooth_number: num, ...update },
        }));
        setSelectedTooth(null);
        setOdontogramResetKey(v => v + 1);
    };

    const handleSave = async () => {
        if (Object.keys(changes).length === 0) { toast.info('No changes to save'); return; }
        setSaving(true);
        try {
            const teethArr = Object.values(changes);
            await client.put(`/patients/${patient.id}/dental-chart/bulk`, { teeth: teethArr });
            toast.success('Dental chart saved!');
            await fetchChart();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save chart');
        } finally {
            setSaving(false);
        }
    };

    const extraTeeth = Object.values(teeth).filter(t => t.is_extra);
    const currentExtraTeeth = extraTeeth.map(et => (
        changes[et.tooth_number] ? { ...et, ...changes[et.tooth_number] } : et
    ));

    const handleAddExtra = async () => {
        if (!extraLabel.trim()) return;
        setAddingExtra(true);
        try {
            const res = await client.post(`/patients/${patient.id}/dental-chart/extra`, { extra_label: extraLabel.trim() });
            setTeeth(prev => ({ ...prev, [res.data.tooth_number]: res.data }));
            setExtraLabel('');
            setAddExtraOpen(false);
            toast.success('Extra tooth added');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to add extra tooth');
        } finally {
            setAddingExtra(false);
        }
    };

    const handleDeleteExtra = async () => {
        if (!deleteExtraTarget) return;
        try {
            await client.delete(`/patients/${patient.id}/dental-chart/${deleteExtraTarget.tooth_number}`);
            setTeeth(prev => {
                const next = { ...prev };
                delete next[deleteExtraTarget.tooth_number];
                return next;
            });
            toast.success('Extra tooth removed');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to remove extra tooth');
        } finally {
            setDeleteExtraTarget(null);
        }
    };

    const handleOdontogramChange = (selected) => {
        const active = selected[selected.length - 1];
        if (!active) {
            setSelectedTooth(null);
            return;
        }

        const universalNumber = FDI_TO_UNIVERSAL[active.notations.fdi];
        if (!universalNumber) return;

        setSelectedTooth({
            number: universalNumber,
            tooth: getTooth(universalNumber),
        });
    };

    const standardTeeth = STANDARD_TOOTH_NUMBERS.map(getTooth);
    const allTeeth = [...standardTeeth, ...currentExtraTeeth];
    const healthy = allTeeth.filter(t => t.status === 'healthy').length;
    const issues = allTeeth.filter(t => ISSUE_STATUS_VALUES.has(t.status)).length;
    const hasChanges = Object.keys(changes).length > 0;
    const isMobile = viewportMode === 'mobile';
    const isTablet = viewportMode === 'tablet';
    const odontogramLayout = isMobile ? 'square' : 'circle';
    const odontogramTooltipPlacement = isMobile ? 'bottom' : 'top';
    const odontogramMaxWidth = isMobile ? 560 : isTablet ? 760 : 860;
    const odontogramConditions = TOOTH_STATUSES
        .filter(status => status.value !== 'healthy')
        .map(status => ({
            label: status.label,
            teeth: standardTeeth
                .filter(tooth => tooth.status === status.value)
                .map(tooth => `teeth-${UNIVERSAL_TO_FDI[tooth.tooth_number]}`),
            fillColor: status.bg,
            outlineColor: status.color,
        }))
        .filter(group => group.teeth.length > 0);

    const renderTooltip = (payload) => {
        if (!payload) return null;

        const universalNumber = FDI_TO_UNIVERSAL[payload.notations.fdi];
        const tooth = universalNumber ? getTooth(universalNumber) : null;
        const statusConfig = TOOTH_STATUS_MAP[tooth?.status || 'healthy'] || TOOTH_STATUS_MAP.healthy;

        return (
            <div className="min-w-[180px] max-w-[240px] whitespace-normal">
                <p className="font-semibold text-sm">
                    {UNIVERSAL_TO_NAME[universalNumber] || `Tooth ${payload.notations.universal}`}
                </p>
                <p className="text-xs mt-1">
                    {notation}: {notation === 'FDI'
                        ? payload.notations.fdi
                        : notation === 'Palmer'
                            ? payload.notations.palmer
                            : payload.notations.universal}
                </p>
                <p className="text-xs mt-1">
                    Status:{' '}
                    <span style={{ color: statusConfig.text, fontWeight: 600 }}>
                        {statusConfig.label}
                    </span>
                </p>
                {tooth?.notes && (
                    <p className="text-xs mt-1 leading-relaxed">
                        {tooth.notes}
                    </p>
                )}
                <p className="text-[11px] mt-2 opacity-80">
                    FDI: {payload.notations.fdi} · Universal: {payload.notations.universal}
                </p>
            </div>
        );
    };

    return (
        <div className="space-y-5">
            {/* Chart container */}
            <div className="card">
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-semibold text-text-primary">Interactive Dental Chart</h2>
                        <p className="text-xs text-text-secondary">
                            {isMobile
                                ? 'Tap any tooth to update its status. Mobile uses a compact layout for easier viewing.'
                                : 'Click any tooth in the odontogram to update its status.'}
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                        <select
                            className="form-input text-sm w-full sm:w-[160px]"
                            value={notation}
                            onChange={e => setNotation(e.target.value)}
                        >
                            {NOTATION_OPTIONS.map(option => (
                                <option key={option} value={option}>{option} Notation</option>
                            ))}
                        </select>
                        <button className="btn-ghost text-xs" onClick={fetchChart} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            className={`btn-primary text-sm flex-1 sm:flex-none ${!hasChanges ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={handleSave}
                            disabled={!hasChanges || saving}
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : `Save ${hasChanges ? `(${Object.keys(changes).length})` : ''}`}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="text-text-secondary text-sm">Loading dental chart...</div>
                    </div>
                ) : (
                    <div className="rounded-3xl border border-border/50 bg-gradient-to-b from-pink-50/60 via-white to-white p-3 sm:p-5 lg:p-6 overflow-x-auto">
                        <div className={`${isMobile ? 'min-w-[520px]' : 'min-w-0'} mx-auto w-full`}>
                            <div className={`flex justify-between ${isMobile ? 'px-2 pb-3' : 'px-6 pb-2'}`}>
                                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Patient's Right</span>
                                <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Patient's Left</span>
                            </div>
                            <Odontogram
                                key={odontogramResetKey}
                                singleSelect
                                notation={notation}
                                layout={odontogramLayout}
                                defaultSelected={
                                    selectedTooth && !selectedTooth.isExtra
                                        ? [`teeth-${UNIVERSAL_TO_FDI[selectedTooth.number]}`]
                                        : []
                                }
                                onChange={handleOdontogramChange}
                                teethConditions={odontogramConditions}
                                showLabels
                                tooltip={{ placement: odontogramTooltipPlacement, content: renderTooltip }}
                                className="w-full"
                                colors={{
                                    darkBlue: '#0a6352',
                                    baseBlue: '#96b7af',
                                    lightBlue: '#d9eee8',
                                }}
                                styles={{ maxWidth: odontogramMaxWidth }}
                            />
                            <p className="text-xs text-text-secondary mt-3 text-center">
                                Healthy teeth use the default odontogram outline. Colored teeth indicate saved or unsaved chart conditions.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total Teeth', value: 32 + extraTeeth.length, color: 'bg-primary/10 text-primary' },
                    { label: 'Healthy', value: healthy, color: 'bg-green-50 text-green-700' },
                    { label: 'Issues', value: issues, color: 'bg-red-50 text-red-700' },
                    { label: 'Total Visits', value: patient.total_visits || 0, color: 'bg-blue-50 text-blue-700' },
                ].map((s, i) => (
                    <motion.div
                        key={s.label}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`card-sm text-center ${s.color}`}
                    >
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-xs font-medium mt-0.5">{s.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* Extra / Supernumerary Teeth */}
            <div className="card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h3 className="font-semibold text-text-primary">Extra / Supernumerary Teeth</h3>
                        <p className="text-xs text-text-secondary mt-0.5">
                            {extraTeeth.length === 0 ? 'No extra teeth recorded' : `${extraTeeth.length} extra tooth${extraTeeth.length !== 1 ? 'teeth' : ''} recorded`}
                        </p>
                    </div>
                    <button className="btn-primary text-sm w-full sm:w-auto" onClick={() => { setExtraLabel(''); setAddExtraOpen(true); }}>
                        <Plus className="w-4 h-4" /> Add Extra Tooth
                    </button>
                </div>

                {extraTeeth.length === 0 ? (
                    <p className="text-sm text-text-secondary text-center py-4 border border-dashed border-border rounded-xl">
                        No supernumerary teeth. Click "Add Extra Tooth" if the patient has more than 32 teeth.
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {extraTeeth.map((et, i) => {
                            const cfg = TOOTH_STATUS_MAP[et.status] || TOOTH_STATUS_MAP.healthy;
                            const change = changes[et.tooth_number];
                            const current = change ? { ...et, ...change } : et;
                            const currentCfg = TOOTH_STATUS_MAP[current.status] || TOOTH_STATUS_MAP.healthy;
                            return (
                                <motion.div
                                    key={et.tooth_number}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="relative border border-border rounded-xl p-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all group"
                                    style={{ backgroundColor: currentCfg.bg }}
                                    onClick={() => setSelectedTooth({ number: et.tooth_number, tooth: current, isExtra: true })}
                                >
                                    <button
                                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 z-10"
                                        onClick={(e) => { e.stopPropagation(); setDeleteExtraTarget(et); }}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                    <p className="text-xs font-bold text-text-secondary mb-1">#{et.tooth_number}</p>
                                    <p className="text-sm font-semibold text-text-primary leading-tight pr-5">{et.extra_label}</p>
                                    <span
                                        className="inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded-full"
                                        style={{ backgroundColor: currentCfg.bg, color: currentCfg.text, border: `1px solid ${currentCfg.color}` }}
                                    >
                                        {currentCfg.label}
                                    </span>
                                    {changes[et.tooth_number] && (
                                        <span className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-amber-400" />
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Extra Tooth modal */}
            {addExtraOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                            <h3 className="font-semibold text-text-primary">Add Extra Tooth</h3>
                            <button className="p-1 rounded-lg hover:bg-surface" onClick={() => setAddExtraOpen(false)}>
                                <X className="w-5 h-5 text-text-secondary" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-text-secondary">
                                Give this supernumerary tooth a descriptive label, e.g. "Mesiodens", "Upper Right 4th Molar", "Lower Extra Premolar".
                            </p>
                            <div>
                                <label className="form-label">Tooth Label <span className="text-red-500">*</span></label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Mesiodens, 4th Molar..."
                                    value={extraLabel}
                                    onChange={e => setExtraLabel(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddExtra()}
                                    autoFocus
                                />
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row gap-3">
                                <button className="btn-ghost flex-1" onClick={() => setAddExtraOpen(false)}>Cancel</button>
                                <button
                                    className="btn-primary flex-1"
                                    onClick={handleAddExtra}
                                    disabled={!extraLabel.trim() || addingExtra}
                                >
                                    {addingExtra ? 'Adding...' : 'Add Tooth'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tooth status modal */}
            {selectedTooth && (
                <ToothStatusModal
                    tooth={selectedTooth}
                    onSave={handleToothUpdate}
                    onClose={() => {
                        setSelectedTooth(null);
                        setOdontogramResetKey(v => v + 1);
                    }}
                />
            )}

            {/* Delete extra tooth confirm */}
            <ConfirmDialog
                isOpen={!!deleteExtraTarget}
                title="Remove Extra Tooth"
                message={`Remove "${deleteExtraTarget?.extra_label}" (tooth #${deleteExtraTarget?.tooth_number}) from this patient's chart?`}
                confirmLabel="Remove"
                onConfirm={handleDeleteExtra}
                onCancel={() => setDeleteExtraTarget(null)}
            />
        </div>
    );
}
