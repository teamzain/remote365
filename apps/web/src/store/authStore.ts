import { create } from 'zustand';
import api from '../lib/api';
import { TOKEN_KEY, REFRESH_KEY } from '../lib/authKeys';

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
  // The pending second step: verify an existing authenticator, or set one up
  // because the organization requires 2FA and this account has none yet.
  temp2faSetup: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUser: (user: User) => void;
  setTemp2faToken: (token: string | null, setup?: boolean) => void;
  login: (email: string, password: string) => Promise<{ twoFactorRequired?: boolean }>;
  /** Starts the required 2FA setup for the pending sign-in; resolves to the QR code data URL. */
  start2faSetup: () => Promise<string>;
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
  // Guarded so the store can be imported where there is no localStorage
  // (server rendering); the client reads the real tokens.
  accessToken: typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY),
  refreshToken: typeof window === 'undefined' ? null : localStorage.getItem(REFRESH_KEY),
  temp2faToken: null,
  temp2faSetup: false,
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
    set({ user, accessToken, refreshToken, temp2faToken: null, temp2faSetup: false });
  },

  updateUser: (user) => set((state) => ({ user: { ...(state.user || {}), ...user } as User })),

  setTemp2faToken: (token, setup = false) => set({ temp2faToken: token, temp2faSetup: Boolean(token) && setup }),

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/api/auth/login', { email, password });

      if (data.twoFactorRequired) {
        set({ temp2faToken: data.tempToken, temp2faSetup: false });
        return { twoFactorRequired: true };
      }

      get().setAuth(data.user, data.accessToken, data.refreshToken);
      return { twoFactorRequired: false };
    } catch (err: any) {
      // The org requires 2FA and this account has none: a 403 that carries
      // the setup token. Same panel as the code prompt, in setup mode.
      const refused = err?.response?.data;
      if (err?.response?.status === 403 && refused?.twoFactorSetupRequired && refused?.tempToken) {
        set({ temp2faToken: refused.tempToken, temp2faSetup: true });
        return { twoFactorRequired: true };
      }
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  start2faSetup: async () => {
    const { data } = await api.post('/api/auth/setup-2fa', { tempToken: get().temp2faToken });
    return String(data?.qr_code || '');
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
      const { data } = await api.post(get().temp2faSetup ? '/api/auth/verify-2fa-setup' : '/api/auth/verify-2fa', { code, tempToken });
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
