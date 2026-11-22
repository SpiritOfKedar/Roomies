import { useCallback, useEffect, useRef, useState } from 'react';

export type ActionStatus = 'idle' | 'running' | 'done' | 'failed';

const DONE_HOLD_MS = 650;
const FAILED_HOLD_MS = 1600;

/**
 * Tracks one async action for a button's status mark:
 * idle → running → done (held briefly so the tick is seen) / failed → idle.
 *
 * run() resolves after the "done" hold, so callers can close a modal or
 * navigate once the success state has been shown. Errors are re-thrown.
 */
export function useActionStatus() {
  const [status, setStatus] = useState<ActionStatus>('idle');
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const settle = (next: ActionStatus, holdMs: number) => {
    if (!mounted.current) return;
    setStatus(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => mounted.current && setStatus('idle'), holdMs);
  };

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T> => {
    clearTimeout(timer.current);
    setStatus('running');
    try {
      const result = await action();
      settle('done', DONE_HOLD_MS + 600);
      await new Promise((r) => setTimeout(r, DONE_HOLD_MS));
      return result;
    } catch (err) {
      settle('failed', FAILED_HOLD_MS);
      throw err;
    }
  }, []);

  return { status, run, busy: status === 'running' || status === 'done' };
}
