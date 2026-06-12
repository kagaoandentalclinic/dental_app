import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import portalClient from '../api/portalClient';
import { clearStoredPortalToken, getStoredPortalToken, storePortalToken } from '../utils/portalAuthStorage';

const PortalAuthContext = createContext(null);

export function PortalAuthProvider({ children }) {
    const [patient, setPatient] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMe = useCallback(async () => {
        const token = getStoredPortalToken();
        if (!token) {
            setLoading(false);
            return;
        }
        try {
            const res = await portalClient.get('/portal/me');
            setPatient(res.data);
        } catch (err) {
            if (err.response?.status === 401) {
                clearStoredPortalToken();
                setPatient(null);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchMe(); }, [fetchMe]);

    const login = useCallback(async (email, password) => {
        const res = await portalClient.post('/portal/login', { email, password });
        storePortalToken(res.data.token);
        setPatient(res.data.patient);
        return res.data.patient;
    }, []);

    const register = useCallback(async (payload) => {
        const res = await portalClient.post('/portal/register', payload);
        if (res.data.token && res.data.patient) {
            storePortalToken(res.data.token);
            setPatient(res.data.patient);
        }
        return res.data;
    }, []);

    const verifyEmail = useCallback(async (token) => {
        const res = await portalClient.post('/portal/verify-email', { token });
        storePortalToken(res.data.token);
        setPatient(res.data.patient);
        return res.data.patient;
    }, []);

    const resendVerification = useCallback(async (email) => {
        const res = await portalClient.post('/portal/resend-verification', { email });
        return res.data;
    }, []);

    const loginWithGoogle = useCallback(async (credential) => {
        const res = await portalClient.post('/portal/google', { credential });
        storePortalToken(res.data.token);
        setPatient(res.data.patient);
        return res.data.patient;
    }, []);

    const refreshPatient = useCallback(async () => {
        const res = await portalClient.get('/portal/me');
        setPatient(res.data);
        return res.data;
    }, []);

    const logout = useCallback(() => {
        clearStoredPortalToken();
        setPatient(null);
    }, []);

    return (
        <PortalAuthContext.Provider value={{ patient, loading, login, register, verifyEmail, resendVerification, loginWithGoogle, logout, fetchMe: refreshPatient }}>
            {children}
        </PortalAuthContext.Provider>
    );
}

export function usePortalAuth() {
    const ctx = useContext(PortalAuthContext);
    if (!ctx) throw new Error('usePortalAuth must be used within PortalAuthProvider');
    return ctx;
}
