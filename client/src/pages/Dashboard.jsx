import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Calendar, Clock, Banknote, Eye, AlertTriangle } from 'lucide-react';
import client from '../api/client';
import { formatDate, formatName, calcAge, formatCurrency } from '../utils/helpers';

const fadeUp = (i) => ({
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.08, duration: 0.4 },
});

const REVENUE_PERIODS = [
    { value: 'day', label: 'Day', statLabel: "Today's Revenue" },
    { value: 'biweek', label: 'Bi-week', statLabel: 'Bi-weekly Revenue' },
    { value: 'month', label: 'Month', statLabel: 'Monthly Revenue' },
];

function StatCard({ icon: Icon, label, value, color, accent, index }) {
    return (
        <motion.div {...fadeUp(index)} className={`card flex items-center gap-4 border-t-[3px] ${accent}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-text-secondary text-xs font-medium uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-text-primary mt-0.5">{value ?? '—'}</p>
            </div>
        </motion.div>
    );
}

function RevenueStatCard({ label, value, revenuePeriod, onPeriodChange }) {
    return (
        <motion.div {...fadeUp(3)} className="card border-t-[3px] border-t-green-500">
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-green-50 text-green-700">
                    <Banknote className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                    <p className="text-text-secondary text-xs font-medium uppercase tracking-wide">{label}</p>
                    <p className="text-2xl font-bold text-text-primary mt-0.5">{value ?? '—'}</p>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-3 rounded-lg border border-border overflow-hidden text-xs font-medium">
                {REVENUE_PERIODS.map(period => (
                    <button
                        key={period.value}
                        type="button"
                        className={`py-1.5 transition-colors ${
                            revenuePeriod === period.value
                                ? 'bg-primary text-white'
                                : 'bg-white text-text-secondary hover:bg-surface'
                        }`}
                        onClick={() => onPeriodChange(period.value)}
                    >
                        {period.label}
                    </button>
                ))}
            </div>
        </motion.div>
    );
}

function OutstandingRow({ p }) {
    return (
        <tr className="border-b border-border/50 hover:bg-bg/60 transition-colors">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    {p.profile_photo ? (
                        <img src={p.profile_photo} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-border" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-bold text-xs shrink-0">
                            {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                    )}
                    <span className="font-medium text-text-primary">{formatName(p, 'last-first')}</span>
                </div>
            </td>
            <td className="px-4 py-3 text-text-secondary">{parseInt(p.pending_visits)} visit{parseInt(p.pending_visits) !== 1 ? 's' : ''}</td>
            <td className="px-4 py-3">
                <span className="font-semibold text-rose-600">{formatCurrency(parseFloat(p.outstanding_amount))}</span>
            </td>
            <td className="px-4 py-3 text-text-secondary">{p.last_visit ? formatDate(p.last_visit) : '—'}</td>
            <td className="px-4 py-3">
                <Link to={`/patients/${p.id}`} className="btn-ghost text-xs py-1.5 px-3">
                    <Eye className="w-3.5 h-3.5" /> View
                </Link>
            </td>
        </tr>
    );
}

function SkeletonRow() {
    return (
        <tr>
            {[1, 2, 3, 4, 5].map(i => (
                <td key={i} className="px-4 py-3"><div className="skeleton h-4 rounded w-full" /></td>
            ))}
        </tr>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [revenuePeriod, setRevenuePeriod] = useState('month');
    const revenueMeta = REVENUE_PERIODS.find(p => p.value === revenuePeriod) || REVENUE_PERIODS[2];

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const res = await client.get('/dashboard/stats', {
                    params: { revenuePeriod },
                });
                if (cancelled) return;
                setStats(res.data);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [revenuePeriod]);

    return (
        <div className="space-y-6 animate-fade-up">
            <div className="border-l-[3px] border-primary pl-3">
                <h1 className="font-display text-2xl font-bold text-text-primary">Dashboard</h1>
                <p className="text-text-secondary text-sm">Overview of today's clinic activity</p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard index={0} icon={Users} label="Total Patients" value={stats?.totalPatients} color="bg-teal-50 text-teal-600" accent="border-t-teal-500" />
                <StatCard index={1} icon={Calendar} label="Today's Appointments" value={stats?.appointmentsToday} color="bg-blue-50 text-blue-600" accent="border-t-blue-500" />
                <StatCard index={2} icon={Clock} label="Upcoming Appointments" value={stats?.upcomingAppointments} color="bg-amber-50 text-amber-600" accent="border-t-amber-500" />
                <RevenueStatCard
                    label={revenueMeta.statLabel}
                    value={stats ? formatCurrency(stats.monthlyRevenue) : null}
                    revenuePeriod={revenuePeriod}
                    onPeriodChange={setRevenuePeriod}
                />
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Recent patients */}
                <motion.div {...fadeUp(4)} className="card">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-text-primary">Recent Patients</h2>
                        <Link to="/patients" className="text-primary text-sm font-medium hover:underline">View all →</Link>
                    </div>
                    <div className="overflow-x-auto -mx-2">
                        <table className="w-full min-w-[680px] text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    {['Name', 'Age', 'Last Visit', 'Issues', ''].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)
                                ) : stats?.recentPatients?.length ? (
                                    stats.recentPatients.map(p => (
                                        <tr key={p.id} className="border-b border-border/50 hover:bg-bg/60 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {p.profile_photo ? (
                                                        <img src={p.profile_photo} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-border" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                                            {p.first_name?.[0]}{p.last_name?.[0]}
                                                        </div>
                                                    )}
                                                    <span className="font-medium text-text-primary">{formatName(p, 'last-first')}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-text-secondary">{calcAge(p.date_of_birth)} yrs</td>
                                            <td className="px-4 py-3 text-text-secondary">{p.last_visit ? formatDate(p.last_visit) : 'No visits'}</td>
                                            <td className="px-4 py-3">
                                                {parseInt(p.dental_issues) > 0
                                                    ? <span className="badge-red">{p.dental_issues} issue{p.dental_issues !== '1' ? 's' : ''}</span>
                                                    : <span className="badge-green">Healthy</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3">
                                                <Link to={`/patients/${p.id}`} className="btn-ghost text-xs py-1.5 px-3">
                                                    <Eye className="w-3.5 h-3.5" /> View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary">No patients yet</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Outstanding Balances */}
                <motion.div {...fadeUp(5)} className="card">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                            <h2 className="font-semibold text-text-primary">Outstanding Balances</h2>
                        </div>
                        <Link to="/patients" className="text-primary text-sm font-medium hover:underline">View all →</Link>
                    </div>
                    <div className="overflow-x-auto -mx-2">
                        <table className="w-full min-w-[600px] text-sm">
                            <thead>
                                <tr className="border-b border-border">
                                    {['Patient', 'Unpaid Visits', 'Amount Owed', 'Last Visit', ''].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-text-secondary uppercase tracking-wide">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [1, 2, 3].map(i => <SkeletonRow key={i} />)
                                ) : stats?.outstandingPatients?.length ? (
                                    stats.outstandingPatients.map(p => <OutstandingRow key={p.id} p={p} />)
                                ) : (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-text-secondary">No outstanding balances</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
