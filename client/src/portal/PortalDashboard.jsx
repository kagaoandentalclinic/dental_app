import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import portalClient from '../api/portalClient';
import { usePortalAuth } from '../context/PortalAuthContext';
import { formatCurrency, formatDateTime, formatDate } from '../utils/helpers';

export default function PortalDashboard() {
    const { patient } = usePortalAuth();
    const [data, setData] = useState(null);

    useEffect(() => {
        portalClient.get('/portal/dashboard').then(res => setData(res.data));
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-text-primary sm:text-3xl">Hello, {patient?.first_name}</h2>
                <p className="mt-2 text-sm text-text-secondary sm:text-base">Here is a quick look at your account and appointments.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <div className="card">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Upcoming Appointment</p>
                    <p className="mt-4 text-lg font-semibold text-text-primary">{data?.upcoming_appointment ? formatDateTime(data.upcoming_appointment.appointment_date) : 'None scheduled'}</p>
                    {data?.upcoming_appointment && <p className="mt-1 text-sm text-text-secondary">{data.upcoming_appointment.appointment_type}</p>}
                </div>
                <div className="card">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Last Visit</p>
                    <p className="mt-4 text-lg font-semibold text-text-primary">{data?.last_visit ? formatDate(data.last_visit) : 'No visits yet'}</p>
                </div>
                <div className="card">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Outstanding Balance</p>
                    <p className="mt-4 text-lg font-semibold text-text-primary">{data && Number(data.outstanding_balance) > 0 ? formatCurrency(data.outstanding_balance) : 'No balance'}</p>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Link to="/portal/book" className="card transition-colors hover:border-primary">
                    <h3 className="text-lg font-semibold text-text-primary">Book Appointment</h3>
                    <p className="mt-2 text-sm text-text-secondary">Request your next visit in a few taps.</p>
                </Link>
                <Link to="/portal/history" className="card transition-colors hover:border-primary">
                    <h3 className="text-lg font-semibold text-text-primary">View History</h3>
                    <p className="mt-2 text-sm text-text-secondary">Review your past appointments and statuses.</p>
                </Link>
                <Link to="/portal/profile" className="card transition-colors hover:border-primary">
                    <h3 className="text-lg font-semibold text-text-primary">Edit Profile</h3>
                    <p className="mt-2 text-sm text-text-secondary">Update your contact details and emergency contact.</p>
                </Link>
            </div>
        </div>
    );
}
