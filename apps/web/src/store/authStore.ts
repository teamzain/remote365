import { create } from 'zustand';
import api from '../lib/api';

const TOKEN_KEY = 'remotelink_access_token';
const REFRESH_KEY = 'remotelink_refresh_token';

interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
  role?: 'SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'TECHNICIAN' | 'VIEWER' | string;
  permissions?: string[];
  features?: Record<string, boolean>;
  organizationId?: string | null;
  avatar: string | null;
  provider?: string;
  hasPassword?: boolean;
  is_2fa_enabled?: boolean;
  language?: string;
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
  isInitialized: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUser: (user: User) => void;
  setTemp2faToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<{ twoFactorRequired?: boolean }>;
  requestVerification: (email: string, extras?: Record<string, any>) => Promise<void>;
  register: (name: string, email: string, password: string, verificationCode: string, extras?: Record<string, any>) => Promise<void>;
  verify2fa: (code: string, tempToken: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  updateProfile: (data: Partial<User> & { current_password?: string; password?: string }) => Promise<void>;
  setLanguage: (language: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem(TOKEN_KEY),
  refreshToken: localStorage.getItem(REFRESH_KEY),
  temp2faToken: null,
  isLoading: false,
  isInitialized: false,

  // Mirrors the desktop store: optimistic merge, PATCH /auth/me, roll back on
  // failure. Partial responses must never drop fields like role/organizationId.
  updateProfile: async (data) => {
    set({ isLoading: true });
    const previousUser = get().user;
    if (previousUser) {
      set({ user: { ...previousUser, ...data } as any });
    }
    try {
      const { data: responseData } = await api.patch('/api/auth/me', data);
      if (responseData.user || responseData.id) {
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

  // Applies the chosen UI language immediately and persists it; the backend
  // write is best-effort so it sticks even offline.
  setLanguage: (language) => {
    localStorage.setItem('pref_language', language);
    try {
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'ar-SA' ? 'rtl' : 'ltr';
    } catch { /* no DOM */ }
    const current = get().user;
    if (current) set({ user: { ...current, language } as any });
    api.patch('/api/auth/me', { language }).catch(() => {});
  },

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
    set({ user, accessToken, refreshToken, temp2faToken: null });
  },

  updateUser: (user) => set((state) => ({ user: { ...(state.user || {}), ...user } as User })),

  setTemp2faToken: (token) => set({ temp2faToken: token }),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      
      if (data.twoFactorRequired) {
        set({ temp2faToken: data.tempToken });
        return { twoFactorRequired: true };
      }

      get().setAuth(data.user, data.accessToken, data.refreshToken);
      return { twoFactorRequired: false };
    } finally {
      set({ isLoading: false });
    }
  },

  requestVerification: async (email, extras) => {
    set({ isLoading: true });
    try {
      await api.post('/api/auth/request-verification', { email, ...(extras || {}) });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password, verificationCode, extras) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/register', { name, email, password, verificationCode, ...(extras || {}) });
      get().setAuth(data.user, data.accessToken, data.refreshToken);
    } finally {
      set({ isLoading: false });
    }
  },

  verify2fa: async (code, tempToken) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/verify-2fa', { code, tempToken });
      get().setAuth(data.user, data.accessToken, data.refreshToken);
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    const refreshToken = get().refreshToken;
    if (refreshToken) {
      try {
        await api.post('/api/auth/logout', { refreshToken });
      } catch (e) {
        console.error('Logout API failed:', e);
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    set({ user: null, accessToken: null, refreshToken: null });
  },

  initialize: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ isInitialized: true });
      return;
    }

    set({ isLoading: true });
    try {
      const { data } = await api.get('/api/auth/me');
      const loadedUser = data.user || data;
      const previous = get().user as any;
      set({ user: { ...(previous || {}), ...loadedUser, role: loadedUser.role || previous?.role } as User, accessToken: token, refreshToken: localStorage.getItem(REFRESH_KEY) });
    } catch (e) {
      // Interceptor handles refresh, if /me still fails after refresh, it will redirect to login
      console.error('Initialization /me failed:', e);
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  }
}));
