'use client';

import { useEffect, useRef, useCallback } from 'react';
import { tasksApi } from '@/lib/endpoints';
import type { TaskVoteStatus } from '@/types';

export function useTaskPolling(
  taskId: string | null,
  enabled: boolean,
  onUpdate: (data: TaskVoteStatus) => void,
  intervalMs = 5000,
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const poll = useCallback(async () => {
    if (!taskId) return;
    try {
      const res = await tasksApi.getVotes(taskId);
      onUpdateRef.current(res.data.data);
    } catch {
      // silent — polling should not disrupt UX
    }
  }, [taskId]);

  useEffect(() => {
    if (!enabled || !taskId) return;
    poll();
    const id = setInterval(poll, intervalMs);
    return () => clearInterval(id);
  }, [enabled, taskId, intervalMs, poll]);
}
