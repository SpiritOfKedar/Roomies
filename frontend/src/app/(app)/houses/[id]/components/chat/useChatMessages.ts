import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { messagesApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/query-keys';
import type { HouseMessage } from '@/types';

const POLL_INTERVAL_MS = 5_000;

export function useChatMessages(houseId: string, isActive: boolean) {
  const queryClient = useQueryClient();
  const lastMessageIdRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: queryKeys.messages(houseId),
    queryFn: async () => {
      const res = await messagesApi.list(houseId, 80);
      return (res.data.data ?? []) as HouseMessage[];
    },
    enabled: !!houseId,
    refetchInterval: isActive ? POLL_INTERVAL_MS : false,
  });

  const messages = query.data ?? [];

  useEffect(() => {
    const last = messages[messages.length - 1];
    lastMessageIdRef.current = last?.id ?? null;
  }, [messages]);

  const appendMessage = (msg: HouseMessage) => {
    queryClient.setQueryData<HouseMessage[]>(queryKeys.messages(houseId), (prev = []) => [
      ...prev,
      msg,
    ]);
  };

  return { ...query, messages, appendMessage };
}
