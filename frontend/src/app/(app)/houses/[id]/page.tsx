'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { housesApi } from '@/lib/endpoints';
import type { House, HouseMember } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import TasksTab from './components/TasksTab';
import ExpensesTab from './components/ExpensesTab';
import LeaderboardTab from './components/LeaderboardTab';
import SwapsTab from './components/SwapsTab';
import PenaltiesSection from './components/PenaltiesSection';
import toast from 'react-hot-toast';

type Tab = 'tasks' | 'expenses' | 'leaderboard' | 'swaps' | 'penalties';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'tasks',       label: 'Tasks',       icon: 'check_circle' },
  { id: 'expenses',    label: 'Expenses',     icon: 'payments' },
  { id: 'leaderboard', label: 'Leaderboard',  icon: 'leaderboard' },
  { id: 'swaps',       label: 'Swaps',        icon: 'swap_horiz' },
  { id: 'penalties',   label: 'Penalties',    icon: 'gavel' },
];

export default function HousePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [house, setHouse] = useState<House | null>(null);
  const [members, setMembers] = useState<HouseMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('tasks');

  const load = useCallback(async () => {
    try {
      const res = await housesApi.get(id);
      const h: House = res.data.data;
      setHouse(h);
      setMembers(h.members ?? []);
    } catch {
      toast.error('House not found');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const isAdmin = members.find(m => m.userId === user?.id)?.role === 'admin';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!house) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-display antialiased relative">
      {/* Ambient background blobs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#22d3ee]/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative flex min-h-screen w-full flex-col z-10">
        {/* Dark Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-[#0f172a]/80 px-6 md:px-10 py-4 backdrop-blur-md">
          <div className="flex items-center gap-4 text-white">
            <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mr-2">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
            </button>
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#22d3ee]/20 to-blue-600/20 text-[#22d3ee] ring-1 ring-white/10 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>diversity_2</span>
            </div>
            <h2 className="text-xl font-bold leading-tight tracking-tight" style={{ textShadow: '0 0 10px rgba(34,211,238,0.5)' }}>RoomieSync</h2>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-2 bg-white/5 rounded-full px-2 p-1 border border-white/5">
              <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all">Dashboard</button>
              <span className="px-4 py-2 text-sm font-bold text-[#0f172a] bg-[#22d3ee] rounded-full shadow-[0_0_15px_rgba(34,211,238,0.4)]">My Houses</span>
              <button className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-all">Settings</button>
            </nav>
            <button className="flex size-10 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors border border-white/5">
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
            </button>
            <div className="size-10 rounded-full bg-slate-700 flex items-center justify-center ring-2 ring-[#22d3ee]/50 text-sm font-bold text-white shadow-[0_0_10px_rgba(34,211,238,0.2)]">
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex flex-1 flex-col items-center px-4 py-8 md:px-10 lg:px-20">
          <div className="flex w-full max-w-7xl flex-col gap-8">
            {/* House header glass panel */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 flex flex-col gap-6 rounded-3xl p-8 shadow-2xl md:flex-row md:items-start md:justify-between">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <h1 className="text-4xl font-black tracking-tighter text-white sm:text-5xl drop-shadow-lg">{house.name}</h1>
                  {isAdmin && (
                    <span className="inline-flex items-center rounded-full bg-[#22d3ee]/10 border border-[#22d3ee]/20 px-3 py-1 text-xs font-bold text-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-slate-400 font-medium text-lg">{house.members?.length ?? 0} member{(house.members?.length ?? 0) !== 1 ? 's' : ''}</p>
                {house.inviteCode && isAdmin && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-slate-500">Invite code:</span>
                    <code className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-mono text-[#22d3ee] select-all">{house.inviteCode}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(house.inviteCode!); toast.success('Copied!'); }}
                      className="text-xs text-[#22d3ee] hover:text-white transition-colors font-semibold"
                    >Copy</button>
                  </div>
                )}
                <div className="mt-4 flex items-center gap-4">
                  <button className="bg-gradient-to-r from-[#22d3ee] via-blue-500 to-[#22d3ee] bg-[length:200%_200%] animate-[gradient-xy_3s_ease_infinite] inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-slate-900 shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] transition-all hover:scale-105">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add_task</span>
                    Assign Task
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white transition-colors backdrop-blur-sm">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>settings</span>
                    Manage House
                  </button>
                </div>
              </div>

              {/* Roommates panel */}
              <div className="flex flex-col gap-4 bg-black/20 p-5 rounded-2xl border border-white/5 shrink-0">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Roommates</p>
                <div className="flex -space-x-4 overflow-hidden p-1">
                  {members.map((m, i) => (
                    <div key={m.userId} className="group relative hover:z-10 transition-all hover:scale-110">
                      <div className="size-14 rounded-full ring-2 ring-[#0f172a] bg-slate-700 flex items-center justify-center text-lg font-bold text-white shadow-lg">
                        {m.user?.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span
                        className={`absolute bottom-0 right-0 block size-4 rounded-full ring-2 ring-[#0f172a] ${
                          i < 2 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                  ))}
                  <button className="flex size-14 items-center justify-center rounded-full bg-white/5 ring-2 ring-[#0f172a] hover:bg-white/10 transition-colors border border-white/10">
                    <span className="material-symbols-outlined text-slate-400" style={{ fontSize: '20px' }}>add</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="w-full">
              <nav className="flex gap-4 p-2 overflow-x-auto bg-black/20 rounded-2xl border border-white/5">
                {TABS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`group flex-1 inline-flex justify-center items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all whitespace-nowrap ${
                      tab === t.id
                        ? 'bg-white/10 text-[#22d3ee] shadow-lg ring-1 ring-white/5'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab content */}
            <div>
              {tab === 'tasks'       && <TasksTab       houseId={id} members={members} isAdmin={isAdmin} />}
              {tab === 'expenses'    && <ExpensesTab    houseId={id} members={members} />}
              {tab === 'leaderboard' && <LeaderboardTab houseId={id} />}
              {tab === 'swaps'       && <SwapsTab       houseId={id} members={members} />}
              {tab === 'penalties'   && <PenaltiesSection houseId={id} members={members} isAdmin={isAdmin} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
