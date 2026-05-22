import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005',
  withCredentials: true,
});

// ── attach access token from localStorage ────────────────────────────────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── silent refresh on 401 ────────────────────────────────────────────────────
let refreshing = false;
let queue: Array<() => void> = [];

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (refreshing) {
        return new Promise((resolve) => {
          queue.push(() => resolve(api(original)));
        });
      }
      original._retry = true;
      refreshing = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('no refresh token');
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3005'}/api/auth/refresh`,
          { refreshToken },
        );
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        queue.forEach((fn) => fn());
        queue = [];
        return api(original);
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      } finally {
        refreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
