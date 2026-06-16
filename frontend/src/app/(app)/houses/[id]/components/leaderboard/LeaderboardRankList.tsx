'use client';

import type { LeaderboardEntry } from './types';

interface Props {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  startRank?: number;
}

export default function LeaderboardRankList({
  entries,
  currentUserId,
  startRank = 4,
}: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="hidden grid-cols-12 gap-4 border-b border-neutral-200 bg-neutral-50 px-5 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500 md:grid">
        <div className="col-span-1">Rank</div>
        <div className="col-span-5">Member</div>
        <div className="col-span-2 text-center">Tasks</div>
        <div className="col-span-2 text-center">Points</div>
        <div className="col-span-2 text-center">Penalties</div>
      </div>
      {entries.map((entry, i) => {
        const rank = startRank + i;
        const isMe = entry.userId === currentUserId;
        const name = entry.user?.name ?? entry.name ?? 'Member';
        const points = entry.totalPoints ?? entry.score ?? 0;

        return (
          <div
            key={entry.userId}
            className={`grid grid-cols-2 gap-3 border-b border-neutral-100 px-5 py-4 last:border-0 md:grid-cols-12 md:items-center md:gap-4 ${
              isMe ? 'bg-neutral-50' : 'hover:bg-neutral-50/80'
            }`}
          >
            <div className="col-span-1 text-lg font-bold text-neutral-400">#{rank}</div>
            <div className="col-span-5 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-neutral-700">
                {name[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="font-semibold text-neutral-900">
                {name}
                {isMe && (
                  <span className="ml-1 text-xs font-medium text-neutral-500">(you)</span>
                )}
              </span>
            </div>
            <div className="col-span-2 text-center text-sm text-neutral-600">
              {entry.completedTasks}
            </div>
            <div className="col-span-2 text-center text-base font-bold text-neutral-900">
              {points}
            </div>
            <div className="col-span-2 text-center text-sm">
              {entry.penaltyPoints > 0 ? (
                <span className="font-semibold text-red-600">−{entry.penaltyPoints}</span>
              ) : (
                <span className="text-neutral-400">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
