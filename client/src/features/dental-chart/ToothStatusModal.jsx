import { useState } from 'react';
import Modal from '../../components/Modal';
import { TOOTH_STATUSES, TOOTH_NAMES } from '../../utils/constants';

export default function ToothStatusModal({ tooth, notation = 'Universal', displayNumber, toothName, onSave, onClose }) {
    const { number, tooth: toothData, isExtra } = tooth;
    const [status, setStatus] = useState(toothData?.status || 'healthy');
    const [notes, setNotes] = useState(toothData?.notes || '');

    const handleSave = () => {
        onSave(number, { status, notes: notes || null });
    };

    const title = isExtra
        ? `${toothData?.extra_label || 'Extra Tooth'} (#${number})`
        : `Tooth ${displayNumber || number}`;

    const subtitle = isExtra
        ? 'Supernumerary tooth'
        : `${notation} notation${toothName || TOOTH_NAMES[number] ? ` · ${toothName || TOOTH_NAMES[number]}` : ''}`;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <button className="btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn-primary" onClick={handleSave}>Apply</button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-text-secondary">{subtitle}</p>
                <div>
                    <label className="form-label">Status</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                        {TOOTH_STATUSES.map(s => (
                            <button
                                key={s.value}
                                type="button"
                                onClick={() => setStatus(s.value)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all ${
                                    status === s.value
                                        ? 'border-primary ring-2 ring-primary/20'
                                        : 'border-border hover:border-primary/40'
                                }`}
                                style={status === s.value ? { backgroundColor: s.bg, color: s.text } : {}}
                            >
                                <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: s.color }}
                                />
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="form-label">Notes</label>
                    <textarea
                        className="form-textarea"
                        rows={2}
                        placeholder="Optional notes for this tooth..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                    />
                </div>
            </div>
        </Modal>
    );
}
