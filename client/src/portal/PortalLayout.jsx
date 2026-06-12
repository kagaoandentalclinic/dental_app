import { NavLink, Outlet } from 'react-router-dom';
import { Calendar, Clock3, Home, LogOut, UserCircle2 } from 'lucide-react';
import { usePortalAuth } from '../context/PortalAuthContext';

const navItems = [
    { to: '/portal/dashboard', label: 'Home', icon: Home },
    { to: '/portal/book', label: 'Book', icon: Calendar },
    { to: '/portal/history', label: 'History', icon: Clock3 },
    { to: '/portal/profile', label: 'Profile', icon: UserCircle2 },
];

export default function PortalLayout() {
    const { patient, logout } = usePortalAuth();

    return (
        <div className="min-h-screen bg-slate-50">
            <header className="sticky top-0 z-10 border-b border-emerald-950/10 bg-[linear-gradient(180deg,#17362d_0%,#21473b_100%)] text-white shadow-lg shadow-emerald-950/10">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-inner shadow-white/5">
                            <img src="/logo.png" alt="Kagaoan Dental Clinic" className="h-8 w-auto object-contain sm:h-10" />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 sm:text-xs">Kagaoan Dental Clinic</p>
                            <h1 className="text-base font-bold text-white sm:text-lg">Patient Portal</h1>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="min-w-0 sm:text-right">
                            <p className="truncate text-sm font-semibold text-white">{patient?.full_name}</p>
                            <p className="truncate text-xs text-emerald-100/80">Your smile, our priority</p>
                        </div>
                        <button type="button" onClick={logout} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white px-3 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-emerald-50 min-h-[44px] sm:px-4">
                            <LogOut className="w-4 h-4" />
                            <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
                <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 sm:px-6">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors min-h-[44px] sm:px-4 ${
                                isActive ? 'bg-white text-primary' : 'bg-white/10 text-emerald-50 hover:bg-white/15'
                            }`}
                        >
                            <item.icon className="w-4 h-4" />
                            {item.label}
                        </NavLink>
                    ))}
                </div>
            </header>
            <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
                <Outlet />
            </main>
        </div>
    );
}
