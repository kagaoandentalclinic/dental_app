import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PortalAuthProvider } from './context/PortalAuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';
import PortalProtectedRoute from './portal/PortalProtectedRoute';
import PortalLayout from './portal/PortalLayout';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PatientList = lazy(() => import('./pages/PatientList'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const PatientNew = lazy(() => import('./pages/PatientNew'));
const PatientIntake = lazy(() => import('./pages/PatientIntake'));
const AppointmentForm = lazy(() => import('./pages/AppointmentForm'));
const Kiosk = lazy(() => import('./pages/Kiosk'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PortalLogin = lazy(() => import('./portal/PortalLogin'));
const PortalDashboard = lazy(() => import('./portal/PortalDashboard'));
const PortalBook = lazy(() => import('./portal/PortalBook'));
const PortalHistory = lazy(() => import('./portal/PortalHistory'));
const PortalProfile = lazy(() => import('./portal/PortalProfile'));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <LoadingSpinner size="xl" className="text-primary" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <AuthProvider>
      <PortalAuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin/dashboard" element={<ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>} />
            <Route path="/intake/:slug" element={<PatientIntake />} />
            <Route path="/appointment/:slug" element={<AppointmentForm />} />
            <Route path="/kiosk" element={<Kiosk />} />
            <Route path="/portal" element={<PortalLogin />} />
            <Route path="/portal" element={<PortalProtectedRoute><PortalLayout /></PortalProtectedRoute>}>
              <Route path="dashboard" element={<PortalDashboard />} />
              <Route path="book" element={<PortalBook />} />
              <Route path="history" element={<PortalHistory />} />
              <Route path="profile" element={<PortalProfile />} />
            </Route>
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="patients" element={<PatientList />} />
              <Route path="patients/new" element={<PatientNew />} />
              <Route path="patients/:id" element={<PatientDetail />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PortalAuthProvider>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
