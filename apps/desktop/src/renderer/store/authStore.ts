import { create } from 'zustand';
import api from '../lib/api';

const isElectron = !!(window as any).electronAPI;

interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
  role: 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'VIEWER';
  // Owner-configured feature visibility for this user's role (from /auth/me).
  features?: Record<string, boolean>;
  // Effective RBAC capabilities after per-user overrides (from /auth/me).
  permissions?: string[];
  organizationId: string | null;
  avatar: string | null;
  hasPassword?: boolean;
  provider?: string;
  language?: string;
  is_2fa_enabled?: boolean;
  notify_session_alert?: boolean;
  notify_disconnect_alert?: boolean;
  notify_sound_effects?: boolean;
  darkMode?: boolean;
  searchBehavior?: string;
  useNewInterface?: boolean;
  marketingMessages?: boolean;
  fontSize?: number;
  deviceName?: string;
  startWithWindows?: boolean;
  useDeviceDock?: boolean;
  windowsNotification?: boolean;
  incomingSessionNotification?: boolean;
  keepAgentRunning?: boolean;
  updatesAutomatically?: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  temp2faToken: string | null;
  isLoading: boolean;
  setTemp2faToken: (token: string | null) => void;
  setAuth: (user: User, accessToken: string, refreshToken: string, persist?: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<{ twoFactorRequired?: boolean }>;
  verify2fa: (code: string) => Promise<void>;
  requestVerification: (email: string, extras?: Record<string, any>) => Promise<{ emailSent?: boolean } | undefined>;
  register: (name: string, email: string, password: string, verificationCode: string, extras?: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: Partial<User> & { current_password?: string; password?: string }) => Promise<void>;
  setLanguage: (language: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  temp2faToken: null,
  isLoading: false,

  setTemp2faToken: (token) => set({ temp2faToken: token }),

  setAuth: async (user, accessToken, refreshToken, persist = true) => {
    if (persist) {
      if (isElectron) {
        await (window as any).electronAPI.setToken(accessToken, refreshToken);
      } else {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
      }
    }
    set({ user, accessToken, refreshToken, temp2faToken: null });
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      if (data.twoFactorRequired) {
        set({ temp2faToken: data.tempToken });
        return { twoFactorRequired: true };
      }
      await get().setAuth(data.user, data.accessToken, data.refreshToken);
      return { twoFactorRequired: false };
    } finally {
      set({ isLoading: false });
    }
  },

  verify2fa: async (code) => {
    set({ isLoading: true });
    try {
      const { temp2faToken } = get();
      const { data } = await api.post('/api/auth/verify-2fa', { 
        code, 
        tempToken: temp2faToken 
      });
      await get().setAuth(data.user, data.accessToken, data.refreshToken);
      set({ temp2faToken: null });
    } finally {
      set({ isLoading: false });
    }
  },

  requestVerification: async (email, extras) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/request-verification', { email, ...(extras || {}) });
      return data;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password, verificationCode, extras) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/register', { name, email, password, verificationCode, ...(extras || {}) });
      await get().setAuth(data.user, data.accessToken, data.refreshToken);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const { refreshToken } = get();
    // 1. Clear memory state IMMEDIATELY to stop polling loops
    set({ user: null, accessToken: null, refreshToken: null });

    // 2. Clear persistent storage
    if (isElectron) {
      try { await (window as any).electronAPI.deleteToken(); } catch {}
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }

    // 3. Inform server (optional, don't wait for it)
    if (refreshToken) {
      api.post('/api/auth/logout', { refreshToken }).catch(() => {});
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      let token, refresh;
      if (isElectron) {
        const result = await (window as any).electronAPI.getToken();
        token = result?.token;
        refresh = result?.refresh;
      } else {
        token = localStorage.getItem('access_token');
        refresh = localStorage.getItem('refresh_token');
      }

      if (token && refresh) {
        try {
           // Set tokens first so the request interceptor can attach them
           set({ accessToken: token, refreshToken: refresh });
           const { data } = await api.get('/api/auth/me');
           const loadedUser = data.user || data; // Support both formats
           // Prefer a locally-saved language choice so the UI language persists
           // across restarts even if the backend didn't store it.
           const savedLanguage = localStorage.getItem('pref_language');
           if (savedLanguage) loadedUser.language = savedLanguage;
           // Merge over the existing user so fields /me may omit (notably `role`) are
           // not lost on a periodic re-check — that was making role-gated nav like
           // Admin settings and Remote support disappear after a while.
           const prevUser = get().user as any;
           set({ user: { ...(prevUser || {}), ...loadedUser, role: loadedUser.role || prevUser?.role } });
        } catch (e: any) {
           if (e.response?.status === 401 || e.response?.status === 403) {
             if (isElectron) {
               try { await (window as any).electronAPI.deleteToken(); } catch {}
             } else {
               localStorage.removeItem('access_token');
               localStorage.removeItem('refresh_token');
             }
             set({ user: null, accessToken: null, refreshToken: null });
           }
        }
      }
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    set({ isLoading: true });
    const previousUser = get().user;
    if (previousUser) {
      set({ user: { ...previousUser, ...data } });
    }
    try {
      const { data: responseData } = await api.patch('/api/auth/me', data);
      if (responseData.user || responseData.id) {
        // Merge over the existing user instead of replacing it: a partial
        // response must never drop fields like role/organizationId, which
        // gate whole sections of the UI (sidebar, admin settings, etc.).
        const incoming = responseData.user || responseData;
        set({ user: { ...(get().user || {}), ...incoming } as any });
      }
    } catch (e) {
      if (previousUser) set({ user: previousUser });
      console.error('[AuthStore] Profile update failed:', e);
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  // Applies the chosen UI language across the whole app immediately and persists
  // it. The language is applied locally first (and saved to localStorage) so it
  // sticks even if the backend write fails or there is no network.
  setLanguage: (language) => {
    localStorage.setItem('pref_language', language);
    try {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar-SA' ? 'rtl' : 'ltr';
    } catch {}
    const current = get().user;
    if (current) set({ user: { ...current, language } });
    // Persist to the backend without blocking the UI; ignore failures.
    api.patch('/api/auth/me', { language }).catch(() => {});
  }
}));
