import { useQuery } from '@tanstack/react-query';
import { housesApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import type { HouseDashboard } from '@/types';

export function useHouseDashboard(
  houseId: string,
  statusFilter: 'active' | 'all' = 'active',
  options?: { initialData?: HouseDashboard; enabled?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.houseDashboard(houseId, statusFilter),
    queryFn: async () => {
      const res = await housesApi.dashboard(houseId, statusFilter);
      return res.data.data;
    },
    enabled: options?.enabled !== false && !!houseId,
    initialData: options?.initialData,
  });
}
