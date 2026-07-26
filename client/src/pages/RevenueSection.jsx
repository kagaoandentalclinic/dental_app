import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Banknote, AlertCircle, BarChart2, Percent,
    ArrowRight,
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
import { formatDate, formatDateTime, formatName, toLocalDateInput } from '../utils/helpers';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function peso(amount) {
    if (amount == null || Number.isNaN(Number(amount))) return '₱0';
    return `₱${Number(amount).toLocaleString('en-PH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })}`;
}

function pesoK(amount) {
    if (amount == null || Number.isNaN(Number(amount))) return '₱0';
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

function Skeleton({ className = '', style }) {
    return <div className={`skeleton rounded ${className}`} style={style} />;
}

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
                    <Skeleton className="h-3.5 w-24 mt-1" />
                ) : (
                    <p className={`text-[11px] mt-1 font-medium ${sublabelColor || 'text-slate-400'}`}>{sublabel}</p>
                )}
            </div>
        </motion.div>
    );
}

const TREND_PERIODS = [
    { value: '3m', label: '3M' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1Y' },
    { value: 'custom', label: 'Custom' },
];

const DATE_BASES = [
    { value: 'activity', label: 'Activity Date' },
    { value: 'recorded', label: 'Record Date' },
];

function RevenueTrendChart({
    trend,
    trendPeriod,
    onPeriodChange,
    dateBasis,
    onDateBasisChange,
    customFrom,
    customTo,
    onCustomChange,
    onBucketSelect,
    drilldownEnabled,
    loading,
}) {
    const [showDateBasis, setShowDateBasis] = useState(false);
    const isCustom = trendPeriod === 'custom';
    const today = new Date().toISOString().slice(0, 10);
    const chartData = {
        labels: trend?.map((item) => item.label) ?? [],
        datasets: [
            {
                label: 'Collected',
                data: trend?.map((item) => item.collected) ?? [],
                backgroundColor: '#1D9E75',
                borderRadius: 6,
                borderSkipped: false,
            },
            {
                label: 'Balance Created',
                data: trend?.map((item) => item.outstanding) ?? [],
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
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <h3 className="font-semibold text-slate-800">Revenue Trend</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {isCustom ? 'Daily collected revenue and new balances' : 'Monthly collected revenue and new balances'}
                        {' • '}
                        {dateBasis === 'recorded' ? 'using record entry date' : 'using activity date'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setShowDateBasis((current) => !current)}
                        className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                            showDateBasis ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-200 text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {showDateBasis ? 'Hide date basis' : 'Date basis'}
                    </button>
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                        {TREND_PERIODS.map((period) => (
                            <button
                                key={period.value}
                                type="button"
                                onClick={() => onPeriodChange(period.value)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-[9px] transition-all duration-200 ${
                                    trendPeriod === period.value ? 'bg-[#0F6E56] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {showDateBasis && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2 }}
                    className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Date basis</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        {DATE_BASES.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onDateBasisChange(option.value)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-[9px] transition-all duration-200 ${
                                    dateBasis === option.value
                                        ? 'bg-slate-700 text-white shadow-sm'
                                        : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-700'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}

            {isCustom && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200"
                >
                    <div className="flex-1 min-w-[130px]">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">From</label>
                        <input
                            type="date"
                            max={customTo || today}
                            value={customFrom}
                            onChange={(e) => onCustomChange('from', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15 transition-all"
                        />
                    </div>
                    <div className="flex-1 min-w-[130px]">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">To</label>
                        <input
                            type="date"
                            min={customFrom || undefined}
                            max={today}
                            value={customTo}
                            onChange={(e) => onCustomChange('to', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15 transition-all"
                        />
                    </div>
                    {(!customFrom || !customTo) && (
                        <p className="w-full text-[11px] text-amber-500">Select both dates to load data.</p>
                    )}
                    {customFrom && customTo && (
                        <p className="w-full text-[11px] text-emerald-600 font-medium">Showing: {customFrom} → {customTo}</p>
                    )}
                </motion.div>
            )}

            <div className="h-56 relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-end gap-3 px-2">
                        {Array.from({ length: trendPeriod === '3m' ? 4 : trendPeriod === '1y' ? 13 : 7 }).map((_, index) => {
                            const primaryHeight = 38 + (index % 5) * 10;
                            const secondaryHeight = 14 + (index % 4) * 5;

                            return (
                                <div key={index} className="flex-1 flex flex-col justify-end gap-1">
                                    <Skeleton className="w-full" style={{ height: `${primaryHeight}%` }} />
                                    <Skeleton className="w-full" style={{ height: `${secondaryHeight}%` }} />
                                </div>
                            );
                        })}
                    </div>
                ) : isCustom && (!customFrom || !customTo) ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-medium text-slate-400">Pick a date range above</p>
                    </div>
                ) : (
                    <Bar
                        data={chartData}
                        options={chartOptions}
                        onClick={(_, elements) => {
                            if (!drilldownEnabled || !elements?.length) return;
                            const { index, datasetIndex } = elements[0];
                            const bucket = trend?.[index];
                            if (!bucket) return;
                            onBucketSelect({
                                bucket,
                                metric: datasetIndex === 1 ? 'outstanding' : 'collected',
                            });
                        }}
                    />
                )}
            </div>

            {!loading && trend?.length && drilldownEnabled ? (
                <p className="mt-3 text-[11px] text-slate-400">Click a bar to open the exact records behind that day.</p>
            ) : null}
            {!loading && trend?.length && !drilldownEnabled ? (
                <p className="mt-3 text-[11px] text-slate-400">Drilldown is available in Custom range so each click opens a single-day record view.</p>
            ) : null}
        </motion.div>
    );
}

const SERVICE_CONFIG = [
    { key: 'orthodontics', label: 'Orthodontics', color: '#0F6E56' },
    { key: 'restorations', label: 'Restorations', color: '#3B82F6' },
    { key: 'extractions', label: 'Extractions', color: '#F59E0B' },
    { key: 'cleaning', label: 'Cleaning', color: '#8B5CF6' },
    { key: 'consultations', label: 'Consultations', color: '#06B6D4' },
    { key: 'others', label: 'Others', color: '#94A3B8' },
];

function ServiceBreakdown({ services, loading }) {
    const monthlyTotal = services ? Object.values(services).reduce((sum, value) => sum + value, 0) : 0;
    const rankedServices = SERVICE_CONFIG
        .map((service) => ({
            ...service,
            amount: services?.[service.key] ?? 0,
        }))
        .sort((left, right) => right.amount - left.amount);
    const featuredServices = rankedServices.slice(0, 4);
    const remainingTotal = rankedServices.slice(4).reduce((sum, service) => sum + service.amount, 0);
    const displayServices = remainingTotal > 0
        ? [...featuredServices, { key: 'remainder', label: 'Other services', color: '#94A3B8', amount: remainingTotal }]
        : featuredServices;

    return (
        <motion.div {...fadeUp(2)} className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold text-slate-800">Revenue by Service</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Top contributors this month</p>
                </div>
                {!loading ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                        Total {peso(monthlyTotal)}
                    </span>
                ) : null}
            </div>

            {!loading && monthlyTotal <= 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                    No service revenue recorded for this month yet.
                </div>
            ) : (
                <div className="space-y-3.5">
                    {(loading ? SERVICE_CONFIG.slice(0, 5) : displayServices).map(({ key, label, color, amount = 0 }) => {
                        const pct = monthlyTotal > 0 ? (amount / monthlyTotal) * 100 : 0;

                        return (
                            <div key={key}>
                                <div className="flex items-center justify-between gap-3 mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                        <span className="text-xs font-medium text-slate-600">{label}</span>
                                    </div>
                                    {loading ? (
                                        <Skeleton className="h-3.5 w-16" />
                                    ) : (
                                        <div className="text-right">
                                            <span className="text-xs font-semibold text-slate-700 tabular-nums">{peso(amount)}</span>
                                            <p className="text-[10px] text-slate-400">{pct.toFixed(0)}%</p>
                                        </div>
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
            )}
        </motion.div>
    );
}

const DRILLDOWN_SOURCES = [
    { value: 'all', label: 'All Sources' },
    { value: 'visits', label: 'Visits' },
    { value: 'orthodontics', label: 'Orthodontics' },
];

const DRILLDOWN_METRICS = [
    { value: 'collected', label: 'Collected' },
    { value: 'outstanding', label: 'Outstanding' },
];

function SourceChip({ sourceType }) {
    const classes = {
        visit: 'bg-blue-50 text-blue-700',
        ortho_downpayment: 'bg-emerald-50 text-emerald-700',
        ortho_adjustment: 'bg-teal-50 text-teal-700',
        ortho_balance: 'bg-rose-50 text-rose-700',
    };

    const labels = {
        visit: 'Visit',
        ortho_downpayment: 'Downpayment',
        ortho_adjustment: 'Adjustment',
        ortho_balance: 'Balance',
    };

    return (
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${classes[sourceType] || 'bg-slate-100 text-slate-600'}`}>
            {labels[sourceType] || sourceType}
        </span>
    );
}

function RevenueDrilldownPanel({
    isVisible,
    hasRange,
    bucket,
    metric,
    onMetricChange,
    source,
    dateBasis,
    onSourceChange,
    data,
    loading,
    error,
}) {
    if (!isVisible) return null;

    const summary = bucket
        ? `${bucket.label} • ${metric === 'collected' ? 'collected records' : 'outstanding records'} • ${dateBasis === 'recorded' ? 'record date' : 'activity date'}`
        : 'Select a daily bar to inspect the exact records behind that total.';

    return (
        <motion.section {...fadeUp(2)} className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="font-semibold text-slate-800">Revenue Drilldown</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{summary}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                        {DRILLDOWN_METRICS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onMetricChange(option.value)}
                                disabled={!bucket || loading}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-[9px] transition-all duration-200 ${
                                    metric === option.value ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:text-slate-300'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                        {DRILLDOWN_SOURCES.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onSourceChange(option.value)}
                                disabled={!bucket || loading}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-[9px] transition-all duration-200 ${
                                    source === option.value ? 'bg-[#0F6E56] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 disabled:text-slate-300'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {!hasRange ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                    Select both custom dates above to load daily revenue and patient records.
                </div>
            ) : !bucket ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                    Click a daily bar from the chart above to see the exact patients behind that revenue total.
                </div>
            ) : loading ? (
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Skeleton className="h-20 rounded-2xl" />
                        <Skeleton className="h-20 rounded-2xl" />
                        <Skeleton className="h-20 rounded-2xl" />
                    </div>
                    <Skeleton className="h-12 rounded-xl" />
                    <Skeleton className="h-48 rounded-2xl" />
                </div>
            ) : error ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {error}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Selected Period</p>
                            <p className="text-sm font-semibold text-slate-700">{bucket.label}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Total</p>
                            <p className="text-lg font-bold text-slate-800">{peso(data?.total)}</p>
                        </div>
                        <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Records</p>
                            <p className="text-lg font-bold text-slate-800">{data?.count ?? 0}</p>
                        </div>
                    </div>

                    {data?.breakdown?.length ? (
                        <div className="flex flex-wrap gap-2">
                            {data.breakdown.map((item) => (
                                <span key={item.sourceType} className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                                    {item.label}: {peso(item.total)}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {data?.rows?.length ? (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Patient</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Type</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Activity Date</th>
                                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recorded Date</th>
                                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {data.rows.map((row) => (
                                        <tr key={`${row.sourceType}-${row.entryId}`} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3">
                                                <Link to={`/patients/${row.patientId}`} className="font-medium text-slate-700 hover:text-[#0F6E56]">
                                                    {row.patientName}
                                                </Link>
                                                {row.details ? <p className="text-[11px] text-slate-400 mt-0.5">{row.details}</p> : null}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col items-start gap-1">
                                                    <SourceChip sourceType={row.sourceType} />
                                                    <span className="text-xs text-slate-500">{row.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{formatDate(row.activityAt)}</td>
                                            <td className="px-4 py-3 text-slate-600">{formatDateTime(row.recordedAt)}</td>
                                            <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{peso(row.amount)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                            No {metric === 'collected' ? 'collected' : 'outstanding'} records matched this period for the selected source.
                        </div>
                    )}
                </>
            )}
        </motion.section>
    );
}

function AmountBadge({ amount }) {
    const n = parseFloat(amount);
    if (n > 20_000) {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 ring-1 ring-red-200/60">{peso(n)}</span>;
    }
    if (n >= 5_000) {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 ring-1 ring-amber-200/60">{peso(n)}</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">{peso(n)}</span>;
}

function OutstandingMiniList({ patients, loading }) {
    return (
        <motion.div {...fadeUp(3)} className="bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.06)] overflow-hidden">
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
                <Link to="/patients?outstanding=1" className="flex items-center gap-1 text-xs font-semibold text-[#0F6E56] hover:text-emerald-700 transition-colors">
                    View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>

            <div className="divide-y divide-slate-50">
                {loading ? (
                    [1, 2, 3, 4, 5].map((index) => (
                        <div key={index} className="flex items-center gap-3 px-5 py-3.5">
                            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                            <div className="flex-1">
                                <Skeleton className="h-3.5 w-32 mb-1" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                    ))
                ) : patients?.length ? (
                    patients.map((patient) => (
                        <Link key={patient.id} to={`/patients/${patient.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/80 transition-colors">
                            <PatientAvatar patient={patient} />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{formatName(patient, 'last-first')}</p>
                                <p className="text-[11px] text-slate-400">Last visit: {patient.last_visit ? formatDate(patient.last_visit) : '—'}</p>
                            </div>
                            <AmountBadge amount={patient.outstanding_amount} />
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

export default function RevenueSection() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [trendPeriod, setTrendPeriod] = useState('6m');
    const [dateBasis, setDateBasis] = useState('activity');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [selectedBucket, setSelectedBucket] = useState(null);
    const [selectedMetric, setSelectedMetric] = useState('collected');
    const [drilldownSource, setDrilldownSource] = useState('all');
    const [drilldownData, setDrilldownData] = useState(null);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [drilldownError, setDrilldownError] = useState('');

    const fetchRevenue = useCallback(async (period, basis, from, to) => {
        if (period === 'custom' && (!from || !to)) return;
        setLoading(true);
        setError('');
        try {
            const params = { trend: period, dateBasis: basis };
            if (period === 'custom') {
                params.dateFrom = from;
                params.dateTo = to;
            }
            const res = await client.get('/dashboard/revenue', { params });
            setData(res.data);
        } catch (err) {
            console.error('Revenue section fetch failed', err);
            setData({
                thisMonth: 0,
                lastMonth: 0,
                lastMonthName: '',
                outstanding: 0,
                outstandingPatientCount: 0,
                collectionRate: 0,
                dateBasis: basis,
                trend: [],
                services: {},
                topOutstanding: [],
            });
            setError(err.response?.data?.error || 'Failed to load revenue data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRevenue(trendPeriod, dateBasis, customFrom, customTo);
    }, [fetchRevenue, trendPeriod, dateBasis, customFrom, customTo]);

    const drilldownEnabled = trendPeriod === 'custom' && Boolean(customFrom && customTo);

    const fetchDrilldown = useCallback(async (bucket, basis, metric, source) => {
        if (!bucket?.bucketStart || !bucket?.bucketEnd) {
            setDrilldownData(null);
            return;
        }

        setDrilldownLoading(true);
        setDrilldownError('');

        try {
            const res = await client.get('/dashboard/revenue/drilldown', {
                params: {
                    dateBasis: basis,
                    metric,
                    source,
                    startDate: toLocalDateInput(bucket.bucketStart),
                    endDate: toLocalDateInput(bucket.bucketEnd),
                },
            });
            setDrilldownData(res.data);
        } catch (err) {
            console.error('Revenue drilldown fetch failed', err);
            setDrilldownData(null);
            setDrilldownError(err.response?.data?.error || 'Failed to load drilldown details.');
        } finally {
            setDrilldownLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedBucket) return;
        fetchDrilldown(selectedBucket, dateBasis, selectedMetric, drilldownSource);
    }, [selectedBucket, dateBasis, selectedMetric, drilldownSource, fetchDrilldown]);

    const handlePeriodChange = (period) => {
        setTrendPeriod(period);
        setSelectedBucket(null);
        setDrilldownData(null);
        setDrilldownError('');
        setDrilldownSource('all');
        if (period !== 'custom') {
            setCustomFrom('');
            setCustomTo('');
        }
    };

    const handleCustomChange = (field, value) => {
        setSelectedBucket(null);
        setDrilldownData(null);
        setDrilldownError('');
        if (field === 'from') setCustomFrom(value);
        else setCustomTo(value);
    };

    const handleBucketSelect = ({ bucket, metric }) => {
        setSelectedBucket(bucket);
        setSelectedMetric(metric);
        setDrilldownSource('all');
    };

    const moDelta = data
        ? data.lastMonth > 0
            ? Math.round(((data.thisMonth - data.lastMonth) / data.lastMonth) * 100)
            : data.thisMonth > 0 ? 100 : 0
        : null;

    const deltaColor = moDelta === null ? 'text-slate-400' : moDelta > 0 ? 'text-emerald-600' : moDelta < 0 ? 'text-red-500' : 'text-slate-400';
    const collectionFlagColor = data?.collectionRate < 80 ? 'text-red-600' : 'text-slate-800';
    const revenueComparisonLabel = moDelta === null
        ? `vs ${data?.lastMonthName || 'last month'}`
        : `${moDelta >= 0 ? '+' : ''}${moDelta}% vs ${data?.lastMonthName || 'last month'}`;
    const showComparisonCard = Boolean(data?.showComparisonCard);

    return (
        <div className="space-y-5">
            {error && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm text-amber-800">{error}</p>
                    <button type="button" className="btn-secondary text-sm" onClick={() => fetchRevenue(trendPeriod, dateBasis, customFrom, customTo)}>
                        Retry
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#0F6E56]" />
                <div>
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Revenue Overview</h2>
                    <p className="text-xs text-slate-400">A simpler snapshot of collections, balances, and service mix.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <MetricCard
                    index={0}
                    icon={Banknote}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                    label="Monthly Revenue"
                    value={data ? peso(data.thisMonth) : null}
                    sublabel={revenueComparisonLabel}
                    sublabelColor={deltaColor}
                    loading={loading}
                />
                {showComparisonCard && (
                <MetricCard
                    index={1}
                    icon={Banknote}
                    iconBg="bg-slate-100"
                    iconColor="text-slate-400"
                    label="Last Month"
                    value={data ? peso(data.lastMonth) : null}
                    sublabel={data?.lastMonthName ?? '—'}
                    loading={loading}
                />
                )}
                <MetricCard
                    index={1}
                    icon={AlertCircle}
                    iconBg="bg-red-50"
                    iconColor="text-red-500"
                    label="Total Outstanding"
                    value={data ? peso(data.outstanding) : null}
                    sublabel={data ? `${data.outstandingPatientCount} patient${data.outstandingPatientCount !== 1 ? 's' : ''} with balance` : '—'}
                    sublabelColor="text-red-400"
                    loading={loading}
                />
                <MetricCard
                    index={2}
                    icon={Percent}
                    iconBg={data?.collectionRate < 80 ? 'bg-red-50' : 'bg-teal-50'}
                    iconColor={data?.collectionRate < 80 ? 'text-red-500' : 'text-teal-600'}
                    label="Overall Collection Rate"
                    value={data ? `${data.collectionRate}%` : null}
                    sublabel={data?.collectionRate < 80 ? 'Overall paid vs billed is below target' : 'Overall paid vs billed is on track'}
                    sublabelColor={data?.collectionRate < 80 ? 'text-red-400' : 'text-emerald-500'}
                    flag={collectionFlagColor}
                    loading={loading}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2">
                    <RevenueTrendChart
                        trend={data?.trend}
                        trendPeriod={trendPeriod}
                        onPeriodChange={handlePeriodChange}
                        dateBasis={dateBasis}
                        onDateBasisChange={setDateBasis}
                        customFrom={customFrom}
                        customTo={customTo}
                        onCustomChange={handleCustomChange}
                        onBucketSelect={handleBucketSelect}
                        drilldownEnabled={drilldownEnabled}
                        loading={loading}
                    />
                </div>
                <div className="lg:col-span-1">
                    <ServiceBreakdown services={data?.services} loading={loading} />
                </div>
            </div>

            <RevenueDrilldownPanel
                isVisible={drilldownEnabled && Boolean(selectedBucket || drilldownLoading || drilldownError)}
                hasRange={drilldownEnabled}
                bucket={selectedBucket}
                metric={selectedMetric}
                onMetricChange={setSelectedMetric}
                source={drilldownSource}
                dateBasis={dateBasis}
                onSourceChange={setDrilldownSource}
                data={drilldownData}
                loading={drilldownLoading}
                error={drilldownError}
            />

            <OutstandingMiniList patients={data?.topOutstanding} loading={loading} />
        </div>
    );
}
