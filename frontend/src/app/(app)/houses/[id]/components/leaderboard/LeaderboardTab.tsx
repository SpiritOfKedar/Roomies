'use client';

import { Icon } from '@/components/Icon';
import { useAuth } from '@/hooks/useAuth';
import { useHouseLeaderboard } from './useHouseLeaderboard';
import LeaderboardPodium from './LeaderboardPodium';
import LeaderboardRankList from './LeaderboardRankList';

interface Props {
  houseId: string;
}

export default function LeaderboardTab({ houseId }: Props) {
  const { user } = useAuth();
  const { data: entries = [], isLoading } = useHouseLeaderboard(houseId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-neutral-100" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white py-16 text-center">
        <Icon name="leaderboard" size={48} className="mx-auto mb-3 text-neutral-300" />
        <p className="text-lg font-semibold text-neutral-800">No leaderboard data yet</p>
        <p className="mt-1 text-sm text-neutral-500">Complete tasks to start earning points</p>
      </div>
    );
  }

  const topThree = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="flex flex-col gap-6">
      <LeaderboardPodium entries={topThree} currentUserId={user?.id} />
      <LeaderboardRankList entries={rest} currentUserId={user?.id} />
    </div>
  );
}
