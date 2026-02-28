'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authApi } from '@/lib/endpoints';
import type { User } from '@/types';

const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
const DEV_USER: User = {
  id: 'dev-user-id',
  name: 'Dev User',
  email: 'dev@example.com',
  status: 'active',
  createdAt: new Date().toISOString(),
};

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (SKIP_AUTH) { setUser(DEV_USER); setLoading(false); return; }
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then((r) => setUser(r.data.data))
      .catch(() => localStorage.clear())
      .finally(() => setLoading(false));
  }, []);

  const persist = (accessToken: string, refreshToken: string, u: User) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setUser(u);
  };

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    persist(data.data.tokens.accessToken, data.data.tokens.refreshToken, data.data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const { data } = await authApi.register(name, email, password);
    persist(data.data.tokens.accessToken, data.data.tokens.refreshToken, data.data.user);
  };

  const logout = async () => {
    const rt = localStorage.getItem('refreshToken') ?? '';
    await authApi.logout(rt).catch(() => {});
    localStorage.clear();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
