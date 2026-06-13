import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Calendar, Clock, Eye, AlertTriangle, Plus, ArrowRight } from 'lucide-react';
import client from '../api/client';
import { formatDate, formatName, calcAge, formatCurrency } from '../utils/helpers';
import RevenueSection from './RevenueSection';

const fadeUp = (i) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] },
});



// Stat card configurations (revenue moved to RevenueSection)
const STAT_CARDS = [
    {
        key: 'totalPatients',
        icon: Users,
        label: 'Total Patients',
        iconBg: 'bg-teal-50',
        iconColor: 'text-teal-600',
        dot: 'bg-teal-500',
        to: '/patients',
        hint: 'View all patients',
    },
    {
        key: 'appointmentsToday',
        icon: Calendar,
        label: "Today's Appointments",
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        dot: 'bg-blue-500',
        to: '/appointments',
        hint: 'View today\'s schedule',
    },
    {
        key: 'upcomingAppointments',
        icon: Clock,
        label: 'Upcoming (30d)',
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-600',
        dot: 'bg-violet-500',
        to: '/appointments',
        hint: 'View upcoming appointments',
    },
];

function StatCard({ icon: Icon, label, value, iconBg, iconColor, dot, to, hint, index }) {
    return (
        <motion.div
            {...fadeUp(index)}
            className="stat-card group cursor-pointer"
        >
            <Link
                to={to}
                className="flex items-center gap-4 w-full no-underline"
            >
                {/* Icon circle */}
                <div className={`stat-icon ${iconBg} ${iconColor} transition-transform duration-200 group-hover:scale-110`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="stat-label">{label}</p>
                    <p className="stat-value">
                        {value ?? (
                            <span className="skeleton inline-block w-12 h-6 rounded" />
                        )}
                    </p>
                    {/* Hint text slides up on hover */}
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5
                                  translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100
                                  transition-all duration-200">
                        {hint}
                    </p>
                </div>
                {/* Arrow slides in on hover */}
                <ArrowRight
                    className="w-4 h-4 text-slate-300 shrink-0
                               -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100
                               transition-all duration-200"
                />
            </Link>
        </motion.div>
    );
}



function PatientAvatar({ patient }) {
    if (patient.profile_photo) {
        return (
            <img
                src={patient.profile_photo}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-white shadow-sm"
            />
        );
    }
    // Deterministic pastel color from name
    const colors = [
        'bg-teal-100 text-teal-700',
        'bg-blue-100 text-blue-700',
        'bg-violet-100 text-violet-700',
        'bg-amber-100 text-amber-700',
        'bg-rose-100 text-rose-700',
        'bg-emerald-100 text-emerald-700',
    ];
    const colorIdx = ((patient.first_name?.charCodeAt(0) || 0) + (patient.last_name?.charCodeAt(0) || 0)) % colors.length;
    return (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${colors[colorIdx]}`}>
            {patient.first_name?.[0]}{patient.last_name?.[0]}
        </div>
    );
}

function SkeletonRow({ cols = 5 }) {
    return (
        <tr>
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="px-4 py-3.5">
                    <div className="skeleton h-3.5 rounded w-full" />
                </td>
            ))}
        </tr>
    );
}

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const res = await client.get('/dashboard/stats');
                if (!cancelled) setStats(res.data);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <div className="space-y-6 animate-fade-up">

            {/* ── Page Header + Quick Actions ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-text-primary">Dashboard Overview</h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                {/* Quick action buttons — like in the reference */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                    <Link
                        to="/appointments"
                        className="btn-secondary text-sm py-2 px-4 w-full sm:w-auto"
                    >
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Make Appointment</span>
                        <span className="sm:hidden">Make Appointment</span>
                    </Link>
                    <Link
                        to="/patients/new"
                        className="btn-primary text-sm py-2 px-4 w-full sm:w-auto"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Patient</span>
                        <span className="sm:hidden">Add Patient</span>
                    </Link>
                </div>
            </div>

            {/* ── Stat Cards (3 summary metrics) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {STAT_CARDS.map((cfg, i) => (
                    <StatCard
                        key={cfg.key}
                        index={i}
                        icon={cfg.icon}
                        label={cfg.label}
                        value={stats?.[cfg.key]}
                        iconBg={cfg.iconBg}
                        iconColor={cfg.iconColor}
                        dot={cfg.dot}
                        to={cfg.to}
                        hint={cfg.hint}
                    />
                ))}
            </div>

            {/* ── Revenue Overview Section ── */}
            <RevenueSection />

            {/* ── Tables Row ── */}
            <div className="grid grid-cols-1 gap-5">

                {/* Recent Patients */}
                <motion.div {...fadeUp(4)} className="card overflow-hidden p-0">
                    {/* Card header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <div>
                            <h2 className="font-semibold text-text-primary">Recent Patients</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Latest registered patients</p>
                        </div>
                        <Link
                            to="/patients"
                            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-light transition-colors"
                        >
                            View all <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="data-table w-full">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th className="hidden sm:table-cell">Age</th>
                                    <th className="hidden sm:table-cell">Last Visit</th>
                                    <th>Status</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} cols={5} />)
                                ) : stats?.recentPatients?.length ? (
                                    stats.recentPatients.map(p => (
                                        <tr key={p.id}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <PatientAvatar patient={p} />
                                                    <div>
                                                        <p className="font-medium text-text-primary text-sm leading-tight">
                                                            {formatName(p, 'last-first')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="hidden sm:table-cell text-slate-500">{calcAge(p.date_of_birth)} yrs</td>
                                            <td className="hidden sm:table-cell text-slate-500 text-sm">
                                                {p.last_visit ? formatDate(p.last_visit) : (
                                                    <span className="text-slate-300 italic">No visits</span>
                                                )}
                                            </td>
                                            <td>
                                                {parseInt(p.dental_issues) > 0
                                                    ? <span className="badge-red">{p.dental_issues} issue{p.dental_issues !== '1' ? 's' : ''}</span>
                                                    : <span className="badge-green">Healthy</span>
                                                }
                                            </td>
                                            <td>
                                                <Link
                                                    to={`/patients/${p.id}`}
                                                    className="btn-ghost text-xs py-1.5 px-3 gap-1.5"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-400">
                                            <Users className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                                            <p>No patients yet</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Outstanding Balances */}
                <motion.div {...fadeUp(5)} className="card overflow-hidden p-0">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-text-primary">Outstanding Balances</h2>
                                <p className="text-xs text-slate-400 mt-0.5">Patients with unpaid visits</p>
                            </div>
                        </div>
                        <Link
                            to="/patients"
                            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-light transition-colors"
                        >
                            View all <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="data-table w-full">
                            <thead>
                                <tr>
                                    <th>Patient</th>
                                    <th className="hidden sm:table-cell">Unpaid Visits</th>
                                    <th>Amount Owed</th>
                                    <th className="hidden sm:table-cell">Last Visit</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    [1, 2, 3].map(i => <SkeletonRow key={i} cols={5} />)
                                ) : stats?.outstandingPatients?.length ? (
                                    stats.outstandingPatients.map(p => (
                                        <tr key={p.id}>
                                            <td>
                                                <div className="flex items-center gap-3">
                                                    <PatientAvatar patient={p} />
                                                    <span className="font-medium text-text-primary text-sm">
                                                        {formatName(p, 'last-first')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="hidden sm:table-cell">
                                                <span className="badge-amber">
                                                    {parseInt(p.pending_visits)} visit{parseInt(p.pending_visits) !== 1 ? 's' : ''}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="font-semibold text-red-600">
                                                    {formatCurrency(parseFloat(p.outstanding_amount))}
                                                </span>
                                            </td>
                                            <td className="hidden sm:table-cell text-slate-500 text-sm">
                                                {p.last_visit ? formatDate(p.last_visit) : '—'}
                                            </td>
                                            <td>
                                                <Link
                                                    to={`/patients/${p.id}`}
                                                    className="btn-ghost text-xs py-1.5 px-3 gap-1.5"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-slate-400">
                                            <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-green-100 flex items-center justify-center">
                                                <span className="text-green-500 text-lg">✓</span>
                                            </div>
                                            <p>No outstanding balances</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

            </div>
        </div>
    );
}
