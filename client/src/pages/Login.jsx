import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, MapPin, Phone, AlertCircle, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Login() {
    const [form, setForm] = useState({ username: '', password: '', remember: false });
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, admin } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (admin) navigate('/dashboard', { replace: true });
    }, [admin, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.password) { setError('Please enter username and password.'); return; }
        setLoading(true); setError('');
        try {
            await login(form.username, form.password);
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh flex bg-bg">

            {/* ── Left brand panel ── */}
            <motion.div
                className="hidden lg:flex lg:w-5/12 xl:w-2/5 relative overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg, #051f19 0%, #0a6352 55%, #0d8a6e 100%)',
                }}
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Decorative blobs */}
                <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
                <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-white/5 blur-2xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] rounded-full bg-primary/20 blur-3xl" />

                {/* Grid dot pattern */}
                <svg className="absolute inset-0 w-full h-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1.5" fill="white" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dots)" />
                </svg>

                {/* Tooth silhouettes */}
                <svg className="absolute inset-0 w-full h-full opacity-[0.06]" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <g key={i} transform={`translate(${(i % 3) * 140 + 20}, ${Math.floor(i / 3) * 220 + 60})`}>
                            <path d="M40 0 C60 0 80 20 80 50 C80 80 70 100 60 120 C55 135 50 145 40 145 C30 145 25 135 20 120 C10 100 0 80 0 50 C0 20 20 0 40 0 Z" fill="white" />
                        </g>
                    ))}
                </svg>

                {/* Content */}
                <div className="relative flex flex-col items-center justify-center w-full px-12 text-white">
                    {/* Brand icon + logo */}
                    <motion.div
                        className="flex flex-col items-center mb-8"
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.5 }}
                    >
                        <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-5 shadow-lg">
                            <Stethoscope className="w-8 h-8 text-white" />
                        </div>
                        <img src="/logo.png" alt="Clinic Logo" className="w-56 h-auto object-contain" />
                        <p className="text-white/60 text-sm mt-3 text-center tracking-wide">
                            Clinic Management System
                        </p>
                    </motion.div>

                    {/* Info card */}
                    <motion.div
                        className="bg-white/10 backdrop-blur-sm rounded-2xl p-5 w-full max-w-xs border border-white/20 shadow-lg"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5, duration: 0.5 }}
                    >
                        <p className="font-semibold text-sm mb-3 text-white flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot inline-block" />
                            Plaza Maestro Clinic
                        </p>
                        <div className="flex items-start gap-2.5 text-sm text-white/65 mb-2.5">
                            <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-white/50" />
                            <span className="leading-snug">Plaza Maestro Annex, Burgos St., Vigan City, Ilocos Sur</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-white/65">
                            <Phone className="w-4 h-4 shrink-0 text-white/50" />
                            <span>Tel. 722-2420</span>
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            {/* ── Right login form ── */}
            <motion.div
                className="flex-1 flex items-center justify-center bg-white p-6 sm:p-10"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="w-full max-w-md">

                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-btn">
                            <Stethoscope className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-text-primary leading-tight">Dental Health Records</p>
                            <p className="text-xs text-slate-400">Plaza Maestro Clinic</p>
                        </div>
                    </div>

                    {/* Heading */}
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-text-primary">Welcome back</h2>
                        <p className="text-slate-400 text-sm mt-1.5">Sign in to your clinic account to continue</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">

                        {/* Username */}
                        <div>
                            <label className="form-label" htmlFor="username">Username</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    id="username"
                                    type="text"
                                    placeholder="Enter your username"
                                    className="form-input pl-10"
                                    value={form.username}
                                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="form-label" htmlFor="password">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    id="password"
                                    type={showPass ? 'text' : 'password'}
                                    placeholder="Enter your password"
                                    className="form-input pl-10 pr-11"
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    onClick={() => setShowPass(!showPass)}
                                >
                                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember me */}
                        <div className="flex items-center gap-2.5">
                            <input
                                id="remember"
                                type="checkbox"
                                className="w-4 h-4 rounded-md border-slate-300 text-primary focus:ring-primary/30 cursor-pointer"
                                checked={form.remember}
                                onChange={e => setForm(f => ({ ...f, remember: e.target.checked }))}
                            />
                            <label htmlFor="remember" className="text-sm text-slate-500 cursor-pointer select-none">
                                Remember me for 30 days
                            </label>
                        </div>

                        {/* Error */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2.5 text-sm text-red-600 bg-red-50 border border-red-200/60 rounded-xl px-3.5 py-2.5"
                            >
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </motion.div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full py-3 text-[15px] mt-2"
                        >
                            {loading
                                ? <><LoadingSpinner size="sm" /> Signing in...</>
                                : 'Sign In'
                            }
                        </button>
                    </form>

                    <p className="text-center text-xs text-slate-400 mt-10">
                        © 2026 Plaza Maestro Dental Clinic · Vigan City, Ilocos Sur
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
