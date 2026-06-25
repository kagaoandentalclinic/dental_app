import axios from 'axios';
import { clearStoredToken, getStoredToken } from '../utils/authStorage';

const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
client.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Handle 401 globally (skip login endpoint — its errors are handled by the form)
client.interceptors.response.use(
    (res) => res,
    (err) => {
        const isLoginEndpoint = err.config?.url?.includes('/auth/login');
        if (err.response?.status === 401 && !isLoginEndpoint) {
            clearStoredToken();
            window.location.href = '/admin/login';
        }
        return Promise.reject(err);
    }
);

export default client;
