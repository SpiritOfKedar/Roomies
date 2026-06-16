import { useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';

const PAGE_SIZE = 10;

export function useHouseExpenses(houseId: string, page: number) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.expenses(houseId, page),
    queryFn: async () => {
      const res = await expensesApi.list(houseId, page, PAGE_SIZE);
      return res.data.data;
    },
    enabled: !!houseId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['house', houseId, 'expenses'] });
  };

  return {
    ...query,
    expenses: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    pageSize: PAGE_SIZE,
    refresh,
  };
}
