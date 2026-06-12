import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'success', duration = 3500) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = {
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error', 5000),
        info: (msg) => addToast(msg, 'info'),
        warning: (msg) => addToast(msg, 'warning'),
        showToast: (message, type = 'success', duration) => {
            if (typeof duration === 'number') {
                addToast(message, type, duration);
                return;
            }
            if (type === 'error') {
                addToast(message, 'error', 5000);
                return;
            }
            addToast(message, type);
        },
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="fixed top-3 left-3 right-3 sm:top-4 sm:left-auto sm:right-4 z-[9999] flex flex-col gap-2 sm:max-w-sm">
                <AnimatePresence>
                    {toasts.map(t => (
                        <Toast key={t.id} {...t} onClose={() => removeToast(t.id)} />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

function Toast({ message, type, onClose }) {
    const configs = {
        success: { icon: CheckCircle, bg: 'bg-green-50 border-green-200', icon_cls: 'text-green-600', title: 'Success' },
        error: { icon: XCircle, bg: 'bg-red-50 border-red-200', icon_cls: 'text-red-600', title: 'Error' },
        info: { icon: Info, bg: 'bg-blue-50 border-blue-200', icon_cls: 'text-blue-600', title: 'Info' },
        warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200', icon_cls: 'text-amber-600', title: 'Warning' },
    };
    const cfg = configs[type] || configs.info;
    const Icon = cfg.icon;

    return (
        <motion.div
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${cfg.bg}`}
        >
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.icon_cls}`} />
            <p className="text-sm text-text-primary font-medium flex-1">{message}</p>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary shrink-0">
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};
