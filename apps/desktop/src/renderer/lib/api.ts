import axios, { AxiosError, AxiosHeaders, InternalAxiosRequestConfig } from 'axios';
import { buildHttpOrigin, DEFAULT_SERVER_HOST } from '../utils/server';

const isElectron = !!(window as any).electronAPI;

const normalizeApiBaseURL = (value?: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return buildHttpOrigin(DEFAULT_SERVER_HOST);

  try {
    return buildHttpOrigin(raw);
  } catch {
    const clean = raw.replace(/^https?:\/\//i, '').replace(/^wss?:\/\//i, '').replace(/\/.*$/, '');
    return buildHttpOrigin(clean || DEFAULT_SERVER_HOST);
  }
};

export const getBaseURL = async (): Promise<string> => {
  // Use environment variable if available (e.g. from .env for local dev)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return normalizeApiBaseURL(envUrl);

  return normalizeApiBaseURL(DEFAULT_SERVER_HOST);
};

type RetryRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const api = axios.create();

// Update baseURL on each request in case it changed in localStorage
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.baseURL = await getBaseURL();

  let token;
  if (isElectron) {
    const result = await (window as any).electronAPI.getToken();
    token = result?.token || localStorage.getItem('viewer_token');
  } else {
    token = localStorage.getItem('access_token');
  }

  if (token) {
    if (!config.headers) config.headers = new AxiosHeaders();
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: (value: string | null) => void; reject: (reason: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryRequestConfig | undefined;
    if (!originalRequest) return Promise.reject(error);

    const isViewer = window.location.search.includes('viewer=true');

    // Organization suspended → lock the user out everywhere. Explicit login
    // attempts are excluded so the auth screen can surface the message inline;
    // every other request (e.g. /me, /refresh, background polls) forces a logout.
    const reqUrl = originalRequest.url || '';
    const isAuthEntry = /\/api\/auth\/(login|verify-2fa|google)/.test(reqUrl);
    if (error.response?.status === 403 && (error.response.data as any)?.suspended && !isAuthEntry) {
      const message = (error.response.data as any)?.error || 'Your account has been suspended. Please contact support.';
      if (isElectron) {
        try { await (window as any).electronAPI.deleteToken(); } catch {}
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
      if (!isViewer) {
        try { window.dispatchEvent(new CustomEvent('auth:suspended', { detail: message })); } catch {}
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/api/devices/verify-access')) {
      if (isViewer) {
        // Viewer windows use temporary tokens. Do NOT refresh or delete the main token.
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (!originalRequest.headers) originalRequest.headers = new AxiosHeaders();
            originalRequest.headers.set('Authorization', `Bearer ${token}`);
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      let refreshToken;
      if (isElectron) {
        const result = await (window as any).electronAPI.getToken();
        refreshToken = result?.refresh;
      } else {
        refreshToken = localStorage.getItem('refresh_token');
      }

      if (!refreshToken) {
        isRefreshing = false;
        if (isElectron) {
          await (window as any).electronAPI.deleteToken();
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
        return Promise.reject(error);
      }

      try {
        const baseURL = await getBaseURL();
        const { data } = await axios.post(`${baseURL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = data;

        if (isElectron) {
          await (window as any).electronAPI.setToken(accessToken, newRefreshToken);
        } else {
          localStorage.setItem('access_token', accessToken);
          localStorage.setItem('refresh_token', newRefreshToken);
        }

        processQueue(null, accessToken);
        isRefreshing = false;

        if (!originalRequest.headers) originalRequest.headers = new AxiosHeaders();
        originalRequest.headers.set('Authorization', `Bearer ${accessToken}`);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        if (isElectron) {
          await (window as any).electronAPI.deleteToken();
        } else {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
