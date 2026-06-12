import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import portalClient from '../api/portalClient';
import { capitalize, formatDateTime } from '../utils/helpers';

export default function PortalHistory() {
    const [rows, setRows] = useState([]);

    useEffect(() => {
        portalClient.get('/portal/history').then(res => setRows(res.data));
    }, []);

    return (
        <div className="card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">Appointment History</h2>
                    <p className="mt-2 text-sm text-text-secondary">Review your past appointments and statuses.</p>
                </div>
                <Link to="/portal/dashboard" className="btn-secondary w-full justify-center sm:w-auto">Back to Dashboard</Link>
            </div>

            {rows.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                    <p className="text-lg font-semibold text-text-primary">No visits yet. Book your first appointment!</p>
                </div>
            ) : (
                <div className="mt-8">
                    <div className="space-y-3 md:hidden">
                        {rows.map((row, index) => (
                            <div key={`${row.appointment_date}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Appointment</p>
                                <p className="mt-2 text-sm font-semibold text-text-primary">{formatDateTime(row.appointment_date)}</p>
                                <p className="mt-2 text-sm text-text-secondary">{row.appointment_type}</p>
                                <p className="mt-2 text-sm text-text-primary">{capitalize(row.status)}</p>
                                <p className="mt-2 text-sm text-text-secondary">{row.notes || '-'}</p>
                            </div>
                        ))}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Service</th>
                                    <th>Status</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, index) => (
                                    <tr key={`${row.appointment_date}-${index}`}>
                                        <td>{formatDateTime(row.appointment_date)}</td>
                                        <td>{row.appointment_type}</td>
                                        <td>{capitalize(row.status)}</td>
                                        <td>{row.notes || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
