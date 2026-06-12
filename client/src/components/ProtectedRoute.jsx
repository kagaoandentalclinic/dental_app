import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children }) {
    const { admin, loading } = useAuth();

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-bg"><LoadingSpinner size="lg" /></div>;
    }

    if (!admin) return <Navigate to="/admin/login" replace />;
    return children;
}
