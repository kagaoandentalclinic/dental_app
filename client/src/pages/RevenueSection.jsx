import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    TrendingUp, TrendingDown, Minus,
    Banknote, AlertCircle, BarChart2, Percent,
    ArrowRight, Users,
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import client from '../api/client';
import { formatDate, formatName } from '../utils/helpers';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function peso(amount) {
    if (amount == null || isNaN(amount)) return '₱0';
    return '₱' + Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pesoK(amount) {
    if (amount == null || isNaN(amount)) return '₱0';
    const n = Number(amount);
    if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `₱${(n / 1_000).toFixed(0)}k`;
    return `₱${n.toFixed(0)}`;
}

const fadeUp = (i = 0) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: i * 0.07, duration: 0.38, ease: [0.22, 1, 0.36, 1] },
});

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton pulse block
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
    return <div className={`skeleton rounded ${className}`} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Patient avatar (initials fallback)
// ─────────────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
    'bg-teal-100 text-teal-700',
    'bg-blue-100 text-blue-700',
    'bg-violet-100 text-violet-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-emerald-100 text-emerald-700',
];

function PatientAvatar({ patient, size = 'sm' }) {
    const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-sm';
    if (patient?.profile_photo) {
        return (
            <img
                src={patient.profile_photo}
                alt=""
                className={`${sz} rounded-full object-cover shrink-0 border-2 border-white shadow-sm`}
            />
        );
    }
    const idx = ((patient?.first_name?.charCodeAt(0) || 0) + (patient?.last_name?.charCodeAt(0) || 0)) % AVATAR_COLORS.length;
    return (
        <div className={`${sz} rounded-full flex items-center justify-center font-bold shrink-0 ${AVATAR_COLORS[idx]}`}>
            {patient?.first_name?.[0]}{patient?.last_name?.[0]}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric Card
// ─────────────────────────────────────────────────────────────────────────────
function MetricCard({ icon: Icon, iconBg, iconColor, label, value, sublabel, sublabelColor, flag, loading, index }) {
    return (
        <motion.div
            {...fadeUp(index)}
            className="bg-white rounded-2xl p-5 flex items-start gap-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)] border border-slate-100 cursor-default"
        >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
                {loading ? (
                    <Skeleton className="h-7 w-28 mb-1" />
                ) : (
                    <p className={`text-2xl font-bold tabular-nums leading-tight ${flag || 'text-slate-800'}`}>{value}</p>
                )}
                {loading ? (
                    <Skeleton className="h-3.5 w-20 mt-1" />
                ) : (
                    <p className={`text-[11px] mt-1 font-medium ${sublabelColor || 'text-slate-400'}`}>{sublabel}</p>
                )}
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Revenue Trend Chart
// ─────────────────────────────────────────────────────────────────────────────
const TREND_PERIODS = [
    { value: '3m',    label: '3M'     },
    { value: '6m',    label: '6M'     },
    { value: '1y',    label: '1Y'     },
    { value: 'custom', label: 'Custom' },
];

function RevenueTrendChart({ trend, trendPeriod, onPeriodChange, customFrom, customTo, onCustomChange, loading }) {
    const isCustom = trendPeriod === 'custom';
    const today = new Date().toISOString().slice(0, 10);
    const chartData = {
        labels: trend?.map(t => t.label) ?? [],
        datasets: [
            {
                label: 'Collected',
                data: trend?.map(t => t.collected) ?? [],
                backgroundColor: '#1D9E75',
                borderRadius: 6,
                borderSkipped: false,
            },
            {
                label: 'Outstanding',
                data: trend?.map(t => t.outstanding) ?? [],
                backgroundColor: 'rgba(226,75,74,0.55)',
                borderRadius: 6,
                borderSkipped: false,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                align: 'end',
                labels: {
                    font: { size: 11, family: 'Inter, sans-serif', weight: '600' },
                    color: '#64748b',
                    boxWidth: 10,
                    boxHeight: 10,
                    borderRadius: 3,
                    useBorderRadius: true,
                    padding: 16,
                },
            },
            tooltip: {
                backgroundColor: '#1e293b',
                titleFont: { size: 12, family: 'Inter, sans-serif', weight: '600' },
                bodyFont: { size: 12, family: 'Inter, sans-serif' },
                padding: 12,
                cornerRadius: 10,
                callbacks: {
                    label: (ctx) => ` ${ctx.dataset.label}: ₱${Number(ctx.raw).toLocaleString('en-PH')}`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    font: { size: 11, family: 'Inter, sans-serif', weight: '500' },
                    color: '#94a3b8',
                },
                border: { display: false },
            },
            y: {
                grid: { color: '#f1f5f9', drawBorder: false },
                ticks: {
                    font: { size: 11, family: 'Inter, sans-serif' },
                    color: '#94a3b8',
                    callback: (val) => pesoK(val),
                    maxTicksLimit: 5,
                },
                border: { display: false },
            },
        },
    };

    return (
        <motion.div {...fadeUp(1)} className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            {/* Header row */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <h3 className="font-semibold text-slate-800">Revenue Trend</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Collected vs. outstanding per month</p>
                </div>
                {/* Period toggle */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                    {TREND_PERIODS.map(p => (
                        <button
                            key={p.value}
                            id={`trend-toggle-${p.value}`}
                            type="button"
                            onClick={() => onPeriodChange(p.value)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-[9px] transition-all duration-200 ${
                                trendPeriod === p.value
                                    ? 'bg-[#0F6E56] text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom date range row — animates in when Custom is active */}
            {isCustom && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200"
                >
                    <div className="flex-1 min-w-[130px]">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                            From
                        </label>
                        <input
                            id="trend-custom-from"
                            type="date"
                            max={customTo || today}
                            value={customFrom}
                            onChange={e => onCustomChange('from', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg
                                       text-slate-700 bg-white focus:outline-none focus:border-[#0F6E56]
                                       focus:ring-2 focus:ring-[#0F6E56]/15 transition-all"
                        />
                    </div>
                    <div className="flex-1 min-w-[130px]">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                            To
                        </label>
                        <input
                            id="trend-custom-to"
                            type="date"
                            min={customFrom || undefined}
                            max={today}
                            value={customTo}
                            onChange={e => onCustomChange('to', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg
                                       text-slate-700 bg-white focus:outline-none focus:border-[#0F6E56]
                                       focus:ring-2 focus:ring-[#0F6E56]/15 transition-all"
                        />
                    </div>
                    {(!customFrom || !customTo) && (
                        <p className="w-full text-[11px] text-amber-500 flex items-center gap-1">
                            <span>⚠</span> Select both dates to load data
                        </p>
                    )}
                    {customFrom && customTo && (
                        <p className="w-full text-[11px] text-emerald-600 font-medium">
                            Showing: {customFrom} → {customTo}
                        </p>
                    )}
                </motion.div>
            )}

            <div className="h-56 relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-end gap-3 px-2">
                        {Array.from({ length: trendPeriod === '3m' ? 4 : trendPeriod === '1y' ? 13 : 7 }).map((_, i) => (
                            <div key={i} className="flex-1 flex flex-col justify-end gap-1">
                                <Skeleton className="w-full" style={{ height: `${30 + Math.random() * 60}%` }} />
                                <Skeleton className="w-full" style={{ height: `${10 + Math.random() * 30}%` }} />
                            </div>
                        ))}
                    </div>
                ) : isCustom && (!customFrom || !customTo) ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-medium text-slate-400">Pick a date range above</p>
                    </div>
                ) : (
                    <Bar data={chartData} options={chartOptions} />
                )}
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Breakdown
// ─────────────────────────────────────────────────────────────────────────────
const SERVICE_CONFIG = [
    { key: 'orthodontics',   label: 'Orthodontics',  color: '#0F6E56' },
    { key: 'restorations',   label: 'Restorations',  color: '#3B82F6' },
    { key: 'extractions',    label: 'Extractions',   color: '#F59E0B' },
    { key: 'cleaning',       label: 'Cleaning',      color: '#8B5CF6' },
    { key: 'consultations',  label: 'Consultations', color: '#06B6D4' },
    { key: 'others',         label: 'Others',        color: '#94A3B8' },
];

function ServiceBreakdown({ services, loading }) {
    const monthlyTotal = services
        ? Object.values(services).reduce((a, b) => a + b, 0)
        : 0;

    return (
        <motion.div {...fadeUp(2)} className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="mb-4">
                <h3 className="font-semibold text-slate-800">Revenue by Service</h3>
                <p className="text-xs text-slate-400 mt-0.5">Current month breakdown</p>
            </div>

            <div className="space-y-3.5">
                {SERVICE_CONFIG.map(({ key, label, color }) => {
                    const amount = services?.[key] ?? 0;
                    const pct = monthlyTotal > 0 ? (amount / monthlyTotal) * 100 : 0;

                    return (
                        <div key={key}>
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-xs font-medium text-slate-600">{label}</span>
                                </div>
                                {loading ? (
                                    <Skeleton className="h-3.5 w-16" />
                                ) : (
                                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                                        {peso(amount)}
                                    </span>
                                )}
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                {loading ? (
                                    <div className="skeleton h-full rounded-full w-full" />
                                ) : (
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                                        className="h-full rounded-full"
                                        style={{ backgroundColor: color }}
                                    />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Outstanding Balances Mini-List
// ─────────────────────────────────────────────────────────────────────────────
function AmountBadge({ amount }) {
    const n = parseFloat(amount);
    if (n > 20_000) {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 ring-1 ring-red-200/60">
                {peso(n)}
            </span>
        );
    }
    if (n >= 5_000) {
        return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 ring-1 ring-amber-200/60">
                {peso(n)}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
            {peso(n)}
        </span>
    );
}

function OutstandingMiniList({ patients, loading }) {
    return (
        <motion.div {...fadeUp(3)} className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-slate-800 text-sm">Outstanding Balances</h3>
                        <p className="text-[11px] text-slate-400">Top 5 patients by amount owed</p>
                    </div>
                </div>
                <Link
                    to="/patients?outstanding=1"
                    id="outstanding-view-all"
                    className="flex items-center gap-1 text-xs font-semibold text-[#0F6E56] hover:text-emerald-700 transition-colors"
                >
                    View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>

            {/* List */}
            <div className="divide-y divide-slate-50">
                {loading ? (
                    [1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                            <div className="flex-1">
                                <Skeleton className="h-3.5 w-32 mb-1" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                    ))
                ) : patients?.length ? (
                    patients.map(p => (
                        <Link
                            key={p.id}
                            to={`/patients/${p.id}`}
                            className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors"
                        >
                            <PatientAvatar patient={p} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                    {formatName(p, 'last-first')}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                    Last visit: {p.last_visit ? formatDate(p.last_visit) : '—'}
                                </p>
                            </div>
                            <AmountBadge amount={p.outstanding_amount} />
                        </Link>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mb-2">
                            <span className="text-emerald-500 text-xl">✓</span>
                        </div>
                        <p className="text-sm font-medium">No outstanding balances</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export default function RevenueSection() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [trendPeriod, setTrendPeriod] = useState('6m');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const fetchRevenue = useCallback(async (period, from, to) => {
        // Don't fetch if custom but dates not both set
        if (period === 'custom' && (!from || !to)) return;
        setLoading(true);
        try {
            const params = { trend: period };
            if (period === 'custom') {
                params.dateFrom = from;
                params.dateTo   = to;
            }
            const res = await client.get('/dashboard/revenue', { params });
            setData(res.data);
        } catch (err) {
            console.error('Revenue section fetch failed', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRevenue(trendPeriod, customFrom, customTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trendPeriod, customFrom, customTo]);

    const handlePeriodChange = (p) => {
        setTrendPeriod(p);
        // Reset custom dates when switching away
        if (p !== 'custom') {
            setCustomFrom('');
            setCustomTo('');
        }
    };

    const handleCustomChange = (field, value) => {
        if (field === 'from') setCustomFrom(value);
        else setCustomTo(value);
    };

    // ── Month-over-month delta ──────────────────────────────────────────
    const moDelta = data
        ? data.lastMonth > 0
            ? Math.round(((data.thisMonth - data.lastMonth) / data.lastMonth) * 100)
            : data.thisMonth > 0 ? 100 : 0
        : null;

    const DeltaIcon = moDelta === null ? Minus : moDelta > 0 ? TrendingUp : moDelta < 0 ? TrendingDown : Minus;
    const deltaColor = moDelta === null ? 'text-slate-400' : moDelta > 0 ? 'text-emerald-600' : moDelta < 0 ? 'text-red-500' : 'text-slate-400';
    const deltaBg = moDelta === null ? 'bg-slate-50' : moDelta > 0 ? 'bg-emerald-50' : moDelta < 0 ? 'bg-red-50' : 'bg-slate-50';

    const collectionFlagColor = data?.collectionRate < 80 ? 'text-red-600' : 'text-slate-800';

    return (
        <div className="space-y-5">
            {/* ── Section header ── */}
            <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#0F6E56]" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Revenue Overview</h2>
            </div>

            {/* ── 4 Metric Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {/* Monthly Revenue */}
                <MetricCard
                    index={0}
                    icon={Banknote}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    label="Monthly Revenue"
                    value={data ? peso(data.thisMonth) : null}
                    sublabel={
                        moDelta !== null
                            ? `${moDelta >= 0 ? '+' : ''}${moDelta}% vs last month`
                            : 'vs last month'
                    }
                    sublabelColor={deltaColor}
                    loading={loading}
                    flag={null}
                />

                {/* Last Month */}
                <MetricCard
                    index={1}
                    icon={DeltaIcon}
                    iconBg={deltaBg}
                    iconColor={deltaColor}
                    label="Last Month"
                    value={data ? peso(data.lastMonth) : null}
                    sublabel={data?.lastMonthName ?? '—'}
                    loading={loading}
                />

                {/* Total Outstanding */}
                <MetricCard
                    index={2}
                    icon={AlertCircle}
                    iconBg="bg-red-50"
                    iconColor="text-red-500"
                    label="Total Outstanding"
                    value={data ? peso(data.outstanding) : null}
                    sublabel={
                        data
                            ? `${data.outstandingPatientCount} patient${data.outstandingPatientCount !== 1 ? 's' : ''} with balance`
                            : '—'
                    }
                    sublabelColor="text-red-400"
                    loading={loading}
                />

                {/* Collection Rate */}
                <MetricCard
                    index={3}
                    icon={Percent}
                    iconBg={data?.collectionRate < 80 ? 'bg-red-50' : 'bg-teal-50'}
                    iconColor={data?.collectionRate < 80 ? 'text-red-500' : 'text-teal-600'}
                    label="Collection Rate"
                    value={data ? `${data.collectionRate}%` : null}
                    sublabel={data?.collectionRate < 80 ? '⚠ Below 80% target' : 'On track'}
                    sublabelColor={data?.collectionRate < 80 ? 'text-red-400' : 'text-emerald-500'}
                    flag={collectionFlagColor}
                    loading={loading}
                />
            </div>

            {/* ── Chart + Service Breakdown side by side on lg ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <RevenueTrendChart
                        trend={data?.trend}
                        trendPeriod={trendPeriod}
                        onPeriodChange={handlePeriodChange}
                        customFrom={customFrom}
                        customTo={customTo}
                        onCustomChange={handleCustomChange}
                        loading={loading}
                    />
                </div>
                <div className="lg:col-span-1">
                    <ServiceBreakdown services={data?.services} loading={loading} />
                </div>
            </div>

            {/* ── Outstanding Mini-List ── */}
            <OutstandingMiniList patients={data?.topOutstanding} loading={loading} />
        </div>
    );
}
