import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import portalClient from '../api/portalClient';
import { usePortalAuth } from '../context/PortalAuthContext';
import { formatDate } from '../utils/helpers';

export default function PortalProfile() {
    const { patient, fetchMe } = usePortalAuth();
    const [form, setForm] = useState({
        email: '',
        phone: '',
        address: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
    });
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (patient) {
            setForm({
                email: patient.portal_email || '',
                phone: patient.phone || '',
                address: patient.address || '',
                emergency_contact_name: patient.emergency_contact_name || '',
                emergency_contact_phone: patient.emergency_contact_phone || '',
            });
        }
    }, [patient]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');
        try {
            await portalClient.put('/portal/profile', form);
            await fetchMe();
            setMessage('Profile updated successfully.');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card max-w-4xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">Edit Profile</h2>
                    <p className="mt-2 text-sm text-text-secondary">Keep your contact information up to date.</p>
                </div>
                <Link to="/portal/dashboard" className="btn-secondary w-full justify-center sm:w-auto">Back to Dashboard</Link>
            </div>

            <div className="mt-8 grid gap-4 rounded-2xl bg-slate-50 p-5 sm:grid-cols-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Full Name</p>
                    <p className="mt-2 text-sm font-semibold text-text-primary">{patient?.full_name}</p>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Date of Birth</p>
                    <p className="mt-2 text-sm font-semibold text-text-primary">{formatDate(patient?.date_of_birth)}</p>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-secondary">Patient ID</p>
                    <p className="mt-2 text-sm font-semibold text-text-primary">{patient?.id}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 grid gap-4 sm:grid-cols-2">
                <div>
                    <label className="form-label">Email</label>
                    <input type="email" className="form-input" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                    <label className="form-label">Address</label>
                    <input className="form-input" value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                    <label className="form-label">Emergency Contact Name</label>
                    <input className="form-input" value={form.emergency_contact_name} onChange={(e) => setForm(f => ({ ...f, emergency_contact_name: e.target.value }))} />
                </div>
                <div>
                    <label className="form-label">Emergency Contact Phone</label>
                    <input className="form-input" value={form.emergency_contact_phone} onChange={(e) => setForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} />
                </div>
                {error && <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
                {message && <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>}
                <div className="sm:col-span-2">
                    <button type="submit" disabled={loading} className="btn-primary w-full justify-center sm:w-auto">{loading ? 'Saving…' : 'Save Changes'}</button>
                </div>
            </form>
        </div>
    );
}
