import { Link } from 'react-router-dom';
import { ChevronRight, Shield, Stethoscope } from 'lucide-react';

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[linear-gradient(160deg,#0b2b21_0%,#1B4332_38%,#eef6f3_38%,#f8fafb_100%)]">
            <div className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-12">
                <div className="w-full max-w-4xl rounded-[2rem] border border-white/60 bg-white/95 p-5 shadow-2xl shadow-emerald-950/10 backdrop-blur sm:p-10">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-4 rounded-[1.25rem] bg-[linear-gradient(135deg,#12382c_0%,#1B4332_55%,#275c48_100%)] px-6 py-4 shadow-lg shadow-emerald-950/20 sm:mb-6 sm:rounded-[1.75rem] sm:px-8 sm:py-5">
                            <img src="/logo.png" alt="Kagaoan Dental Clinic" className="w-40 max-w-full object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.22)] sm:w-56" />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary sm:text-sm">Kagaoan Dental Clinic</p>
                        <h1 className="mt-2 text-3xl font-bold text-text-primary sm:mt-3 sm:text-5xl">Choose Your Access</h1>
                        <p className="mt-2 text-sm text-text-secondary sm:mt-3 sm:text-lg">Your smile, our priority</p>
                    </div>

                    <div className="mt-6 grid gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-5">
                        <Link
                            to="/portal"
                            className="group rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl sm:rounded-[1.75rem] sm:p-6"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-emerald-900/20 sm:h-14 sm:w-14">
                                <Stethoscope className="w-6 h-6 sm:w-7 sm:h-7" />
                            </div>
                            <h2 className="mt-4 text-xl font-bold text-text-primary sm:mt-6 sm:text-2xl">I'm a Patient</h2>
                            <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                                Log in, register, request an appointment, and view your visit history from your device.
                            </p>
                            <div className="mt-4 inline-flex items-center gap-2 font-semibold text-primary sm:mt-6">
                                Go to Patient Portal
                                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </div>
                        </Link>

                        <Link
                            to="/admin/login"
                            className="group rounded-[1.5rem] border border-emerald-950/10 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl sm:rounded-[1.75rem] sm:p-6"
                        >
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-950 text-white shadow-lg shadow-emerald-950/20 sm:h-14 sm:w-14">
                                <Shield className="w-6 h-6 sm:w-7 sm:h-7" />
                            </div>
                            <h2 className="mt-4 text-xl font-bold text-text-primary sm:mt-6 sm:text-2xl">Staff / Admin</h2>
                            <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                                Access the clinic dashboard, patient records, appointments, forms, and settings.
                            </p>
                            <div className="mt-4 inline-flex items-center gap-2 font-semibold text-primary sm:mt-6">
                                Go to Admin Login
                                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
