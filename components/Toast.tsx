'use client';

import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (type: Toast['type'], message: string) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Safe hook that doesn't throw during SSR
export function useToast(): ToastContextType {
    const context = useContext(ToastContext);

    // Return no-op functions if context is not available (SSR or outside provider)
    if (!context) {
        return {
            toasts: [],
            addToast: () => { },
            removeToast: () => { }
        };
    }

    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((type: Toast['type'], message: string) => {
        const id = Math.random().toString(36).slice(2);
        setToasts(prev => [...prev, { id, type, message }]);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[], removeToast: (id: string) => void }) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 cursor-pointer backdrop-blur-sm border
            ${toast.type === 'success' ? 'bg-green-500/90 border-green-400 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : ''}
            ${toast.type === 'info' ? 'bg-blue-500/90 border-blue-400 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-yellow-500/90 border-yellow-400 text-black' : ''}
          `}
                    onClick={() => removeToast(toast.id)}
                >
                    <span className="text-lg">
                        {toast.type === 'success' && '✓'}
                        {toast.type === 'error' && '✕'}
                        {toast.type === 'info' && 'ℹ'}
                        {toast.type === 'warning' && '⚠'}
                    </span>
                    <span className="font-medium text-sm">{toast.message}</span>
                </div>
            ))}
        </div>
    );
}
