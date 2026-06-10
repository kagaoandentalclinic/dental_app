import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Calendar, Clock, Banknote, Eye, AlertTriangle, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import client from '../api/client';
import { formatDate, formatName, calcAge, formatCurrency } from '../utils/helpers';

const fadeUp = (i) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] },
});

const REVENUE_PERIODS = [
    { value: 'day',    label: 'Today',   statLabel: "Today's Revenue"   },
    { value: 'biweek', label: 'Bi-week', statLabel: 'Bi-weekly Revenue'  },
    { value: 'month',  label: 'Month',   statLabel: 'Monthly Revenue'   },
    { value: 'custom', label: 'Custom',  statLabel: 'Custom Range Revenue' },
];

// Stat card configurations
const STAT_CARDS = [
    {
        key: 'totalPatients',
        icon: Users,
        label: 'Total Patients',
        iconBg: 'bg-teal-50',
        iconColor: 'text-teal-600',
        dot: 'bg-teal-500',
    },
    {
        key: 'appointmentsToday',
        icon: Calendar,
        label: "Today's Appointments",
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        dot: 'bg-blue-500',
    },
    {
        key: 'upcomingAppointments',
        icon: Clock,
        label: 'Upcoming',
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-600',
        dot: 'bg-violet-500',
    },
];

function StatCard({ icon: Icon, label, value, iconBg, iconColor, dot, index }) {
    return (
        <motion.div
            {...fadeUp(index)}
            className="stat-card group"
        >
            {/* Icon circle */}
            <div className={`stat-icon ${iconBg} ${iconColor}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
                <p className="stat-label">{label}</p>
                <p className="stat-value">
                    {value ?? (
                        <span className="skeleton inline-block w-12 h-6 rounded" />
                    )}
                </p>
            </div>
            {/* Subtle indicator dot */}
            <div className={`ml-auto w-2 h-2 rounded-full ${dot} opacity-60 animate-pulse-dot`} />
        </motion.div>
    );
}

function RevenueCard({ label, value, revenuePeriod, onPeriodChange, dateFrom, dateTo, onDateChange, index }) {
    const isCustom = revenuePeriod === 'custom';
    const today = new Date().toISOString().slice(0, 10);

    // Human-readable range label
    const rangeLabel = isCustom && dateFrom && dateTo
        ? `${dateFrom} → ${dateTo}`
        : null;

    return (
        <motion.div {...fadeUp(index)} className="stat-card flex-col items-start gap-3">
            <div className="flex items-center gap-4 w-full">
                <div className="stat-icon bg-emerald-50 text-emerald-600">
                    <Banknote className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="stat-label">{label}</p>
                    <p className="stat-value">
                        {value ?? (
                            <span className="skeleton inline-block w-20 h-6 rounded" />
                        )}
                    </p>
                    {rangeLabel && (
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{rangeLabel}</p>
                    )}
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-400 ml-auto shrink-0" />
            </div>

            {/* Period toggle */}
            <div className="w-full grid grid-cols-4 bg-slate-100 rounded-xl p-0.5 text-xs font-semibold">
                {REVENUE_PERIODS.map(period => (
                    <button
                        key={period.value}
                        type="button"
                        className={`py-1.5 rounded-[10px] transition-all duration-200 ${
                            revenuePeriod === period.value
                                ? 'bg-white text-primary shadow-sm'
                                : 'text-slate-400 hover:text-slate-600'
                        }`}
                        onClick={() => onPeriodChange(period.value)}
                    >
                        {period.label}
                    </button>
                ))}
            </div>

            {/* Custom date range inputs — visible only when Custom is selected */}
            {isCustom && (
                <div className="w-full space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                                From
                            </label>
                            <input
                                type="date"
                                max={dateTo || today}
                                value={dateFrom}
                                onChange={e => onDateChange('from', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg
                                           text-text-primary focus:outline-none focus:border-primary
                                           focus:ring-2 focus:ring-primary/15 bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                                To
                            </label>
                            <input
                                type="date"
                                min={dateFrom || undefined}
                                max={today}
                                value={dateTo}
                                onChange={e => onDateChange('to', e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg
                                           text-text-primary focus:outline-none focus:border-primary
                                           focus:ring-2 focus:ring-primary/15 bg-white"
                            />
                        </div>
                    </div>
                    {(!dateFrom || !dateTo) && (
                        <p className="text-[10px] text-amber-500 flex items-center gap-1">
                            <span>⚠</span> Select both dates to load revenue
                        </p>
                    )}
                </div>
            )}
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
    const [revenuePeriod, setRevenuePeriod] = useState('month');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const revenueMeta = REVENUE_PERIODS.find(p => p.value === revenuePeriod) || REVENUE_PERIODS[2];

    // Handle date range changes
    const handleDateChange = (field, value) => {
        if (field === 'from') setDateFrom(value);
        else setDateTo(value);
    };

    useEffect(() => {
        // Don't fetch if custom mode is selected but dates aren't filled in
        if (revenuePeriod === 'custom' && (!dateFrom || !dateTo)) return;

        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const params = { revenuePeriod };
                if (revenuePeriod === 'custom') {
                    params.dateFrom = dateFrom;
                    params.dateTo   = dateTo;
                }
                const res = await client.get('/dashboard/stats', { params });
                if (!cancelled) setStats(res.data);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [revenuePeriod, dateFrom, dateTo]);

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
                <div className="flex items-center gap-2 shrink-0">
                    <Link
                        to="/appointments"
                        className="btn-secondary text-sm py-2 px-4"
                    >
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Make Appointment</span>
                        <span className="sm:hidden">Appt.</span>
                    </Link>
                    <Link
                        to="/patients/new"
                        className="btn-primary text-sm py-2 px-4"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Patient</span>
                        <span className="sm:hidden">Add</span>
                    </Link>
                </div>
            </div>

            {/* ── Stat Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
                    />
                ))}
                <RevenueCard
                    index={3}
                    label={revenueMeta.statLabel}
                    value={stats ? formatCurrency(stats.monthlyRevenue) : null}
                    revenuePeriod={revenuePeriod}
                    onPeriodChange={(p) => {
                        setRevenuePeriod(p);
                        // Reset custom dates when switching away from custom
                        if (p !== 'custom') { setDateFrom(''); setDateTo(''); }
                    }}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateChange={handleDateChange}
                />
            </div>

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
                        <table className="data-table min-w-[620px]">
                            <thead>
                                <tr>
                                    {['Patient', 'Age', 'Last Visit', 'Status', ''].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
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
                                            <td className="text-slate-500">{calcAge(p.date_of_birth)} yrs</td>
                                            <td className="text-slate-500 text-sm">
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
                        <table className="data-table min-w-[580px]">
                            <thead>
                                <tr>
                                    {['Patient', 'Unpaid Visits', 'Amount Owed', 'Last Visit', ''].map(h => (
                                        <th key={h}>{h}</th>
                                    ))}
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
                                            <td>
                                                <span className="badge-amber">
                                                    {parseInt(p.pending_visits)} visit{parseInt(p.pending_visits) !== 1 ? 's' : ''}
                                                </span>
                                            </td>
                                            <td>
                                                <span className="font-semibold text-red-600">
                                                    {formatCurrency(parseFloat(p.outstanding_amount))}
                                                </span>
                                            </td>
                                            <td className="text-slate-500 text-sm">
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
