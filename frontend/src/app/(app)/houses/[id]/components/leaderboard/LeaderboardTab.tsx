'use client';

import { Icon } from '@/components/Icon';
import { useAuth } from '@/hooks/useAuth';
import { useHouseLeaderboard } from './useHouseLeaderboard';
import LeaderboardPodium from './LeaderboardPodium';
import LeaderboardRankList from './LeaderboardRankList';
import Loader from '@/components/ui/Loader';
import EmptyState from '@/components/ui/EmptyState';

interface Props {
  houseId: string;
}

export default function LeaderboardTab({ houseId }: Props) {
  const { user } = useAuth();
  const { data: entries = [], isLoading } = useHouseLeaderboard(houseId);

  if (isLoading) {
    return (
      <Loader label="Loading leaderboard" />
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState title="No scores yet" description="Points appear here once housemates finish approved turns." />
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
