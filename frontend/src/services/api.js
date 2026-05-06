import axios from 'axios';
import toast from 'react-hot-toast';
import {
  getAccessToken, setAccessToken,
  getRefreshToken, setRefreshToken,
  clearAccessToken, clearRefreshToken, clearStoredUser,
} from '../lib/tokenStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Main API instance — all app requests go through this
const api = axios.create({ baseURL: BASE_URL });

// Bare instance used ONLY for the refresh call — bypasses our interceptors to avoid loops
const bare = axios.create({ baseURL: BASE_URL });

// ── Request: attach in-memory access token ────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: silent refresh on TOKEN_EXPIRED ─────────────────────
let refreshing = null; // single in-flight promise — prevents parallel refresh races

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original   = error.config;
    const status     = error?.response?.status;
    const errorCode  = error?.response?.data?.error;

    // Only intercept 401 TOKEN_EXPIRED and only once per request
    if (status === 401 && errorCode === 'TOKEN_EXPIRED' && !original._retried) {
      original._retried = true;

      const storedRefresh = getRefreshToken();
      if (!storedRefresh) {
        forceLogout();
        return Promise.reject(error);
      }

      try {
        // Coalesce parallel requests — all wait on the same refresh promise
        if (!refreshing) {
          refreshing = bare.post('/auth/refresh', { refreshToken: storedRefresh })
            .finally(() => { refreshing = null; });
        }

        const { data } = await refreshing;
        const { token: newAccess, refreshToken: newRefresh } = data.data;

        setAccessToken(newAccess);
        setRefreshToken(newRefresh);

        // Retry original request with new access token
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      } catch {
        forceLogout();
        return Promise.reject(error);
      }
    }

    // Any other 401 (invalid token, revoked) → logout
    if (status === 401 && !original._retried) {
      forceLogout();
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

function forceLogout() {
  clearAccessToken();
  clearRefreshToken();
  clearStoredUser();
  if (window.location.pathname !== '/login') {
    toast.error('Your session has expired. Please sign in again.');
    setTimeout(() => window.location.assign('/login'), 1200);
  }
}

export default api;
