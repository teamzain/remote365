import { create } from 'zustand';

export type ToastVariant = 'error' | 'success' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  show: (message: string, variant?: ToastVariant, duration?: number) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (message, variant = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, variant, duration }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/**
 * Imperative helper so non-component code (handlers) can fire toasts without hooks.
 * e.g. toast.success('Device added successfully')
 */
export const toast = {
  success: (message: string, duration?: number) => useToastStore.getState().show(message, 'success', duration),
  error: (message: string, duration?: number) => useToastStore.getState().show(message, 'error', duration),
  info: (message: string, duration?: number) => useToastStore.getState().show(message, 'info', duration),
};
