import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { clearStoredToken, getStoredToken, storeToken } from '../utils/authStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMe = useCallback(async () => {
        const token = getStoredToken();
        if (!token) { setLoading(false); return; }
        try {
            const res = await client.get('/auth/me');
            setAdmin(res.data);
        } catch (err) {
            if (err.response?.status === 401) {
                clearStoredToken();
                setAdmin(null);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchMe(); }, [fetchMe]);

    const login = async (username, password) => {
        const res = await client.post('/auth/login', { username, password });
        storeToken(res.data.token);
        setAdmin(res.data.admin);
        return res.data.admin;
    };

    const logout = () => {
        clearStoredToken();
        setAdmin(null);
    };

    return (
        <AuthContext.Provider value={{ admin, loading, login, logout, fetchMe }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
