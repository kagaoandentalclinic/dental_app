import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import portalClient from '../api/portalClient';

const SERVICES = ['Checkup', 'Cleaning', 'Extraction', 'Braces Consultation', 'Tooth Filling', 'Root Canal', 'Whitening', 'Other'];
const START_HOUR = 8;
const END_HOUR = 18;
const DEFAULT_TIME = '09:00';
const DEFAULT_DURATION_MINUTES = 60;

function isSundayDate(dateText) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateText || ''))) return false;
    return new Date(`${dateText}T12:00:00`).getDay() === 0;
}

function formatTimeOptionLabel(slot) {
    const [hourText, minuteText] = String(slot || '').split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText || 0);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return slot;

    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 || 12;
    return `${normalizedHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export default function PortalBook() {
    const [form, setForm] = useState({
        preferred_date: '',
        preferred_time: DEFAULT_TIME,
        service: 'Checkup',
        notes: '',
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [bookedIntervals, setBookedIntervals] = useState([]);

    const timeSlots = useMemo(() => {
        const slots = [];
        for (let hour = START_HOUR; hour < END_HOUR; hour += 1) {
            slots.push(`${String(hour).padStart(2, '0')}:00`);
            slots.push(`${String(hour).padStart(2, '0')}:30`);
        }
        return slots;
    }, []);

    useEffect(() => {
        if (!form.preferred_date) {
            setBookedIntervals([]);
            return;
        }
        if (isSundayDate(form.preferred_date)) {
            setBookedIntervals([]);
            return;
        }

        let active = true;
        setLoadingSlots(true);

        const dayStart = new Date(`${form.preferred_date}T00:00:00`);
        const dayEnd = new Date(`${form.preferred_date}T23:59:59`);
        const params = new URLSearchParams({
            start: dayStart.toISOString(),
            end: dayEnd.toISOString(),
        });

        portalClient.get(`/portal/booked-times?${params.toString()}`)
            .then((res) => {
                if (active) {
                    setBookedIntervals(res.data || []);
                }
            })
            .catch(() => {
                if (active) {
                    setBookedIntervals([]);
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingSlots(false);
                }
            });

        return () => {
            active = false;
        };
    }, [form.preferred_date]);

    const isSlotTaken = (slotTime) => {
        const [hour, minute] = String(slotTime || '').split(':').map(Number);
        const slotStart = hour * 60 + minute;
        const slotEnd = slotStart + DEFAULT_DURATION_MINUTES;

        return bookedIntervals.some(({ appointment_date, duration_minutes }) => {
            const bookedDate = new Date(appointment_date);
            const bookedStart = bookedDate.getHours() * 60 + bookedDate.getMinutes();
            const bookedEnd = bookedStart + Number(duration_minutes || 60);
            return slotStart < bookedEnd && slotEnd > bookedStart;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        if (isSundayDate(form.preferred_date)) {
            setError('Sunday bookings are unavailable. Please choose Monday to Saturday.');
            setLoading(false);
            return;
        }
        if (form.preferred_date && isSlotTaken(form.preferred_time)) {
            setError('That time slot is already taken for the selected duration.');
            setLoading(false);
            return;
        }
        try {
            const res = await portalClient.post('/portal/book', form);
            setMessage(res.data.message || 'Your appointment request has been sent!');
            setForm({
                preferred_date: '',
                preferred_time: DEFAULT_TIME,
                service: 'Checkup',
                notes: '',
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send appointment request');
        } finally {
            setLoading(false);
        }
    };

    const handleDateChange = (value) => {
        setMessage('');
        if (isSundayDate(value)) {
            setBookedIntervals([]);
            setError('Sunday bookings are unavailable. Please choose Monday to Saturday.');
            setForm((f) => ({ ...f, preferred_date: '', preferred_time: DEFAULT_TIME }));
            return;
        }

        setError('');
        setForm((f) => ({ ...f, preferred_date: value, preferred_time: DEFAULT_TIME }));
    };

    return (
        <div className="card max-w-3xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">Book Appointment</h2>
                    <p className="mt-2 text-sm text-text-secondary">Choose your preferred date, time, and service.</p>
                </div>
                <Link to="/portal/dashboard" className="btn-secondary w-full justify-center sm:w-auto">Back to Dashboard</Link>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="form-label">Preferred Date</label>
                    <input type="date" min={new Date().toISOString().slice(0, 10)} className="form-input" value={form.preferred_date} onChange={(e) => handleDateChange(e.target.value)} />
                    <p className="mt-1 text-xs text-slate-500">Bookings are available Monday to Saturday only.</p>
                </div>
                <div>
                    <label className="form-label">Preferred Time</label>
                    <select
                        className="form-select"
                        value={form.preferred_time}
                        onChange={(e) => setForm(f => ({ ...f, preferred_time: e.target.value }))}
                        disabled={loadingSlots || !form.preferred_date || isSundayDate(form.preferred_date)}
                    >
                        {!form.preferred_date && <option value={form.preferred_time}>Select a date first</option>}
                        {form.preferred_date && loadingSlots && <option value={form.preferred_time}>Loading available times...</option>}
                        {form.preferred_date && !loadingSlots && (timeSlots.includes(form.preferred_time)
                            ? timeSlots
                            : [...timeSlots, form.preferred_time].sort()
                        ).map((slot) => {
                            const taken = isSlotTaken(slot);
                            return (
                                <option key={slot} value={slot} disabled={taken}>
                                    {formatTimeOptionLabel(slot)}{taken ? ' - Taken' : ''}
                                </option>
                            );
                        })}
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className="form-label">Service / Concern</label>
                    <select className="form-select" value={form.service} onChange={(e) => setForm(f => ({ ...f, service: e.target.value }))}>
                        {SERVICES.map(service => <option key={service} value={service}>{service}</option>)}
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className="form-label">Additional Notes</label>
                    <textarea rows="4" className="form-input" value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                {error && <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                {message && <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
                <div className="sm:col-span-2">
                    <button type="submit" disabled={loading} className="btn-primary w-full justify-center sm:w-auto">{loading ? 'Sending...' : 'Send Appointment Request'}</button>
                </div>
            </form>
        </div>
    );
}
