import axios from 'axios';
import { clearStoredPortalToken, getStoredPortalToken } from '../utils/portalAuthStorage';

const portalClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
    headers: { 'Content-Type': 'application/json' },
});

portalClient.interceptors.request.use((config) => {
    const token = getStoredPortalToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

portalClient.interceptors.response.use(
    res => res,
    (err) => {
        const isPortalAuthEndpoint = err.config?.url?.includes('/portal/login') || err.config?.url?.includes('/portal/register');
        if (err.response?.status === 401 && !isPortalAuthEndpoint) {
            clearStoredPortalToken();
            if (window.location.pathname !== '/portal') window.location.href = '/portal';
        }
        return Promise.reject(err);
    }
);

export default portalClient;
