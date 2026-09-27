import { create } from 'zustand';

// The sliding top-right toast the desktop shows for a new chat message or
// session invite (App.tsx pushSlidingToast). One at a time — a newer toast
// replaces the current one — and the shell renders it (WebAppToast).

export type ToastIconType = 'message' | 'session' | 'accepted' | 'system';

export interface AppToast {
  title: string;
  body: string;
  target?: Record<string, any> | null;
  iconType: ToastIconType;
  createdAt: number;
}

interface ToastState {
  toast: AppToast | null;
  pushToast: (title: string, body: string, target?: Record<string, any> | null, iconType?: ToastIconType) => void;
  clearToast: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  pushToast: (title, body, target = null, iconType = 'system') =>
    set({ toast: { title, body, target, iconType, createdAt: Date.now() } }),
  clearToast: () => set({ toast: null }),
}));

export const pushToast = (...args: Parameters<ToastState['pushToast']>) => useToastStore.getState().pushToast(...args);
