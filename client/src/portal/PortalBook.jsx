import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import portalClient from '../api/portalClient';

const SERVICES = ['Checkup', 'Cleaning', 'Extraction', 'Braces Consultation', 'Tooth Filling', 'Root Canal', 'Whitening', 'Other'];

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
        preferred_time: '09:00',
        service: 'Checkup',
        notes: '',
    });
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const timeSlots = useMemo(() => {
        const slots = [];
        for (let hour = 9; hour <= 17; hour += 1) {
            slots.push(`${String(hour).padStart(2, '0')}:00`);
        }
        return slots;
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        try {
            const res = await portalClient.post('/portal/book', form);
            setMessage(res.data.message || 'Your appointment request has been sent!');
            setForm({ preferred_date: '', preferred_time: '09:00', service: 'Checkup', notes: '' });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send appointment request');
        } finally {
            setLoading(false);
        }
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
                    <input type="date" min={new Date().toISOString().slice(0, 10)} className="form-input" value={form.preferred_date} onChange={(e) => setForm(f => ({ ...f, preferred_date: e.target.value }))} />
                </div>
                <div>
                    <label className="form-label">Preferred Time</label>
                    <select className="form-input" value={form.preferred_time} onChange={(e) => setForm(f => ({ ...f, preferred_time: e.target.value }))}>
                        {timeSlots.map(slot => <option key={slot} value={slot}>{formatTimeOptionLabel(slot)}</option>)}
                    </select>
                </div>
                <div className="sm:col-span-2">
                    <label className="form-label">Service / Concern</label>
                    <select className="form-input" value={form.service} onChange={(e) => setForm(f => ({ ...f, service: e.target.value }))}>
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
