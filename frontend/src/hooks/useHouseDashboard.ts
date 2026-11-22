import { useQuery } from '@tanstack/react-query';
import { housesApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import type { HouseDashboard } from '@/types';

export function useHouseDashboard(
  houseId: string,
  statusFilter: 'active' | 'all' = 'active',
  options?: {
    initialData?: HouseDashboard;
    enabled?: boolean;
    /** Poll (ms), including while the tab is in the background — used by house alerts */
    pollMs?: number;
  },
) {
  return useQuery({
    refetchInterval: options?.pollMs ?? false,
    refetchIntervalInBackground: !!options?.pollMs,
    queryKey: queryKeys.houseDashboard(houseId, statusFilter),
    queryFn: async () => {
      const res = await housesApi.dashboard(houseId, statusFilter);
      return res.data.data;
    },
    enabled: options?.enabled !== false && !!houseId,
    initialData: options?.initialData,
  });
}
