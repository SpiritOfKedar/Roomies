import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4001';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// ── JWT payload decoder (no signature verification needed — we just want `exp`) ─
function getTokenExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

// ── Shared refresh state ──────────────────────────────────────────────────────
let refreshing = false;
let queue: Array<() => void> = [];
let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('no refresh token');
  const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken });
  const newAccess: string = data.data.accessToken;
  const newRefresh: string = data.data.refreshToken;
  localStorage.setItem('accessToken', newAccess);
  localStorage.setItem('refreshToken', newRefresh);
  return newAccess;
}

/**
 * Schedule a background refresh 60 s before the current access token expires.
 * Call this after every successful login or refresh so the user is never
 * kicked out simply because the 15-minute window elapsed.
 */
export function scheduleProactiveRefresh(accessToken?: string) {
  if (typeof window === 'undefined') return;
  if (proactiveTimer) clearTimeout(proactiveTimer);

  const token = accessToken ?? localStorage.getItem('accessToken');
  if (!token) return;

  const exp = getTokenExp(token);
  if (!exp) return;

  const now = Math.floor(Date.now() / 1000);
  const refreshInMs = (exp - now - 60) * 1000; // 60 s before expiry
  if (refreshInMs <= 0) return;

  proactiveTimer = setTimeout(async () => {
    if (refreshing) return;
    refreshing = true;
    try {
      const newAccess = await doRefresh();
      queue.forEach((fn) => fn());
      queue = [];
      scheduleProactiveRefresh(newAccess);
    } catch {
      // Silent — the reactive 401 interceptor is the safety net
    } finally {
      refreshing = false;
    }
  }, refreshInMs);
}

// ── attach access token from localStorage ────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── silent refresh on 401 ────────────────────────────────────────────────────
function isPublicAuthRequest(url: string | undefined): boolean {
  return /\/api\/auth\/(login|register|google|recovery)(\/|$)/.test(url ?? '');
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    const url = original?.url as string | undefined;

    // Login/register failures return 401 — do not attempt token refresh or redirect.
    if (isPublicAuthRequest(url)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve) => {
          queue.push(() => resolve(api(original)));
        });
      }
      original._retry = true;
      refreshing = true;
      try {
        const newAccess = await doRefresh();
        queue.forEach((fn) => fn());
        queue = [];
        scheduleProactiveRefresh(newAccess);
        return api(original);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
