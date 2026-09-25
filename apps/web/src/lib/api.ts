import axios from 'axios';
import { API_URL, IS_DEV } from './env';
import { TOKEN_KEY, REFRESH_KEY } from './authKeys';

// Deployed builds call the same origin that served the page (empty baseURL);
// `next dev` falls back to prod unless NEXT_PUBLIC_API_URL points elsewhere.
const API_BASE_URL = API_URL || (IS_DEV ? 'https://remote365.ai' : '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

import { notify } from './notify';

api.interceptors.response.use(
  (response: any) => {
    // Show success snackbars for non-GET methods if needed, 
    // but usually handled per-component for more specific messaging.
    return response;
  },
  async (error: any) => {
    const originalRequest = error.config;

    // Handle Network Errors
    if (!error.response) {
      notify('Cannot connect to server. Please check your internet connection.', 'error');
      return Promise.reject(error);
    }

    const { status, data } = error.response;

    // 401: Token Refresh Flow (Exclude verify-access password challenge)
    // Note: axios may use baseURL + '/devices/verify-access' so the path might not contain '/api/devices/...'.
    const reqPath = `${originalRequest.baseURL || ''}${originalRequest.url || ''}`;
    const isVerifyAccessChallenge =
      reqPath.includes('verify-access') || originalRequest.url?.includes('verify-access');
    // A failed sign-in / sign-up / reset is a normal answer, not an expired
    // session: it must reach the form (the redirect below reloaded /login and
    // swallowed 'Incorrect password' before anyone could read it).
    const isAuthAttempt = /\/auth\/(login|register|request-verification|verify-2fa|password\/)/.test(reqPath);
    if (status === 401 && !originalRequest._retry && !isVerifyAccessChallenge && !isAuthAttempt) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem(REFRESH_KEY);
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data: refreshData } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = refreshData;
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_KEY, newRefreshToken);

        processQueue(null, accessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // 400: Validation Errors
    if (status === 400) {
      notify(data.error || data.message || 'Invalid request', 'error');
    }

    // 403: Forbidden / Permissions
    if (status === 403) {
      notify(data.error || 'You do not have permission to do this', 'error');
    }

    // 404: Not Found
    if (status === 404) {
      notify(data.error || 'The requested resource was not found', 'error');
    }

    // 429: Rate Limiting
    if (status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      notify(`Too many requests. Please wait ${retryAfter || 'a few'} seconds.`, 'error');
    }

    // 500: Server Error
    if (status >= 500) {
      notify('Something went wrong on our end. Please try again later.', 'error');
    }

    return Promise.reject(error);
  }
);

// Base URL of the API/file host. Kept async to match the desktop signature used
// by ported components (e.g. SnowChat resolves file/download URLs from it).
export const getBaseURL = async (): Promise<string> => API_BASE_URL;

export default api;
