import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Mail, Phone, UserRound } from 'lucide-react';
import { usePortalAuth } from '../context/PortalAuthContext';

const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_ALLOWED_ORIGINS = String(import.meta.env.VITE_GOOGLE_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
const emptyRegister = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
};

let googleScriptPromise;
let googleIdentityInitializedForClientId = '';
const portalVerificationRequests = new Map();
const GOOGLE_RENDER_FAILURE_MESSAGE = 'Google sign-in is blocked for this origin. Add the current portal URL to your Google OAuth Authorized JavaScript origins, then restart Vite.';

function loadGoogleScript() {
    if (window.google?.accounts?.id) {
        return Promise.resolve(window.google);
    }

    if (!googleScriptPromise) {
        googleScriptPromise = new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-google-identity="true"]');
            if (existing) {
                existing.addEventListener('load', () => resolve(window.google), { once: true });
                existing.addEventListener('error', reject, { once: true });
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.defer = true;
            script.dataset.googleIdentity = 'true';
            script.onload = () => resolve(window.google);
            script.onerror = () => reject(new Error('Google Sign-In script failed to load.'));
            document.head.appendChild(script);
        });
    }

    return googleScriptPromise;
}

function runGoogleCredentialHandler(credential) {
    return window.__portalGoogleCredentialHandler?.(credential);
}

function isLocalDevelopmentOrigin(origin) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

export default function PortalLogin() {
    const [mode, setMode] = useState('login');
    const [loginForm, setLoginForm] = useState({ email: '', password: '' });
    const [registerForm, setRegisterForm] = useState(emptyRegister);
    const [resetRequestEmail, setResetRequestEmail] = useState('');
    const [resetForm, setResetForm] = useState({ password: '', confirm_password: '' });
    const [showPass, setShowPass] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [requestingReset, setRequestingReset] = useState(false);
    const [resettingPassword, setResettingPassword] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
    const [googleReady, setGoogleReady] = useState(false);
    const [googleRenderError, setGoogleRenderError] = useState('');
    const [googleButtonWidth, setGoogleButtonWidth] = useState(0);
    const googleButtonRef = useRef(null);
    const googleButtonWrapRef = useRef(null);
    const { patient, login, register, verifyEmail, resendVerification, requestPasswordReset, resetPassword, loginWithGoogle } = usePortalAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const currentOrigin = typeof window !== 'undefined'
        ? window.location.origin.replace(/\/$/, '')
        : '';
    const verifyToken = useMemo(() => new URLSearchParams(location.search).get('verify')?.trim() || '', [location.search]);
    const resetToken = useMemo(() => new URLSearchParams(location.search).get('reset')?.trim() || '', [location.search]);
    const googleOriginAllowed = GOOGLE_ALLOWED_ORIGINS.length > 0
        ? GOOGLE_ALLOWED_ORIGINS.includes(currentOrigin)
        : !isLocalDevelopmentOrigin(currentOrigin);
    const googleEnabled = Boolean(GOOGLE_CLIENT_ID && googleOriginAllowed);
    const showGoogleButton = googleEnabled && !resetToken && mode !== 'forgot';

    useEffect(() => {
        if (!patient) return;
        if (verifyToken || resetToken) return;
        navigate('/portal/dashboard', { replace: true });
    }, [patient, navigate, resetToken, verifyToken]);

    useEffect(() => {
        const token = verifyToken;
        if (!token) return;

        let active = true;
        setMode('login');
        setVerifying(true);
        setError('');
        setNotice({ type: 'info', text: 'Confirming your email now...' });

        let request = portalVerificationRequests.get(token);
        if (!request) {
            request = verifyEmail(token).finally(() => {
                portalVerificationRequests.delete(token);
            });
            portalVerificationRequests.set(token, request);
        }

        request
            .then(() => {
                if (!active) return;
                setNotice({ type: 'success', text: 'Your email has been confirmed. Redirecting to your portal...' });
                window.location.replace('/portal/dashboard');
            })
            .catch((err) => {
                if (!active) return;
                setError(err.response?.data?.error || 'That confirmation link is invalid or expired.');
                setNotice(null);
                navigate('/portal', { replace: true });
            })
            .finally(() => {
                if (active) setVerifying(false);
            });

        return () => {
            active = false;
        };
    }, [navigate, verifyEmail, verifyToken]);

    useEffect(() => {
        if (!resetToken) return;
        setMode('login');
        setShowPass(false);
        setShowConfirm(false);
        setError('');
        setPendingVerificationEmail('');
        setResetForm({ password: '', confirm_password: '' });
        setNotice({
            type: 'info',
            text: 'Choose a new password for your portal account.',
        });
    }, [resetToken]);

    useEffect(() => {
        if (!googleEnabled) return undefined;

        const handleGoogleCredential = async (credential) => {
            setLoading(true);
            setError('');
            setNotice(null);
            try {
                await loginWithGoogle(credential);
                navigate('/portal/dashboard', { replace: true });
            } catch (err) {
                setError(err.response?.data?.error || 'Unable to continue with Google right now.');
            } finally {
                setLoading(false);
            }
        };

        window.__portalGoogleCredentialHandler = handleGoogleCredential;
        return () => {
            if (window.__portalGoogleCredentialHandler === handleGoogleCredential) {
                delete window.__portalGoogleCredentialHandler;
            }
        };
    }, [googleEnabled, loginWithGoogle, navigate]);

    useEffect(() => {
        if (!googleEnabled) return undefined;

        let cancelled = false;
        loadGoogleScript()
            .then((google) => {
                if (cancelled || !google?.accounts?.id) return;

                if (googleIdentityInitializedForClientId !== GOOGLE_CLIENT_ID) {
                    setGoogleRenderError('');
                    google.accounts.id.initialize({
                        client_id: GOOGLE_CLIENT_ID,
                        callback: ({ credential }) => runGoogleCredentialHandler(credential),
                    });
                    googleIdentityInitializedForClientId = GOOGLE_CLIENT_ID;
                }

                if (!cancelled) {
                    setGoogleReady(true);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setGoogleRenderError('Google sign-in could not be loaded right now.');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [googleEnabled]);

    useEffect(() => {
        if (!showGoogleButton || !googleButtonRef.current) {
            if (googleButtonRef.current) {
                googleButtonRef.current.innerHTML = '';
            }
            return undefined;
        }
        if (!googleReady || !googleButtonWidth) return undefined;

        const google = window.google;
        if (google?.accounts?.id) {
            setGoogleRenderError('');
            googleButtonRef.current.innerHTML = '';
            google.accounts.id.renderButton(googleButtonRef.current, {
                theme: 'filled_white',
                size: 'large',
                text: mode === 'login' ? 'continue_with' : 'signup_with',
                shape: 'pill',
                logo_alignment: 'left',
                width: googleButtonWidth,
            });
        }

        const timeoutId = window.setTimeout(() => {
            if (googleButtonRef.current && googleButtonRef.current.childElementCount === 0) {
                setGoogleRenderError(GOOGLE_RENDER_FAILURE_MESSAGE);
            }
        }, 600);

        return () => window.clearTimeout(timeoutId);
    }, [googleButtonWidth, googleReady, mode, showGoogleButton]);

    useEffect(() => {
        if (!showGoogleButton || !googleButtonWrapRef.current || typeof ResizeObserver === 'undefined') return undefined;

        const syncWidth = () => {
            setGoogleButtonWidth(Math.max(280, Math.floor(googleButtonWrapRef.current?.clientWidth || 0)));
        };

        syncWidth();

        const observer = new ResizeObserver(() => {
            syncWidth();
        });

        observer.observe(googleButtonWrapRef.current);
        return () => observer.disconnect();
    }, [showGoogleButton]);

    const isRegister = mode === 'register';
    const isForgotPassword = mode === 'forgot';
    const isPasswordResetMode = Boolean(resetToken);
    const compactCard = isRegister || isForgotPassword || isPasswordResetMode;
    const showAuthOptions = !isForgotPassword && !isPasswordResetMode;
    const submitting = loading || verifying || requestingReset || resettingPassword;
    const submitLabel = useMemo(() => {
        if (isPasswordResetMode) return 'Update Password';
        if (isForgotPassword) return 'Send Reset Link';
        return mode === 'login' ? 'Sign In' : 'Create Portal Account';
    }, [isForgotPassword, isPasswordResetMode, mode]);

    const resetToLogin = () => {
        setMode('login');
        setResetRequestEmail('');
        setResetForm({ password: '', confirm_password: '' });
        setShowPass(false);
        setShowConfirm(false);
        setError('');
        setNotice(null);
        if (resetToken) {
            navigate('/portal', { replace: true });
        }
    };

    const openForgotPassword = () => {
        setMode('forgot');
        setResetRequestEmail(loginForm.email);
        setShowPass(false);
        setShowConfirm(false);
        setError('');
        setNotice(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isForgotPassword) {
            setRequestingReset(true);
            setError('');
            setNotice(null);
            try {
                const result = await requestPasswordReset(resetRequestEmail);
                setNotice({
                    type: 'success',
                    text: result.message,
                    previewLink: result.preview_link,
                });
            } catch (err) {
                setError(err.response?.data?.error || 'Unable to send a reset link right now.');
            } finally {
                setRequestingReset(false);
            }
            return;
        }

        if (isPasswordResetMode) {
            setResettingPassword(true);
            setError('');
            try {
                const result = await resetPassword(resetToken, resetForm.password, resetForm.confirm_password);
                setNotice({ type: 'success', text: result.message });
                setResetForm({ password: '', confirm_password: '' });
                navigate('/portal', { replace: true });
                setMode('login');
            } catch (err) {
                const response = err.response?.data;
                setError(response?.error || 'Unable to reset your password right now.');
            } finally {
                setResettingPassword(false);
            }
            return;
        }

        setLoading(true);
        setError('');
        setNotice(null);
        try {
            if (mode === 'login') {
                await login(loginForm.email, loginForm.password);
                navigate('/portal/dashboard', { replace: true });
                return;
            }

            const result = await register(registerForm);
            if (result.requires_verification) {
                setPendingVerificationEmail(result.email || registerForm.email);
                setNotice({
                    type: 'success',
                    text: result.message,
                    previewLink: result.preview_link,
                });
                setLoginForm({ email: registerForm.email, password: '' });
                setRegisterForm(emptyRegister);
                setMode('login');
                return;
            }

            navigate('/portal/dashboard', { replace: true });
        } catch (err) {
            const response = err.response?.data;
            if (response?.code === 'email_not_verified') {
                setPendingVerificationEmail(loginForm.email);
            }
            setError(response?.error || 'Unable to continue right now. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (!pendingVerificationEmail) return;
        setResending(true);
        setError('');
        try {
            const result = await resendVerification(pendingVerificationEmail);
            setNotice({
                type: 'success',
                text: result.message,
                previewLink: result.preview_link,
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to resend the confirmation email right now.');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#0f3328_0%,#1B4332_32%,#f8fafb_32%,#f8fafb_100%)] px-4 pt-16 pb-6 sm:py-16 sm:px-6">
            <Link to="/" className="absolute left-4 top-4 inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/15 sm:left-6 sm:top-6">
                Back to Home
            </Link>

            <div className="w-full max-w-5xl">
                <div>
                    <div className={`card mx-auto w-full max-w-xl rounded-[2rem] ${compactCard ? 'p-4 sm:p-6' : ''}`}>
                        <div className={`text-center ${compactCard ? 'mb-3' : 'mb-6'}`}>
                            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">Patient Portal</p>
                            <h1 className={`font-bold text-text-primary ${compactCard ? 'mt-1 text-xl' : 'mt-2 text-3xl'}`}>
                                {isPasswordResetMode ? 'Reset password' : isForgotPassword ? 'Forgot password' : 'Welcome'}
                            </h1>
                            {!compactCard && (
                                <p className="mt-2 text-sm text-text-secondary">
                                    Sign in or create your portal account to manage appointments from your device.
                                </p>
                            )}
                            {isForgotPassword && (
                                <p className="mt-2 text-sm text-text-secondary">
                                    Enter your portal email and we&apos;ll send you a secure reset link.
                                </p>
                            )}
                            {isPasswordResetMode && (
                                <p className="mt-2 text-sm text-text-secondary">
                                    Create a new password for your portal account to get back in.
                                </p>
                            )}
                        </div>
                        {showAuthOptions && (
                            <div className={`grid grid-cols-2 rounded-2xl bg-slate-100 ${isRegister ? 'gap-1.5 p-0.5' : 'gap-2 p-1'}`}>
                                <button type="button" onClick={() => setMode('login')} className={`rounded-2xl px-4 font-semibold touch-manipulation ${isRegister ? 'py-2.5 text-sm' : 'py-3 text-sm'} ${mode === 'login' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Login</button>
                                <button type="button" onClick={() => setMode('register')} className={`rounded-2xl px-4 font-semibold touch-manipulation ${isRegister ? 'py-2.5 text-sm' : 'py-3 text-sm'} ${mode === 'register' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}>Register</button>
                            </div>
                        )}

                        {notice && (
                            <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                                    <div>
                                        <p>{notice.text}</p>
                                        {notice.previewLink && (
                                            <a href={notice.previewLink} className="mt-2 inline-flex font-semibold text-primary underline underline-offset-2">
                                                Open secure link
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {showAuthOptions && (
                            <div className={`${isRegister ? 'mt-3' : 'mt-6'} flex flex-col items-center`}>
                                {googleEnabled && !googleRenderError ? (
                                    <>
                                        <div ref={googleButtonWrapRef} className="mx-auto w-full max-w-[420px] rounded-2xl border border-slate-200 bg-slate-50/70 p-1.5 shadow-sm">
                                            <div ref={googleButtonRef} className="flex min-h-[40px] w-full justify-center overflow-hidden rounded-full" />
                                        </div>
                                        {!isRegister && (
                                            <p className="mt-3 text-center text-xs text-slate-500">
                                                Sign in faster with your Google account.
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        {googleRenderError || (GOOGLE_CLIENT_ID
                                            ? `Google sign-in is hidden for this origin (${currentOrigin || 'unknown'}). Add it to VITE_GOOGLE_ALLOWED_ORIGINS and your Google OAuth Authorized JavaScript origins, then restart Vite.`
                                            : 'Google sign-in is not configured yet. Add VITE_GOOGLE_CLIENT_ID to the client env and restart Vite.')}
                                    </div>
                                )}
                            </div>
                        )}

                        {showAuthOptions && (
                            <div className={`${isRegister ? 'mt-3 gap-2 text-[10px]' : 'mt-6 gap-3 text-xs'} flex items-center uppercase tracking-[0.18em] text-slate-400`}>
                                <div className="h-px flex-1 bg-slate-200" />
                                <span>{mode === 'login' ? 'Or sign in with email' : 'Or register with email'}</span>
                                <div className="h-px flex-1 bg-slate-200" />
                            </div>
                        )}

                        <form className={`${compactCard ? 'mt-3 space-y-2' : 'mt-6 space-y-4'}`} onSubmit={handleSubmit}>
                            {mode === 'register' && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="form-label text-[11px] tracking-[0.12em]">First Name</label>
                                        <input className="form-input h-10 text-sm" value={registerForm.first_name} onChange={(e) => setRegisterForm(f => ({ ...f, first_name: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="form-label text-[11px] tracking-[0.12em]">Last Name</label>
                                        <input className="form-input h-10 text-sm" value={registerForm.last_name} onChange={(e) => setRegisterForm(f => ({ ...f, last_name: e.target.value }))} />
                                    </div>
                                </div>
                            )}

                            {!isPasswordResetMode && (
                                <div>
                                    <label className={`form-label ${compactCard ? 'text-[11px] tracking-[0.12em]' : ''}`}>Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="email"
                                            className={`form-input pl-10 ${compactCard ? 'h-10 text-sm' : ''}`}
                                            value={isForgotPassword ? resetRequestEmail : mode === 'login' ? loginForm.email : registerForm.email}
                                            onChange={(e) => {
                                                if (isForgotPassword) {
                                                    setResetRequestEmail(e.target.value);
                                                    return;
                                                }
                                                if (mode === 'login') {
                                                    setLoginForm(f => ({ ...f, email: e.target.value }));
                                                    return;
                                                }
                                                setRegisterForm(f => ({ ...f, email: e.target.value }));
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {mode === 'register' && (
                                <div>
                                    <label className="form-label text-[11px] tracking-[0.12em]">Phone</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input className="form-input pl-10 h-10 text-sm" value={registerForm.phone} onChange={(e) => setRegisterForm(f => ({ ...f, phone: e.target.value }))} />
                                    </div>
                                </div>
                            )}

                            {(mode === 'login' || mode === 'register' || isPasswordResetMode) && (
                                <div>
                                    <label className={`form-label ${compactCard ? 'text-[11px] tracking-[0.12em]' : ''}`}>Password</label>
                                    <div className="relative">
                                        <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type={showPass ? 'text' : 'password'}
                                            className={`form-input pl-10 pr-12 ${compactCard ? 'h-10 text-sm' : ''}`}
                                            value={isPasswordResetMode ? resetForm.password : mode === 'login' ? loginForm.password : registerForm.password}
                                            onChange={(e) => {
                                                if (isPasswordResetMode) {
                                                    setResetForm(f => ({ ...f, password: e.target.value }));
                                                    return;
                                                }
                                                if (mode === 'login') {
                                                    setLoginForm(f => ({ ...f, password: e.target.value }));
                                                    return;
                                                }
                                                setRegisterForm(f => ({ ...f, password: e.target.value }));
                                            }}
                                        />
                                        <button type="button" aria-label="Toggle password visibility" className="absolute right-0 top-0 flex h-full min-w-[44px] items-center justify-center text-slate-400 transition-colors hover:text-slate-600" onClick={() => setShowPass(v => !v)}>
                                            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    {mode === 'login' && !isPasswordResetMode && (
                                        <div className="mt-2 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={openForgotPassword}
                                                className="text-sm font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                                            >
                                                Forgot password?
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(mode === 'register' || isPasswordResetMode) && (
                                <div>
                                    <label className="form-label text-[11px] tracking-[0.12em]">Confirm Password</label>
                                    <div className="relative">
                                        <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type={showConfirm ? 'text' : 'password'}
                                            className="form-input pl-10 pr-12 h-10 text-sm"
                                            value={isPasswordResetMode ? resetForm.confirm_password : registerForm.confirm_password}
                                            onChange={(e) => {
                                                if (isPasswordResetMode) {
                                                    setResetForm(f => ({ ...f, confirm_password: e.target.value }));
                                                    return;
                                                }
                                                setRegisterForm(f => ({ ...f, confirm_password: e.target.value }));
                                            }}
                                        />
                                        <button type="button" aria-label="Toggle confirm password visibility" className="absolute right-0 top-0 flex h-full min-w-[44px] items-center justify-center text-slate-400 transition-colors hover:text-slate-600" onClick={() => setShowConfirm(v => !v)}>
                                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {error && (
                                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {pendingVerificationEmail && mode === 'login' && (
                                <button
                                    type="button"
                                    onClick={handleResendVerification}
                                    disabled={resending || verifying}
                                    className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {resending ? 'Sending confirmation email...' : `Resend confirmation email to ${pendingVerificationEmail}`}
                                </button>
                            )}

                            <button type="submit" disabled={submitting} className={`btn-primary w-full ${compactCard ? 'py-2.5 text-sm' : 'py-3'}`}>
                                {submitting
                                    ? isPasswordResetMode
                                        ? 'Updating password...'
                                        : isForgotPassword
                                            ? 'Sending reset link...'
                                            : 'Please wait...'
                                    : submitLabel}
                            </button>

                            {(isForgotPassword || isPasswordResetMode) && (
                                <button
                                    type="button"
                                    onClick={resetToLogin}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                                >
                                    Back to sign in
                                </button>
                            )}

                            {mode === 'register' && (
                                <p className="text-center text-[11px] leading-4 text-slate-400">
                                    A confirmation email will be sent to activate your account.
                                </p>
                            )}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
