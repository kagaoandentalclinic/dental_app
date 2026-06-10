import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, UserPlus, Eye, Pencil, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import client from '../api/client';
import { formatName, calcAge, formatDate, debounce } from '../utils/helpers';
import EmptyState from '../components/EmptyState';

function SkeletonRow() {
    return (
        <tr>
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <td key={i} className="px-4 py-3.5"><div className="skeleton h-3.5 rounded w-full" /></td>
            ))}
        </tr>
    );
}

export default function PatientList() {
    const [data, setData] = useState({ patients: [], total: 0, totalPages: 1 });
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [sortCol, setSortCol] = useState('last_name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchPatients = useCallback(async (q, p, col, ord) => {
        setLoading(true);
        try {
            const res = await client.get('/patients', {
                params: { search: q, page: p, limit: 15, sort: col, order: ord }
            });
            setData(res.data);
        } finally {
            setLoading(false);
        }
    }, []);

    const debouncedFetch = useRef(debounce((q, p, col, ord) => fetchPatients(q, p, col, ord), 300)).current;

    useEffect(() => {
        debouncedFetch(search, page, sortCol, sortOrder);
    }, [search, page, sortCol, sortOrder, debouncedFetch]);

    const handleSort = (col) => {
        if (col === sortCol) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortOrder('asc'); }
        setPage(1);
    };

    const SortIcon = ({ col }) => {
        if (col !== sortCol) return null;
        return sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />;
    };

    const cols = [
        { key: '#', label: '#', sortable: false },
        { key: 'last_name', label: 'Name', sortable: true },
        { key: 'date_of_birth', label: 'Age', sortable: true },
        { key: 'sex', label: 'Sex', sortable: false },
        { key: 'phone', label: 'Phone', sortable: true },
        { key: 'last_visit', label: 'Last Visit', sortable: false },
        { key: 'dental_issues', label: 'Issues', sortable: false },
        { key: 'actions', label: 'Actions', sortable: false },
    ];

    const start = (page - 1) * 15 + 1;
    const end = Math.min(page * 15, data.total);

    return (
        <div className="space-y-5 animate-fade-up">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-xl font-bold text-text-primary">Patients</h1>
                    <p className="text-sm text-slate-400 mt-0.5">{data.total} total records</p>
                </div>
                <Link to="/patients/new" className="btn-primary">
                    <UserPlus className="w-4 h-4" /> Add Patient
                </Link>
            </div>

            {/* Search */}
            <div className="relative w-full max-w-md">
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
                <div className="overflow-x-auto">
                    <table className="data-table min-w-[860px]">
                        <thead>
                            <tr>
                                {cols.map(col => (
                                    <th
                                        key={col.key}
                                        className={`whitespace-nowrap ${col.sortable ? 'cursor-pointer hover:text-primary select-none' : ''}`}
                                        onClick={() => col.sortable && handleSort(col.key)}
                                    >
                                        <span className="flex items-center gap-1">
                                            {col.label}
                                            {col.sortable && <SortIcon col={col.key} />}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                [1, 2, 3, 4, 5, 6].map(i => <SkeletonRow key={i} />)
                            ) : data.patients.length === 0 ? (
                                <tr><td colSpan={8}>
                                    <EmptyState
                                        icon={Users}
                                        title="No patients found"
                                        message={search ? `No results for "${search}"` : 'Start by adding your first patient.'}
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
                                        <td className="text-slate-400 tabular-nums">{start + idx}</td>
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
                                        <td className="text-slate-500">{calcAge(p.date_of_birth)} yrs</td>
                                        <td className="text-slate-500 capitalize">{p.sex || '—'}</td>
                                        <td className="text-slate-500">{p.phone || '—'}</td>
                                        <td className="text-slate-500">{p.last_visit ? formatDate(p.last_visit) : <span className="text-slate-300 italic">No visits</span>}</td>
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
