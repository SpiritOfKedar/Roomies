import { useQuery } from '@tanstack/react-query';
import { leaderboardApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';

export function useHouseLeaderboard(houseId: string) {
  return useQuery({
    queryKey: queryKeys.leaderboard(houseId),
    queryFn: async () => {
      const res = await leaderboardApi.get(houseId);
      return res.data.data ?? [];
    },
    enabled: !!houseId,
  });
}
