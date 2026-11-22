'use client';

import { AnimatedCounter } from '@/components/ui/rare/animated-counter';

import { Icon } from '@/components/Icon';
import type { LeaderboardEntry } from './types';

const STYLES = [
  {
    icon: 'trophy',
    badge: 'Champion',
    ring: 'ring-amber-400/50',
    iconBg: 'bg-amber-50 text-amber-600',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    elevate: 'md:-mt-3',
  },
  {
    icon: 'military_tech',
    badge: '2nd place',
    ring: 'ring-neutral-300',
    iconBg: 'bg-neutral-100 text-neutral-600',
    badgeClass: 'bg-neutral-100 text-neutral-600 border-neutral-200',
    elevate: '',
  },
  {
    icon: 'workspace_premium',
    badge: '3rd place',
    ring: 'ring-orange-300/60',
    iconBg: 'bg-orange-50 text-orange-600',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
    elevate: '',
  },
] as const;

interface Props {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

export default function LeaderboardPodium({ entries, currentUserId }: Props) {
  if (entries.length === 0) return null;

  const display =
    entries.length >= 3
      ? [
          { entry: entries[1], style: STYLES[1], order: 'md:order-1' },
          { entry: entries[0], style: STYLES[0], order: 'md:order-2' },
          { entry: entries[2], style: STYLES[2], order: 'md:order-3' },
        ]
      : entries.map((entry, i) => ({
          entry,
          style: STYLES[i],
          order: '',
        }));

  return (
    <div
      className={`grid grid-cols-1 gap-4 md:items-end ${
        display.length === 1 ? 'md:grid-cols-1 max-w-sm mx-auto' : 'md:grid-cols-3'
      }`}
    >
      {display.map(({ entry, style, order }) => {
        const displayName = entry.user?.name ?? entry.name ?? 'Member';
        const isMe = entry.userId === currentUserId;
        const points = entry.totalPoints ?? entry.score ?? 0;

        return (
          <div
            key={entry.userId}
            className={`relative flex flex-col items-center rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:shadow-md ${order} ${style.elevate} ${
              isMe ? 'ring-2 ring-neutral-900 ring-offset-2' : ''
            }`}
          >
            <span
              className={`mb-3 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badgeClass}`}
            >
              {style.badge}
            </span>
            <div
              className={`mb-3 flex size-14 items-center justify-center rounded-full ring-2 ${style.ring} ${style.iconBg}`}
            >
              <Icon name={style.icon} size={28} />
            </div>
            <div className="mb-2 flex size-12 items-center justify-center rounded-full bg-neutral-900 text-lg font-bold text-white">
              {displayName[0]?.toUpperCase() ?? '?'}
            </div>
            <p className="text-center font-bold text-neutral-900">
              {displayName}
              {isMe && <span className="ml-1 text-xs font-semibold text-neutral-500">(you)</span>}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">{entry.completedTasks} tasks done</p>
            <AnimatedCounter value={points} className="mt-3 text-3xl font-extrabold text-neutral-900" />
            <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">points</p>
            {entry.penaltyPoints > 0 && (
              <p className="mt-1 text-xs font-semibold text-red-600">−{entry.penaltyPoints} penalties</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
