import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, UserPlus, Eye, Pencil, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import client from '../api/client';
import { formatName, calcAge, formatDate, debounce } from '../utils/helpers';
import EmptyState from '../components/EmptyState';

const SORTABLE_COLUMNS = new Set(['last_name', 'date_of_birth', 'phone', 'created_at']);

function getInitialSort(searchParams) {
    const sort = searchParams.get('sort');
    return SORTABLE_COLUMNS.has(sort) ? sort : 'last_name';
}

function getInitialOrder(searchParams) {
    return searchParams.get('order') === 'desc' ? 'desc' : 'asc';
}

function getInitialPage(searchParams) {
    const page = parseInt(searchParams.get('page') || '1', 10);
    return Number.isNaN(page) || page < 1 ? 1 : page;
}

function SkeletonRow() {
    return (
        <tr>
            <td className="hidden md:table-cell px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
            <td className="px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
            <td className="hidden sm:table-cell px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
            <td className="hidden md:table-cell px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
            <td className="hidden sm:table-cell px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
            <td className="hidden lg:table-cell px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
            <td className="hidden sm:table-cell px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
            <td className="px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
            <td className="px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
        </tr>
    );
}

export default function PatientList() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [data, setData] = useState({ patients: [], total: 0, totalPages: 1 });
    const [search, setSearch] = useState(() => searchParams.get('search') || '');
    const [page, setPage] = useState(() => getInitialPage(searchParams));
    const [sortCol, setSortCol] = useState(() => getInitialSort(searchParams));
    const [sortOrder, setSortOrder] = useState(() => getInitialOrder(searchParams));
    const [visitDate, setVisitDate] = useState(() => searchParams.get('visitDate') || '');
    const [outstandingOnly] = useState(() => ['1', 'true'].includes((searchParams.get('outstanding') || '').toLowerCase()));
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const isRecentView = sortCol === 'created_at';
    const hasVisitDateFilter = Boolean(visitDate);

    const fetchPatients = useCallback(async (q, p, col, ord, selectedVisitDate, outstandingFilter) => {
        setLoading(true);
        try {
            const res = await client.get('/patients', {
                params: {
                    search: q,
                    page: p,
                    limit: 15,
                    sort: col,
                    order: ord,
                    visitDate: selectedVisitDate || undefined,
                    outstanding: outstandingFilter ? '1' : undefined,
                }
            });
            setData(res.data);
        } finally {
            setLoading(false);
        }
    }, []);

    const debouncedFetch = useRef(debounce((q, p, col, ord, selectedVisitDate, outstandingFilter) => (
        fetchPatients(q, p, col, ord, selectedVisitDate, outstandingFilter)
    ), 300)).current;

    useEffect(() => {
        debouncedFetch(search, page, sortCol, sortOrder, visitDate, outstandingOnly);
    }, [search, page, sortCol, sortOrder, visitDate, outstandingOnly, debouncedFetch]);

    useEffect(() => {
        const nextParams = new URLSearchParams();
        if (search) nextParams.set('search', search);
        if (page > 1) nextParams.set('page', String(page));
        if (visitDate) nextParams.set('visitDate', visitDate);
        if (outstandingOnly) nextParams.set('outstanding', '1');
        if (sortCol !== 'last_name' || sortOrder !== 'asc') {
            nextParams.set('sort', sortCol);
            nextParams.set('order', sortOrder);
        }
        setSearchParams(nextParams, { replace: true });
    }, [outstandingOnly, page, search, visitDate, setSearchParams, sortCol, sortOrder]);

    const handleSort = (col) => {
        if (col === sortCol) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        else {
            setSortCol(col);
            setSortOrder(col === 'created_at' ? 'desc' : 'asc');
        }
        setPage(1);
    };

    const SortIcon = ({ col }) => {
        if (col !== sortCol) return null;
        return sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
    };

    const start = (page - 1) * 15 + 1;
    const end = Math.min(page * 15, data.total);

    const clearVisitDateFilter = () => {
        setVisitDate('');
        setPage(1);
    };

    return (
        <div className="space-y-5 animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-text-primary">
                        {outstandingOnly ? 'Outstanding Balances' : isRecentView ? 'Recent Patients' : 'Patients'}
                    </h1>
                    <p className="text-sm text-slate-400 mt-0.5">
                        {outstandingOnly
                            ? `${data.total} patients with outstanding balances`
                            : hasVisitDateFilter
                            ? `${data.total} patients matched the selected visit date`
                            : isRecentView
                            ? `${data.total} records sorted by registration date`
                            : `${data.total} total records`}
                    </p>
                </div>
                <Link to="/patients/new" className="btn-primary w-full sm:w-auto">
                    <UserPlus className="w-4 h-4" /> Add Patient
                </Link>
            </div>

            {/* Search */}
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input
                    type="text"
                    placeholder="Search by name, phone, email..."
                    className="form-input pl-10"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
            </div>

            {/* Table */}
            <div className="card p-0 overflow-hidden">
                <div className="overflow-x-hidden">
                    <table className="data-table w-full">
                        <thead>
                            <tr>
                                <th className="hidden md:table-cell whitespace-nowrap">#</th>
                                <th
                                    className="whitespace-nowrap cursor-pointer hover:text-primary select-none"
                                    onClick={() => handleSort('last_name')}
                                >
                                    <span className="flex items-center gap-1">
                                        Name <SortIcon col="last_name" />
                                    </span>
                                </th>
                                <th
                                    className="hidden sm:table-cell whitespace-nowrap cursor-pointer hover:text-primary select-none"
                                    onClick={() => handleSort('date_of_birth')}
                                >
                                    <span className="flex items-center gap-1">
                                        Age <SortIcon col="date_of_birth" />
                                    </span>
                                </th>
                                <th className="hidden md:table-cell whitespace-nowrap">Sex</th>
                                <th
                                    className="hidden sm:table-cell whitespace-nowrap cursor-pointer hover:text-primary select-none"
                                    onClick={() => handleSort('phone')}
                                >
                                    <span className="flex items-center gap-1">
                                        Phone <SortIcon col="phone" />
                                    </span>
                                </th>
                                <th
                                    className="hidden lg:table-cell whitespace-nowrap cursor-pointer hover:text-primary select-none"
                                    onClick={() => handleSort('created_at')}
                                >
                                    <span className="flex items-center gap-1">
                                        Registered <SortIcon col="created_at" />
                                    </span>
                                </th>
                                <th className="hidden sm:table-cell whitespace-nowrap align-top">
                                    <div className="flex flex-col gap-2 min-w-[10rem]">
                                        <span>Last Visit</span>
                                        <input
                                            type="date"
                                            className="form-input text-xs min-w-0"
                                            value={visitDate}
                                            onChange={e => {
                                                setVisitDate(e.target.value);
                                                setPage(1);
                                            }}
                                        />
                                        {hasVisitDateFilter && (
                                            <button
                                                type="button"
                                                onClick={clearVisitDateFilter}
                                                className="text-[11px] font-medium text-primary hover:text-primary-light text-left"
                                            >
                                                Clear date
                                            </button>
                                        )}
                                    </div>
                                </th>
                                <th className="whitespace-nowrap">Issues</th>
                                <th className="whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [1, 2, 3, 4, 5, 6].map(i => <SkeletonRow key={i} />)
                            ) : data.patients.length === 0 ? (
                                <tr><td colSpan={9}>
                                    <EmptyState
                                        icon={Users}
                                        title="No patients found"
                                        message={
                                            search
                                                ? `No results for "${search}"`
                                                : outstandingOnly
                                                    ? 'No patients have outstanding balances.'
                                                : hasVisitDateFilter
                                                    ? 'No patients matched the selected visit date.'
                                                    : 'Start by adding your first patient.'
                                        }
                                        action={<Link to="/patients/new" className="btn-primary">Add Patient</Link>}
                                    />
                                </td></tr>
                            ) : (
                                data.patients.map((p, idx) => (
                                    <motion.tr
                                        key={p.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="cursor-pointer"
                                        onClick={() => navigate(`/patients/${p.id}`)}
                                    >
                                        <td className="hidden md:table-cell text-slate-400 tabular-nums">{start + idx}</td>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                {p.profile_photo ? (
                                                    <img
                                                        src={p.profile_photo}
                                                        alt={formatName(p, 'last-first')}
                                                        className="w-8 h-8 rounded-full object-cover shrink-0 border-2 border-white shadow-sm"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                                        {p.first_name?.[0]}{p.last_name?.[0]}
                                                    </div>
                                                )}
                                                <span className="font-medium text-text-primary">{formatName(p, 'last-first')}</span>
                                            </div>
                                        </td>
                                        <td className="hidden sm:table-cell text-slate-500">{calcAge(p.date_of_birth)} yrs</td>
                                        <td className="hidden md:table-cell text-slate-500 capitalize">{p.sex || '—'}</td>
                                        <td className="hidden sm:table-cell text-slate-500">{p.phone || '—'}</td>
                                        <td className="hidden lg:table-cell text-slate-500">{formatDate(p.created_at)}</td>
                                        <td className="hidden sm:table-cell text-slate-500">{p.last_visit ? formatDate(p.last_visit) : <span className="text-slate-300 italic">No visits</span>}</td>
                                        <td>
                                            {parseInt(p.dental_issues) > 0
                                                ? <span className="badge-red">{p.dental_issues} issue{p.dental_issues !== '1' ? 's' : ''}</span>
                                                : <span className="badge-green">Healthy</span>
                                            }
                                        </td>
                                        <td>
                                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <Link to={`/patients/${p.id}`} className="btn-icon" title="View">
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                                <Link to={`/patients/${p.id}?tab=info`} className="btn-icon" title="Edit">
                                                    <Pencil className="w-4 h-4" />
                                                </Link>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {data.total > 0 && (
                    <div className="px-4 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-slate-400">
                        <span>Showing {start}–{end} of {data.total} patients</span>
                        <div className="flex items-center gap-1">
                            <button
                                className="btn-icon"
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-3 py-1 font-medium text-text-primary">
                                {page} / {data.totalPages}
                            </span>
                            <button
                                className="btn-icon"
                                disabled={page >= data.totalPages}
                                onClick={() => setPage(p => p + 1)}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
