'use client';
import { useState, useEffect, useCallback } from 'react';
import { leaderboardApi } from '@/lib/endpoints';
import type { LeaderboardEntry } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface Props { houseId: string; }

const MEDAL_ICONS = [
  { icon: 'trophy', bg: 'bg-yellow-500/20', text: 'text-yellow-400', ring: 'ring-yellow-500/30' },
  { icon: 'military_tech', bg: 'bg-slate-400/20', text: 'text-slate-300', ring: 'ring-slate-400/30' },
  { icon: 'workspace_premium', bg: 'bg-orange-500/20', text: 'text-orange-400', ring: 'ring-orange-500/30' },
];

export default function LeaderboardTab({ houseId }: Props) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await leaderboardApi.get(houseId);
      setEntries(res.data.data ?? []);
    } catch {
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [houseId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        <span className="material-symbols-outlined mb-2" style={{ fontSize: '48px' }}>leaderboard</span>
        <p className="text-lg font-semibold text-slate-300">No leaderboard data yet</p>
        <p className="text-sm mt-1">Complete tasks to start earning points</p>
      </div>
    );
  }

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="flex flex-col gap-6">
      {/* Podium for top 3 */}
      {topThree.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topThree.map((entry, i) => {
            const isMe = entry.userId === user?.id;
            const medal = MEDAL_ICONS[i];
            return (
              <div key={entry.userId} className={`relative bg-slate-900/60 backdrop-blur-xl border rounded-2xl p-6 flex flex-col items-center gap-3 transition-all hover:scale-[1.02] ${isMe ? 'border-[#22d3ee]/40 shadow-[0_0_15px_rgba(34,211,238,0.15)]' : 'border-white/10'}`}>
                {i === 0 && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] font-bold uppercase tracking-wider">
                    Champion
                  </div>
                )}
                <div className={`size-14 rounded-full ${medal.bg} ring-2 ${medal.ring} flex items-center justify-center`}>
                  <span className={`material-symbols-outlined ${medal.text}`} style={{ fontSize: '28px' }}>{medal.icon}</span>
                </div>
                <div className="size-12 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold text-white ring-2 ring-white/10">
                  {(entry.user?.name ?? entry.name)?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="text-center">
                  <p className="font-bold text-white text-base">
                    {entry.user?.name ?? entry.name}
                    {isMe && <span className="text-[#22d3ee] text-xs ml-1">(you)</span>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{entry.completedTasks} tasks completed</p>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="text-center">
                    <p className="text-2xl font-extrabold text-white">{entry.totalPoints ?? entry.score ?? 0}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Points</p>
                  </div>
                  {entry.penaltyPoints > 0 && (
                    <div className="text-center">
                      <p className="text-lg font-bold text-red-400">-{entry.penaltyPoints}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Penalties</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest of the leaderboard table */}
      {rest.length > 0 && (
        <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-black/20 border-b border-white/10 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-1">Rank</div>
            <div className="col-span-5">Member</div>
            <div className="col-span-2 text-center">Completed</div>
            <div className="col-span-2 text-center">Points</div>
            <div className="col-span-2 text-center">Penalties</div>
          </div>
          {rest.map((entry, i) => {
            const rank = i + 4;
            const isMe = entry.userId === user?.id;
            return (
              <div key={entry.userId} className={`grid grid-cols-2 md:grid-cols-12 gap-4 px-6 py-4 items-center border-b border-white/5 last:border-0 transition-colors ${isMe ? 'bg-[#22d3ee]/5' : 'hover:bg-white/5'}`}>
                <div className="col-span-1 text-slate-400 font-bold text-lg">#{rank}</div>
                <div className="col-span-5 flex items-center gap-3">
                  <div className="size-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white ring-1 ring-white/10">
                    {(entry.user?.name ?? entry.name)?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span className="font-bold text-white">
                    {entry.user?.name ?? entry.name}
                    {isMe && <span className="text-[#22d3ee] text-xs ml-1">(you)</span>}
                  </span>
                </div>
                <div className="col-span-2 text-center text-slate-300 font-medium">{entry.completedTasks}</div>
                <div className="col-span-2 text-center font-bold text-white">{entry.totalPoints ?? entry.score ?? 0}</div>
                <div className="col-span-2 text-center">
                  {entry.penaltyPoints > 0
                    ? <span className="text-red-400 font-bold">-{entry.penaltyPoints}</span>
                    : <span className="text-slate-500">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
