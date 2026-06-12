import { Navigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { usePortalAuth } from '../context/PortalAuthContext';

export default function PortalProtectedRoute({ children }) {
    const { patient, loading } = usePortalAuth();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-bg"><LoadingSpinner size="lg" /></div>;
    }

    if (!patient) return <Navigate to="/portal" replace />;
    return children;
}
