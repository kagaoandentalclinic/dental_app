import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, Phone, Mail, Heart, Stethoscope, Calendar, ClipboardList, Smile, Camera, ZoomIn, ZoomOut, X } from 'lucide-react';
import client from '../api/client';
import { formatName, calcAge, formatDate } from '../utils/helpers';
import BackButton from '../components/BackButton';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';
import PatientInfoTab from '../features/patient-info/PatientInfoTab';
import DentalChartTab from '../features/dental-chart/DentalChartTab';
import VisitsTab from '../features/visits/VisitsTab';
import MedicalHistoryTab from '../features/medical/MedicalHistoryTab';
import OrthodonticsTab from '../features/orthodontics/OrthodonticsTab';
import PhotosTab from '../features/photos/PhotosTab';
import { flattenPatientDetail } from '../features/patient-form/utils';

const TABS = [
    { id: 'info', label: 'Patient Info', icon: ClipboardList },
    { id: 'dental', label: 'Dental Chart', icon: Stethoscope },
    { id: 'visits', label: 'Visits', icon: Calendar },
    { id: 'medical', label: 'Medical History', icon: Heart },
    { id: 'orthodontics', label: 'Orthodontics', icon: Smile },
    { id: 'photos', label: 'Photos', icon: Camera },
];

export default function PatientDetail() {
    const { id } = useParams();
    const [sp, setSp] = useSearchParams();
    const activeTab = sp.get('tab') || 'info';
    const navigate = useNavigate();
    const toast = useToast();

    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [photoZoom, setPhotoZoom] = useState(false);
    const [zoomScale, setZoomScale] = useState(1);

    const setTab = (t) => setSp({ tab: t });

    const fetchPatient = useCallback(async () => {
        try {
            const res = await client.get(`/patients/${id}`);
            setDetail(res.data);
        } catch (err) {
            toast.error('Failed to load patient');
            navigate('/patients');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchPatient(); }, [fetchPatient]);

    const handleDelete = async () => {
        try {
            await client.delete(`/patients/${id}`);
            toast.success('Patient deleted successfully');
            navigate('/patients');
        } catch {
            toast.error('Failed to delete patient');
        }
        setDeleteOpen(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <LoadingSpinner size="xl" className="text-primary" />
            </div>
        );
    }

    if (!detail) return null;
    const patient = flattenPatientDetail(detail);

    return (
        <div className="space-y-5 animate-fade-up">
            {/* Back */}
            <BackButton to="/patients" label="BACK TO PATIENTS" className="w-fit" />

            {/* Patient header card */}
            <div className="card">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                    {/* Avatar */}
                    {patient.profile_photo ? (
                        <button
                            className="relative group shrink-0 focus:outline-none"
                            onClick={() => { setZoomScale(1); setPhotoZoom(true); }}
                            title="Click to view photo"
                        >
                            <img
                                src={patient.profile_photo}
                                alt={formatName(patient)}
                                className="w-16 h-16 rounded-2xl object-cover shadow-md border-2 border-border group-hover:border-primary transition-colors"
                            />
                            <span className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                                <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                        </button>
                    ) : null}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <h1 className="font-display text-2xl font-bold text-text-primary break-words">{formatName(patient)}</h1>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-text-secondary">
                            <span>{calcAge(patient.date_of_birth)} years old</span>
                            {patient.sex && <span className="capitalize">• {patient.sex}</span>}
                            {patient.phone && (
                                <span className="flex items-center gap-1">
                                    <Phone className="w-3.5 h-3.5" /> {patient.phone}
                                </span>
                            )}
                            {patient.email && (
                                <span className="flex items-center gap-1">
                                    <Mail className="w-3.5 h-3.5" /> {patient.email}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {parseInt(patient.dental_issues) > 0
                                ? <span className="badge-red">{patient.dental_issues} dental issue{patient.dental_issues !== '1' ? 's' : ''}</span>
                                : <span className="badge-green">Healthy teeth</span>
                            }
                            <span className="badge-gray">{patient.total_visits} visit{patient.total_visits !== '1' ? 's' : ''}</span>
                            {patient.last_visit && <span className="badge-blue">Last visit: {formatDate(patient.last_visit)}</span>}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
                        <Link
                            to={`/appointments?patientId=${patient.id}`}
                            className="btn-primary w-full sm:w-auto"
                        >
                            <Calendar className="w-4 h-4" /> Book Appointment
                        </Link>
                        <button
                            className="btn-secondary w-full sm:w-auto"
                            onClick={() => setTab('info')}
                        >
                            <Pencil className="w-4 h-4" /> Edit
                        </button>
                        <button
                            className="btn-danger w-full sm:w-auto"
                            onClick={() => setDeleteOpen(true)}
                        >
                            <Trash2 className="w-4 h-4" /> Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-border -mx-0">
                <div className="flex overflow-x-auto pb-1">
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            className={`tab flex items-center gap-2 whitespace-nowrap ${activeTab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            <t.icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'info' && <PatientInfoTab detail={detail} patient={patient} onSave={fetchPatient} />}
                    {activeTab === 'dental' && <DentalChartTab patient={patient} />}
                    {activeTab === 'visits' && <VisitsTab patient={patient} />}
                    {activeTab === 'medical' && <MedicalHistoryTab patient={patient} />}
                    {activeTab === 'orthodontics' && <OrthodonticsTab patient={patient} />}
                    {activeTab === 'photos' && <PhotosTab patient={patient} />}
                </motion.div>
            </AnimatePresence>

            <ConfirmDialog
                isOpen={deleteOpen}
                title="Delete Patient"
                message={`Are you sure you want to delete ${formatName(patient)}? This will archive the patient record.`}
                confirmLabel="Delete Patient"
                onConfirm={handleDelete}
                onCancel={() => setDeleteOpen(false)}
            />

            {/* Profile photo lightbox */}
            {photoZoom && patient.profile_photo && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
                    onClick={() => setPhotoZoom(false)}
                >
                    {/* Close */}
                    <button
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors z-10"
                        onClick={() => setPhotoZoom(false)}
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Zoom controls */}
                    <div
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-4 py-2 z-10"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-30"
                            onClick={() => setZoomScale(s => Math.max(0.5, parseFloat((s - 0.25).toFixed(2))))}
                            disabled={zoomScale <= 0.5}
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-white text-sm font-medium w-12 text-center select-none">
                            {Math.round(zoomScale * 100)}%
                        </span>
                        <button
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors disabled:opacity-30"
                            onClick={() => setZoomScale(s => Math.min(3, parseFloat((s + 0.25).toFixed(2))))}
                            disabled={zoomScale >= 3}
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <div className="w-px h-5 bg-white/30 mx-1" />
                        <button
                            className="text-white/70 hover:text-white text-xs transition-colors"
                            onClick={() => setZoomScale(1)}
                        >
                            Reset
                        </button>
                    </div>

                    {/* Image */}
                    <div className="overflow-hidden flex items-center justify-center w-full h-full p-4 sm:p-16" onClick={e => e.stopPropagation()}>
                        <motion.img
                            src={patient.profile_photo}
                            alt={formatName(patient)}
                            animate={{ scale: zoomScale }}
                            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                            className="max-w-sm w-full rounded-2xl shadow-2xl object-contain select-none"
                            draggable={false}
                        />
                    </div>

                    {/* Patient name */}
                    <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/80 text-sm font-medium">
                        {formatName(patient)}
                    </div>
                </div>
            )}
        </div>
    );
}
