import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Users, UserPlus, Calendar, Settings, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getInitials, capitalize } from '../utils/helpers';

const navItems = [
    { to: '/dashboard',    icon: Home,     label: 'Dashboard'    },
    { to: '/appointments', icon: Calendar, label: 'Appointments' },
    { to: '/patients',     icon: Users,    label: 'Patients'     },
    { to: '/patients/new', icon: UserPlus, label: 'Add Patient'  },
    { to: '/settings',     icon: Settings, label: 'Settings'     },
];

export default function Sidebar({ open, onClose }) {
    const { admin, logout } = useAuth();
    const location = useLocation();

    return (
        <>
            {/* Mobile backdrop */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar panel — original dark teal gradient */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-40 w-64 flex flex-col
                    bg-gradient-to-b from-primary-dark via-primary to-primary-light
                    lg:static lg:z-auto transition-transform duration-300 ease-in-out
                    lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}
                `}
                style={{ boxShadow: '4px 0 24px rgba(10,74,64,0.20)' }}
            >
                {/* Logo area */}
                <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
                    <img
                        src="/logo.png"
                        alt="Clinic Logo"
                        className="w-44 h-auto object-contain"
                    />
                    <button
                        onClick={onClose}
                        aria-label="Close menu"
                        className="lg:hidden text-white/70 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.to
                            || (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={onClose}
                                className={({ isActive: linkActive }) =>
                                    `nav-item ${(linkActive || isActive) ? 'active' : ''}`
                                }
                            >
                                <item.icon className="w-5 h-5 shrink-0" />
                                <span>{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* User footer */}
                <div className="px-3 py-4 border-t border-white/10">
                    <div className="flex items-center gap-3 px-2 py-2 mb-2">
                        {admin?.profile_photo ? (
                            <img
                                src={admin.profile_photo}
                                alt={admin.full_name}
                                className="w-9 h-9 rounded-full object-cover shrink-0 border-2 border-white/30"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {getInitials(admin?.full_name || 'Admin')}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate leading-tight">
                                {admin?.full_name}
                            </p>
                            <p className="text-white/60 text-xs leading-tight">
                                {capitalize(admin?.role || 'admin')}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                    className="w-full nav-item text-white hover:text-red-300 hover:bg-red-500/10"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
