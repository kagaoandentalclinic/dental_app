import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Bell, Calendar, Clock } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { getInitials, capitalize } from '../utils/helpers';
import client from '../api/client';

// Page title map
const PAGE_TITLES = {
    '/dashboard':    { title: 'Dashboard',    subtitle: 'Overview of today\'s clinic activity' },
    '/appointments': { title: 'Appointments', subtitle: 'Manage patient appointments' },
    '/patients':     { title: 'Patients',     subtitle: 'Manage patient records' },
    '/patients/new': { title: 'New Patient',  subtitle: 'Register a new patient' },
    '/settings':     { title: 'Settings',     subtitle: 'Configure clinic settings' },
};

function NotificationDropdown({ onClose }) {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const ref = useRef(null);

    useEffect(() => {
        client.get('/appointments/notifications')
            .then(r => setData(r.data))
            .catch(() => setData({ pending: [], today: [] }))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) onClose();
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [onClose]);

    const goToAppointments = () => { navigate('/appointments'); onClose(); };
    const total = (data?.pending?.length || 0) + (data?.today?.length || 0);

    return (
        <div ref={ref}
            className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-sm bg-white border border-slate-200 rounded-2xl shadow-modal z-50 overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <p className="font-semibold text-text-primary text-sm">Notifications</p>
                {!loading && total > 0 && (
                    <span className="text-xs font-bold bg-primary text-white px-2 py-0.5 rounded-full">{total}</span>
                )}
            </div>

            <div className="max-h-96 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : total === 0 ? (
                    <div className="py-10 text-center">
                        <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">You're all caught up!</p>
                    </div>
                ) : (
                    <>
                        {/* Pending requests */}
                        {data.pending.length > 0 && (
                            <div>
                                <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Pending Requests
                                </p>
                                {data.pending.map(appt => (
                                    <button key={appt.id} onClick={goToAppointments}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 border-b border-slate-100 last:border-0"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                            <Clock className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-text-primary truncate">
                                                {appt.last_name}, {appt.first_name}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                Requested {capitalize(appt.appointment_type)} · {format(new Date(appt.appointment_date), 'MMM d, h:mm a')}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Today's schedule */}
                        {data.today.length > 0 && (
                            <div>
                                <p className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                    Today's Schedule
                                </p>
                                {data.today.map(appt => (
                                    <button key={appt.id} onClick={goToAppointments}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 border-b border-slate-100 last:border-0"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                                            <Calendar className="w-4 h-4 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-text-primary truncate">
                                                {appt.last_name}, {appt.first_name}
                                            </p>
                                            <p className="text-xs text-slate-400 mt-0.5">
                                                {capitalize(appt.appointment_type)} · {format(new Date(appt.appointment_date), 'h:mm a')}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
                <button onClick={goToAppointments}
                    className="text-xs font-semibold text-primary hover:underline w-full text-center"
                >
                    View all appointments →
                </button>
            </div>
        </div>
    );
}

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [bellOpen, setBellOpen] = useState(false);
    const [badgeCount, setBadgeCount] = useState(0);
    const { admin } = useAuth();
    const location = useLocation();

    // Resolve page title from current path
    const pageInfo = PAGE_TITLES[location.pathname]
        || (location.pathname.startsWith('/patients/') && location.pathname !== '/patients/new'
            ? { title: 'Patient Profile', subtitle: 'Detailed patient record' }
            : { title: 'Clinic', subtitle: '' });

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    useEffect(() => {
        client.get('/appointments/notifications')
            .then(r => setBadgeCount((r.data.pending?.length || 0) + (r.data.today?.length || 0)))
            .catch(() => {});
    }, []);

    const handleBellClose = useCallback(() => setBellOpen(false), []);

    return (
        <div className="flex h-dvh min-h-screen overflow-hidden bg-bg">

            {/* Desktop sidebar */}
            <div className="hidden lg:flex lg:w-64 lg:shrink-0">
                <Sidebar open={true} onClose={() => {}} />
            </div>

            {/* Mobile sidebar */}
            <div className="lg:hidden">
                <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main content area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

                {/* ── Top Bar ── */}
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between gap-4 px-4 sm:px-6 shrink-0"
                    style={{ boxShadow: '0 1px 0 #E2E8F0' }}
                >
                    {/* Left: hamburger + page context */}
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            className="lg:hidden btn-icon"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open menu"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        {/* Page title shown on desktop */}
                        <div className="hidden sm:block">
                            <h1 className="text-[15px] font-bold text-text-primary leading-tight">
                                {pageInfo.title}
                            </h1>
                            {pageInfo.subtitle && (
                                <p className="text-xs text-slate-400 leading-tight">
                                    {pageInfo.subtitle}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right: date, notification bell, admin profile */}
                    <div className="flex items-center gap-2 sm:gap-3">

                        {/* Date chip — desktop only */}
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-xs font-medium text-slate-500">
                                {format(new Date(), 'EEE, MMM d')}
                            </span>
                        </div>

                        {/* Bell */}
                        <div className="relative">
                            <button
                                className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200
                                           text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-all duration-200"
                                onClick={() => setBellOpen(o => !o)}
                                aria-label="Notifications"
                            >
                                <Bell className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
                                {badgeCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shadow">
                                        {badgeCount > 9 ? '9+' : badgeCount}
                                    </span>
                                )}
                            </button>
                            {bellOpen && <NotificationDropdown onClose={handleBellClose} />}
                        </div>

                        {/* Admin profile chip */}
                        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                            <div className="hidden sm:block text-right">
                                <p className="text-xs font-semibold text-text-primary leading-tight">
                                    {admin?.full_name || 'Admin'}
                                </p>
                                <p className="text-[10px] text-slate-400 leading-tight">
                                    {capitalize(admin?.role || 'admin')}
                                </p>
                            </div>
                            {admin?.profile_photo ? (
                                <img
                                    src={admin.profile_photo}
                                    alt={admin.full_name}
                                    className="w-9 h-9 rounded-xl object-cover shrink-0 border-2 border-white shadow-btn cursor-pointer"
                                />
                            ) : (
                                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm cursor-pointer hover:bg-primary-light transition-colors shadow-btn shrink-0">
                                    {getInitials(admin?.full_name || 'A')}
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* ── Page content ── */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
