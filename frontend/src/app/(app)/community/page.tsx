'use client';
import { useState, useEffect, useCallback } from 'react';
import { housesApi, leaderboardApi } from '@/lib/endpoints';
import type { House, LeaderboardEntry, HouseMember } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

const MEDAL_COLORS = [
  { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', icon: 'emoji_events' },
  { bg: 'bg-neutral-100', text: 'text-neutral-500', border: 'border-neutral-300', icon: 'military_tech' },
  { bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-200', icon: 'workspace_premium' },
];

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

export default function CommunityPage() {
  const { user } = useAuth();
  const [houses, setHouses] = useState<House[]>([]);
  const [houseLeaderboards, setHouseLeaderboards] = useState<Map<string, LeaderboardEntry[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeHouse, setActiveHouse] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const houseRes = await housesApi.list();
      const houseList: House[] = houseRes.data.data ?? [];
      setHouses(houseList);

      const lbMap = new Map<string, LeaderboardEntry[]>();
      await Promise.all(houseList.map(async (h) => {
        try {
          const res = await leaderboardApi.get(h.id);
          lbMap.set(h.id, res.data.data ?? []);
        } catch {
          lbMap.set(h.id, []);
        }
      }));
      setHouseLeaderboards(lbMap);
    } catch {
      toast.error('Failed to load community data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Aggregate leaderboard across all houses
  const aggregateLeaderboard = useCallback((): (LeaderboardEntry & { houseName?: string })[] => {
    if (activeHouse !== 'all') {
      return houseLeaderboards.get(activeHouse) ?? [];
    }

    // Merge entries by userId across houses
    const merged = new Map<string, LeaderboardEntry>();
    houseLeaderboards.forEach((entries) => {
      entries.forEach(entry => {
        const existing = merged.get(entry.userId);
        if (existing) {
          merged.set(entry.userId, {
            ...existing,
            completedTasks: existing.completedTasks + entry.completedTasks,
            penaltyPoints: existing.penaltyPoints + entry.penaltyPoints,
            totalPoints: (existing.totalPoints ?? 0) + (entry.totalPoints ?? 0),
            score: (existing.score ?? 0) + (entry.score ?? 0),
          });
        } else {
          merged.set(entry.userId, { ...entry });
        }
      });
    });

    return Array.from(merged.values()).sort(
      (a, b) => (b.totalPoints ?? b.score ?? 0) - (a.totalPoints ?? a.score ?? 0)
    );
  }, [activeHouse, houseLeaderboards]);

  const leaderboard = aggregateLeaderboard();

  // All unique members across all houses
  const allMembers = new Map<string, { name: string; email: string; houses: string[] }>();
  houses.forEach(h => {
    (h.members ?? []).forEach(m => {
      const existing = allMembers.get(m.userId);
      if (existing) {
        existing.houses.push(h.name);
      } else {
        allMembers.set(m.userId, {
          name: m.user?.name ?? 'Unknown',
          email: m.user?.email ?? '',
          houses: [h.name],
        });
      }
    });
  });

  const totalMembers = allMembers.size;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[#171717]">Community</h1>
        <p className="text-[#737373] text-sm mt-1">Your housemates and leaderboard across all houses</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">Houses</span>
            <Icon name="home" size={18} className="text-[#737373]" />
          </div>
          <span className="text-3xl font-extrabold text-[#171717]">{houses.length}</span>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">Total Members</span>
            <Icon name="group" size={18} className="text-blue-500" />
          </div>
          <span className="text-3xl font-extrabold text-blue-600">{totalMembers}</span>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">Your Rank</span>
            <Icon name="emoji_events" size={18} className="text-amber-500" />
          </div>
          <span className="text-3xl font-extrabold text-amber-600">
            #{leaderboard.findIndex(e => e.userId === user?.id) + 1 || '—'}
          </span>
        </div>
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#737373] uppercase tracking-wider">Your Points</span>
            <Icon name="stars" size={18} className="text-emerald-500" />
          </div>
          <span className="text-3xl font-extrabold text-emerald-600">
            {leaderboard.find(e => e.userId === user?.id)?.totalPoints ?? leaderboard.find(e => e.userId === user?.id)?.score ?? 0}
          </span>
        </div>
      </div>

      {/* House filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveHouse('all')}
          className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
            activeHouse === 'all'
              ? 'bg-[#171717] text-white shadow-md'
              : 'bg-white border border-neutral-200 text-[#737373] hover:border-[#171717] hover:text-[#171717]'
          }`}
        >
          All Houses
        </button>
        {houses.map(h => (
          <button
            key={h.id}
            onClick={() => setActiveHouse(h.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
              activeHouse === h.id
                ? 'bg-[#171717] text-white shadow-md'
                : 'bg-white border border-neutral-200 text-[#737373] hover:border-[#171717] hover:text-[#171717]'
            }`}
          >
            {h.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Leaderboard */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-[#171717] flex items-center gap-2">
            <Icon name="leaderboard" size={22} />
            Leaderboard
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />)}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-16 card">
              <Icon name="leaderboard" size={48} className="text-neutral-300 mb-2" />
              <p className="font-semibold text-[#171717]">No leaderboard data yet</p>
              <p className="text-sm text-[#737373] mt-1">Complete tasks to start earning points</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Top 3 podium */}
              {leaderboard.slice(0, 3).map((entry, i) => {
                const medal = MEDAL_COLORS[i];
                const isMe = entry.userId === user?.id;
                const points = entry.totalPoints ?? entry.score ?? 0;
                return (
                  <div
                    key={entry.userId}
                    className={`card !p-0 overflow-hidden transition-all hover:shadow-md ${isMe ? 'ring-2 ring-[#171717]' : ''}`}
                  >
                    <div className="flex items-center gap-5 p-5">
                      <div className={`size-12 rounded-xl flex items-center justify-center shrink-0 border ${medal.bg} ${medal.text} ${medal.border}`}>
                        <Icon name={medal.icon} size={24} />
                      </div>
                      <div className="size-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-bold text-[#171717] shrink-0">
                        {(entry.user?.name ?? entry.name)?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-[#171717] truncate">{entry.user?.name ?? entry.name}</h3>
                          {isMe && (
                            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 text-[#737373] border border-neutral-200">You</span>
                          )}
                        </div>
                        <p className="text-xs text-[#737373] mt-0.5">{entry.completedTasks} tasks completed</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1 text-[#171717]">
                          <Icon name="stars" size={18} />
                          <span className="text-xl font-extrabold">{points}</span>
                        </div>
                        {entry.penaltyPoints > 0 && (
                          <span className="text-xs text-red-500 font-medium">-{entry.penaltyPoints} penalties</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Rest */}
              {leaderboard.length > 3 && (
                <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                  {leaderboard.slice(3).map((entry, i) => {
                    const rank = i + 4;
                    const isMe = entry.userId === user?.id;
                    const points = entry.totalPoints ?? entry.score ?? 0;
                    return (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-4 px-5 py-4 border-b border-neutral-100 last:border-0 transition-colors ${isMe ? 'bg-neutral-50' : 'hover:bg-neutral-50/50'}`}
                      >
                        <span className="text-sm font-bold text-[#737373] w-8 text-center">#{rank}</span>
                        <div className="size-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-[#171717]">
                          {(entry.user?.name ?? entry.name)?.[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-[#171717] text-sm truncate">
                            {entry.user?.name ?? entry.name}
                            {isMe && <span className="text-[#737373] text-xs ml-1">(you)</span>}
                          </span>
                        </div>
                        <span className="text-xs text-[#737373] font-medium">{entry.completedTasks} tasks</span>
                        <span className="font-bold text-[#171717] text-sm">{points} pts</span>
                        {entry.penaltyPoints > 0 && (
                          <span className="text-xs text-red-500 font-medium">-{entry.penaltyPoints}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Members panel */}
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-[#171717] flex items-center gap-2">
            <Icon name="group" size={22} />
            Members
          </h2>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-neutral-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-3">
              {Array.from(allMembers.entries()).map(([userId, member], idx) => {
                const isMe = userId === user?.id;
                const colorClass = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                return (
                  <div key={userId} className={`card !p-4 flex items-center gap-4 transition-all hover:shadow-md ${isMe ? 'ring-1 ring-[#171717]' : ''}`}>
                    <div className={`size-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colorClass}`}>
                      {member.name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-[#171717] text-sm truncate">{member.name}</p>
                        {isMe && <span className="text-[10px] font-bold text-[#737373] uppercase tracking-wider">(you)</span>}
                      </div>
                      <p className="text-xs text-[#737373] truncate">{member.email}</p>
                    </div>
                    <div className="shrink-0">
                      {member.houses.length === 1 ? (
                        <span className="text-xs font-medium text-[#737373] bg-neutral-100 px-2 py-1 rounded-md">{member.houses[0]}</span>
                      ) : (
                        <span className="text-xs font-medium text-[#737373] bg-neutral-100 px-2 py-1 rounded-md">
                          {member.houses.length} houses
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick House Links */}
          <div>
            <h3 className="text-sm font-bold text-[#737373] uppercase tracking-wider mb-3">Your Houses</h3>
            <div className="space-y-2">
              {houses.map(h => (
                <Link
                  key={h.id}
                  href={`/houses/${h.id}`}
                  className="card !p-4 flex items-center gap-3 hover:shadow-md transition-all group"
                >
                  <div className="size-9 rounded-lg bg-neutral-900 flex items-center justify-center text-white shrink-0">
                    <Icon name="home" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#171717] text-sm truncate">{h.name}</p>
                    <p className="text-xs text-[#737373]">{h.members?.length ?? 0} members</p>
                  </div>
                  <Icon name="arrow_forward" size={18} className="text-[#737373] group-hover:text-[#171717] transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
