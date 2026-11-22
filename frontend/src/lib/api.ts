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
// Refresh tokens are single-use (rotated on every refresh), and every open tab
// shares the same localStorage. Refreshes are therefore serialised across tabs
// with the Web Locks API, and a tab that finds the token already rotated by
// another tab simply adopts the new pair instead of spending a dead token.
let inFlight: Promise<string> | null = null;
let proactiveTimer: ReturnType<typeof setTimeout> | null = null;

const REFRESH_LOCK = 'roomies-token-refresh';

async function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK, fn) as Promise<T>;
  }
  return fn(); // Very old browsers: per-tab de-duplication still applies.
}

async function refreshUnderLock(staleRefreshToken: string | null): Promise<string> {
  return withCrossTabLock(async () => {
    const current = localStorage.getItem('refreshToken');
    if (!current) throw new Error('no refresh token');

    // Another tab rotated the pair while we were waiting for the lock.
    if (staleRefreshToken && current !== staleRefreshToken) {
      const access = localStorage.getItem('accessToken');
      if (access) return access;
    }

    const { data } = await axios.post(`${API_BASE}/api/auth/refresh`, { refreshToken: current });
    const newAccess: string = data.data.accessToken;
    const newRefresh: string = data.data.refreshToken;
    localStorage.setItem('accessToken', newAccess);
    localStorage.setItem('refreshToken', newRefresh);
    return newAccess;
  });
}

/** Refresh once per tab at a time; concurrent callers share the same promise. */
function doRefresh(): Promise<string> {
  if (!inFlight) {
    const stale = localStorage.getItem('refreshToken');
    inFlight = refreshUnderLock(stale).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

function clearSessionAndRedirect() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

// When another tab rotates the tokens, re-arm this tab's proactive timer from
// the new access token so tabs don't all fire on the old schedule.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'accessToken' && e.newValue) scheduleProactiveRefresh(e.newValue);
  });
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
    try {
      const newAccess = await doRefresh();
      scheduleProactiveRefresh(newAccess);
    } catch {
      // Silent — the reactive 401 interceptor is the safety net
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

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;

      // Sent with an access token another tab has since replaced — just retry.
      const latest = localStorage.getItem('accessToken');
      const sentWith = String(original.headers?.Authorization ?? '');
      if (latest && sentWith !== `Bearer ${latest}`) {
        return api(original);
      }

      // Every concurrent 401 awaits the same refresh, so each one either
      // retries with the new token or rejects — none can hang.
      let newAccess: string;
      try {
        newAccess = await doRefresh();
      } catch {
        clearSessionAndRedirect();
        return Promise.reject(error);
      }
      scheduleProactiveRefresh(newAccess);
      return api(original);
    }
    return Promise.reject(error);
  },
);

export default api;
