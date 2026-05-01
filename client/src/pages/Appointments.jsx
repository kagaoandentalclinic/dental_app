import { useState, useEffect, useCallback, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, Plus,
    User, Trash2, Pencil, Phone,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { format, addDays, addWeeks, subWeeks, isSameDay, isToday } from 'date-fns';
import client from '../api/client';
import { useToast } from '../components/Toast';
import { formatName, debounce, capitalize } from '../utils/helpers';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import { VISIT_TYPES, APPOINTMENT_STATUSES, APPOINTMENT_STATUS_STYLES } from '../utils/constants';
import { flattenPatientDetail } from '../features/patient-form/utils';

// ── Calendar constants ────────────────────────────────────
const START_HOUR = 8;
const END_HOUR = 18;
const HOUR_HEIGHT = 64; // px per hour
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

// 30-minute bookable slots: 08:00 → 17:30
const TIME_SLOTS = [];
for (let h = START_HOUR; h < END_HOUR; h++) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

function formatSlotLabel(time) {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getWeekDays(monday) {
    return Array.from({ length: 6 }, (_, i) => addDays(monday, i)); // Mon–Sat
}

function apptPosition(appt) {
    const d = new Date(appt.appointment_date);
    const hour = d.getHours() + d.getMinutes() / 60;
    const top = Math.max(0, (hour - START_HOUR) * HOUR_HEIGHT);
    const height = Math.max(22, (appt.duration_minutes / 60) * HOUR_HEIGHT - 2);
    return { top, height };
}

// ── Appointment card ──────────────────────────────────────
function ApptCard({ appt, onClick }) {
    const style = APPOINTMENT_STATUS_STYLES[appt.status] || APPOINTMENT_STATUS_STYLES.scheduled;
    const { top, height } = apptPosition(appt);
    const time = format(new Date(appt.appointment_date), 'h:mm a');
    const name = `${appt.last_name}, ${appt.first_name}`;

    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(appt); }}
            className={`absolute left-0.5 right-0.5 rounded-lg border-l-4 px-1.5 py-0.5 text-left overflow-hidden
                        transition-opacity hover:opacity-90 cursor-pointer z-10
                        ${style.bg} ${style.border} ${style.text}`}
            style={{ top, height }}
            title={`${name} — ${time}`}
        >
            <p className="text-[11px] font-bold leading-tight truncate">{name}</p>
            {height >= 38 && (
                <p className="text-[10px] opacity-80 truncate">{time} · {capitalize(appt.appointment_type)}</p>
            )}
        </button>
    );
}

// ── Patient search input ──────────────────────────────────
function PatientSearch({ value, onChange, error }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [searching, setSearching] = useState(false);
    const wrapRef = useRef(null);

    const search = useCallback(debounce(async (q) => {
        if (!q.trim()) { setResults([]); return; }
        setSearching(true);
        try {
            const res = await client.get(`/patients?search=${encodeURIComponent(q)}&limit=8`);
            setResults(res.data.patients || []);
        } catch { setResults([]); }
        finally { setSearching(false); }
    }, 300), []);

    useEffect(() => {
        search(query);
        setOpen(true);
    }, [query]);

    useEffect(() => {
        function onClickOutside(e) {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    const select = (p) => {
        onChange(p);
        setQuery(formatName(p, 'last-first'));
        setOpen(false);
    };

    // Pre-fill query when editing an existing patient
    useEffect(() => {
        if (value?.last_name) setQuery(formatName(value, 'last-first'));
    }, [value?.id]);

    return (
        <div ref={wrapRef} className="relative">
            <input
                className={`form-input ${error ? 'border-red-400' : ''}`}
                placeholder="Search patient name…"
                value={query}
                onChange={(e) => { setQuery(e.target.value); onChange(null); }}
                onFocus={() => setOpen(true)}
                autoComplete="off"
            />
            {error && <p className="form-error">{error}</p>}
            {open && (query.trim() || searching) && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {searching && <p className="text-xs text-text-secondary px-3 py-2">Searching…</p>}
                    {!searching && results.length === 0 && query.trim() && (
                        <p className="text-xs text-text-secondary px-3 py-2">No patients found</p>
                    )}
                    {results.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-surface text-sm transition-colors"
                            onMouseDown={() => select(p)}
                        >
                            <span className="font-medium text-text-primary">{formatName(p, 'last-first')}</span>
                            {p.phone && <span className="text-text-secondary ml-2 text-xs">{p.phone}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Appointment form (create / edit) ─────────────────────
function AppointmentForm({ initial, staff, onSave, onClose }) {
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [bookedIntervals, setBookedIntervals] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);

    const [patient, setPatient] = useState(initial?.patient || null);
    const [form, setForm] = useState({
        dentist_id: initial?.dentist_id || '',
        date: initial?.appointment_date
            ? format(new Date(initial.appointment_date), 'yyyy-MM-dd')
            : format(initial?.prefillDate || new Date(), 'yyyy-MM-dd'),
        time: initial?.appointment_date
            ? format(new Date(initial.appointment_date), 'HH:mm')
            : initial?.prefillTime || '09:00',
        duration_minutes: String(initial?.duration_minutes || 60),
        appointment_type: initial?.appointment_type || 'checkup',
        status: initial?.status || 'scheduled',
        notes: initial?.notes || '',
    });

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    // Fetch booked slots whenever the selected date changes
    useEffect(() => {
        if (!form.date) return;
        setLoadingSlots(true);
        const dayStart = new Date(`${form.date}T00:00:00`);
        const dayEnd = new Date(`${form.date}T23:59:59`);
        const params = new URLSearchParams({
            start: dayStart.toISOString(),
            end: dayEnd.toISOString(),
        });
        if (initial?.id) params.set('exclude_id', initial.id);
        client.get(`/appointments/booked-times?${params}`)
            .then(r => setBookedIntervals(r.data))
            .catch(() => setBookedIntervals([]))
            .finally(() => setLoadingSlots(false));
    }, [form.date]);

    const isSlotTaken = (slotTime) => {
        const [h, m] = slotTime.split(':').map(Number);
        const slotStart = h * 60 + m;
        const slotEnd = slotStart + parseInt(form.duration_minutes || 60);
        return bookedIntervals.some(({ appointment_date, duration_minutes }) => {
            const d = new Date(appointment_date);
            const bookedStart = d.getHours() * 60 + d.getMinutes();
            const bookedEnd = bookedStart + duration_minutes;
            return slotStart < bookedEnd && slotEnd > bookedStart;
        });
    };

    const validate = () => {
        const errs = {};
        if (!patient) errs.patient = 'Patient is required';
        if (!form.date) errs.date = 'Date is required';
        if (!form.time) errs.time = 'Time is required';
        else if (isSlotTaken(form.time)) errs.time = 'This time slot is already booked';
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        const appointment_date = new Date(`${form.date}T${form.time}:00`).toISOString();
        const payload = {
            patient_id: patient.id,
            dentist_id: form.dentist_id || undefined,
            appointment_date,
            duration_minutes: parseInt(form.duration_minutes),
            appointment_type: form.appointment_type,
            status: form.status,
            notes: form.notes || null,
        };
        try {
            if (initial?.id) {
                await client.put(`/appointments/${initial.id}`, payload);
                toast.success('Appointment updated');
            } else {
                await client.post('/appointments', payload);
                toast.success('Appointment booked');
            }
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to save appointment');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Patient */}
            <div>
                <label className="form-label">Patient <span className="text-red-500">*</span></label>
                <PatientSearch value={patient} onChange={setPatient} error={errors.patient} />
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="form-label">Date <span className="text-red-500">*</span></label>
                    <input type="date" className={`form-input ${errors.date ? 'border-red-400' : ''}`}
                        value={form.date} onChange={set('date')} />
                    {errors.date && <p className="form-error">{errors.date}</p>}
                </div>
                <div>
                    <label className="form-label">Time <span className="text-red-500">*</span></label>
                    <select
                        className={`form-select ${errors.time ? 'border-red-400' : ''}`}
                        value={form.time}
                        onChange={set('time')}
                        disabled={loadingSlots}
                    >
                        {loadingSlots
                            ? <option>Loading…</option>
                            : (TIME_SLOTS.includes(form.time)
                                ? TIME_SLOTS
                                : [...TIME_SLOTS, form.time].sort()
                              ).map(slot => {
                                const taken = isSlotTaken(slot);
                                return (
                                    <option key={slot} value={slot} disabled={taken}>
                                        {formatSlotLabel(slot)}{taken ? ' — Taken' : ''}
                                    </option>
                                );
                              })
                        }
                    </select>
                    {errors.time && <p className="form-error">{errors.time}</p>}
                </div>
            </div>

            {/* Duration + Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="form-label">Duration</label>
                    <select className="form-select" value={form.duration_minutes} onChange={set('duration_minutes')}>
                        <option value="30">30 minutes</option>
                        <option value="60">1 hour</option>
                        <option value="90">1.5 hours</option>
                        <option value="120">2 hours</option>
                    </select>
                </div>
                <div>
                    <label className="form-label">Type</label>
                    <select className="form-select" value={form.appointment_type} onChange={set('appointment_type')}>
                        {VISIT_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Dentist */}
            <div>
                <label className="form-label">Dentist</label>
                <select className="form-select" value={form.dentist_id} onChange={set('dentist_id')}>
                    <option value="">— Assign dentist —</option>
                    {staff.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name} ({capitalize(s.role)})</option>
                    ))}
                </select>
            </div>

            {/* Status (edit only) */}
            {initial?.id && (
                <div>
                    <label className="form-label">Status</label>
                    <select className="form-select" value={form.status} onChange={set('status')}>
                        {APPOINTMENT_STATUSES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Notes */}
            <div>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" rows={2} value={form.notes} onChange={set('notes')}
                    placeholder="Any special instructions or concerns…" />
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>
                    {saving ? 'Saving…' : initial?.id ? 'Update Appointment' : 'Book Appointment'}
                </button>
            </div>
        </form>
    );
}

// ── Detail panel shown when clicking an appointment ──────
function ApptDetail({ appt, onEdit, onDelete, onClose }) {
    const style = APPOINTMENT_STATUS_STYLES[appt.status] || APPOINTMENT_STATUS_STYLES.scheduled;
    const statusLabel = APPOINTMENT_STATUSES.find(s => s.value === appt.status)?.label || appt.status;

    return (
        <div className="space-y-4">
            {/* Patient */}
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                    <p className="font-semibold text-text-primary">{appt.last_name}, {appt.first_name}</p>
                    {appt.phone && (
                        <p className="text-sm text-text-secondary flex items-center gap-1 mt-0.5">
                            <Phone className="w-3.5 h-3.5" /> {appt.phone}
                        </p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                    <p className="text-text-secondary text-xs font-medium mb-0.5">Date & Time</p>
                    <p className="text-text-primary font-medium">
                        {format(new Date(appt.appointment_date), 'MMM d, yyyy')}
                    </p>
                    <p className="text-text-secondary">
                        {format(new Date(appt.appointment_date), 'h:mm a')} · {appt.duration_minutes} min
                    </p>
                </div>
                <div>
                    <p className="text-text-secondary text-xs font-medium mb-0.5">Type</p>
                    <p className="text-text-primary font-medium capitalize">
                        {VISIT_TYPES.find(t => t.value === appt.appointment_type)?.label || appt.appointment_type}
                    </p>
                </div>
                {appt.dentist_name && (
                    <div>
                        <p className="text-text-secondary text-xs font-medium mb-0.5">Dentist</p>
                        <p className="text-text-primary">{appt.dentist_name}</p>
                    </div>
                )}
                <div>
                    <p className="text-text-secondary text-xs font-medium mb-0.5">Status</p>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full
                                    ${style.bg} ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        {statusLabel}
                    </span>
                </div>
            </div>

            {appt.notes && (
                <div>
                    <p className="text-text-secondary text-xs font-medium mb-0.5">Notes</p>
                    <p className="text-sm text-text-primary bg-surface rounded-lg px-3 py-2">{appt.notes}</p>
                </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-1">
                <button className="btn-ghost text-red-500 hover:bg-red-50 hover:text-red-600 text-sm w-full sm:w-auto"
                    onClick={onDelete}>
                    <Trash2 className="w-4 h-4" /> Delete
                </button>
                <div className="flex flex-col-reverse sm:flex-row gap-2">
                    <button className="btn-secondary text-sm w-full sm:w-auto" onClick={onClose}>Close</button>
                    <button className="btn-primary text-sm w-full sm:w-auto" onClick={onEdit}>
                        <Pencil className="w-4 h-4" /> Edit
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────
export default function Appointments() {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [staff, setStaff] = useState([]);
    const prefillPatientId = searchParams.get('patientId');
    const handledPrefillRef = useRef(null);

    // Modal state
    const [modal, setModal] = useState(null); // null | { mode: 'create'|'detail'|'edit', data }
    const [confirmDelete, setConfirmDelete] = useState(null);

    const weekDays = getWeekDays(weekStart);
    const gridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

    // Fetch staff once
    useEffect(() => {
        client.get('/appointments/staff')
            .then(r => setStaff(r.data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!prefillPatientId || handledPrefillRef.current === prefillPatientId) return;

        handledPrefillRef.current = prefillPatientId;
        let cancelled = false;

        client.get(`/patients/${prefillPatientId}`)
            .then((res) => {
                if (cancelled) return;
                setModal({ mode: 'create', data: { patient: flattenPatientDetail(res.data) } });
            })
            .catch(() => {
                if (!cancelled) toast.error('Failed to load patient for appointment');
            });

        return () => { cancelled = true; };
    }, [prefillPatientId, toast]);

    // Fetch appointments for current week
    const fetchAppointments = useCallback(async () => {
        setLoading(true);
        try {
            const start = weekStart.toISOString();
            const end = addDays(weekStart, 6).toISOString().replace('T00', 'T23').replace(/\d{2}:\d{2}Z$/, '59:59Z');
            const res = await client.get(`/appointments?start=${start}&end=${end}`);
            setAppointments(res.data);
        } catch {
            toast.error('Failed to load appointments');
        } finally {
            setLoading(false);
        }
    }, [weekStart]);

    useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

    // Get appointments for a specific day
    const dayAppointments = (day) =>
        appointments.filter(a => isSameDay(new Date(a.appointment_date), day));

    const handleSlotClick = (day, hour) => {
        const d = new Date(day);
        d.setHours(hour, 0, 0, 0);
        setModal({
            mode: 'create',
            data: {
                prefillDate: format(d, 'yyyy-MM-dd'),
                prefillTime: `${String(hour).padStart(2, '0')}:00`,
            },
        });
    };

    const handleApptClick = (appt) => {
        setModal({ mode: 'detail', data: appt });
    };

    const closeModal = () => {
        setModal(null);
        if (searchParams.has('patientId')) {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.delete('patientId');
            setSearchParams(nextParams, { replace: true });
        }
    };

    const handleDelete = async () => {
        try {
            await client.delete(`/appointments/${confirmDelete.id}`);
            toast.success('Appointment deleted');
            setConfirmDelete(null);
            setModal(null);
            fetchAppointments();
        } catch {
            toast.error('Failed to delete appointment');
        }
    };

    const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 5), 'MMM d, yyyy')}`;

    return (
        <div className="space-y-4 animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="font-display text-2xl font-bold text-text-primary">Appointments</h1>
                    <p className="text-text-secondary text-sm">Weekly schedule — Mon to Sat</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Week navigation */}
                    <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
                        <button className="p-1.5 rounded-lg hover:bg-bg transition-colors text-text-secondary"
                            onClick={() => setWeekStart(w => getMonday(subWeeks(w, 1)))}>
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            className="text-sm font-medium text-text-primary px-2 hover:text-primary transition-colors"
                            onClick={() => setWeekStart(getMonday(new Date()))}>
                            Today
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-bg transition-colors text-text-secondary"
                            onClick={() => setWeekStart(w => getMonday(addWeeks(w, 1)))}>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <span className="text-sm font-medium text-text-secondary hidden sm:block">{weekLabel}</span>
                    <button className="btn-primary" onClick={() => setModal({ mode: 'create', data: {} })}>
                        <Plus className="w-4 h-4" /> New Appointment
                    </button>
                </div>
            </div>

            {/* Week label (mobile) */}
            <p className="text-sm text-text-secondary sm:hidden text-center">{weekLabel}</p>

            {/* Calendar */}
            <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                        {/* Day headers */}
                        <div className="grid border-b border-border bg-surface" style={{ gridTemplateColumns: '52px repeat(6, 1fr)' }}>
                            <div className="py-2" />
                            {weekDays.map((day, i) => (
                                <div key={i}
                                    className={`py-2 px-1 text-center border-l border-border
                                                ${isToday(day) ? 'bg-primary/5' : ''}`}>
                                    <p className={`text-xs font-semibold uppercase tracking-wide
                                                  ${isToday(day) ? 'text-primary' : 'text-text-secondary'}`}>
                                        {format(day, 'EEE')}
                                    </p>
                                    <p className={`text-lg font-bold mt-0.5
                                                  ${isToday(day) ? 'text-primary' : 'text-text-primary'}`}>
                                        {format(day, 'd')}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Time grid */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <LoadingSpinner />
                            </div>
                        ) : (
                            <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
                                <div className="grid" style={{ gridTemplateColumns: '52px repeat(6, 1fr)', height: gridHeight }}>
                                    {/* Time labels column */}
                                    <div className="relative border-r border-border/50">
                                        {HOURS.map(h => (
                                            <div key={h} className="absolute w-full flex items-start justify-end pr-1.5"
                                                style={{ top: Math.max(0, (h - START_HOUR) * HOUR_HEIGHT - 8), height: HOUR_HEIGHT }}>
                                                <span className="text-[10px] text-text-secondary font-medium">
                                                    {h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Day columns */}
                                    {weekDays.map((day, di) => (
                                        <div key={di}
                                            className={`relative border-l border-border/50
                                                        ${isToday(day) ? 'bg-primary/[0.02]' : ''}`}
                                            style={{ height: gridHeight }}>
                                            {/* Hour slot lines + click zones */}
                                            {HOURS.map(h => (
                                                <div key={h}
                                                    className="absolute w-full border-t border-border/40 hover:bg-primary/5 cursor-pointer transition-colors"
                                                    style={{ top: (h - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                                                    onClick={() => handleSlotClick(day, h)}
                                                />
                                            ))}
                                            {/* Appointments */}
                                            {dayAppointments(day).map(appt => (
                                                <ApptCard key={appt.id} appt={appt} onClick={handleApptClick} />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 flex-wrap text-xs text-text-secondary">
                {Object.entries(APPOINTMENT_STATUS_STYLES).map(([key, s]) => (
                    <span key={key} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                        {APPOINTMENT_STATUSES.find(a => a.value === key)?.label}
                    </span>
                ))}
            </div>

            {/* Modals */}
            {modal?.mode === 'create' && (
                <Modal isOpen title="Book Appointment" onClose={closeModal}>
                    <AppointmentForm
                        initial={modal.data}
                        staff={staff}
                        onSave={() => { closeModal(); fetchAppointments(); }}
                        onClose={closeModal}
                    />
                </Modal>
            )}

            {modal?.mode === 'detail' && (
                <Modal isOpen title="Appointment Details" onClose={closeModal}>
                    <ApptDetail
                        appt={modal.data}
                        onClose={closeModal}
                        onEdit={() => setModal({ mode: 'edit', data: modal.data })}
                        onDelete={() => setConfirmDelete(modal.data)}
                    />
                </Modal>
            )}

            {modal?.mode === 'edit' && (
                <Modal isOpen title="Edit Appointment" onClose={closeModal}>
                    <AppointmentForm
                        initial={{
                            ...modal.data,
                            patient: {
                                id: modal.data.patient_id,
                                first_name: modal.data.first_name,
                                last_name: modal.data.last_name,
                                phone: modal.data.phone,
                            },
                        }}
                        staff={staff}
                        onSave={() => { closeModal(); fetchAppointments(); }}
                        onClose={closeModal}
                    />
                </Modal>
            )}

            <ConfirmDialog
                isOpen={!!confirmDelete}
                title="Delete Appointment"
                message={confirmDelete
                    ? `Delete appointment for ${confirmDelete.last_name}, ${confirmDelete.first_name}? This cannot be undone.`
                    : ''}
                confirmLabel="Delete"
                onConfirm={handleDelete}
                onCancel={() => setConfirmDelete(null)}
            />
        </div>
    );
}
