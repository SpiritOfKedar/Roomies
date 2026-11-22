import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

const storageKey = (houseId: string) => `roomies:alerts:${houseId}`;

/**
 * Per-house alerts switch (stored in this browser only).
 *
 * On:  the inbox bell shows its count, and when something new starts waiting
 *      on you while this tab is in the background, a browser notification fires.
 * Off: the house is silenced — no badge, no notifications.
 *
 * Split in two so the dashboard query can poll based on the setting:
 *   const alerts = useHouseAlerts(houseId)        // before the query
 *   useNeedsNotifier(houseId, name, count, alerts.enabled) // after it
 */
export function useHouseAlerts(houseId: string) {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(houseId));
      if (saved !== null) setEnabledState(saved === '1');
    } catch {
      /* storage unavailable — keep the default */
    }
  }, [houseId]);

  const setEnabled = useCallback(
    async (on: boolean) => {
      setEnabledState(on);
      try {
        localStorage.setItem(storageKey(houseId), on ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (!on || typeof window === 'undefined' || !('Notification' in window)) return;
      // Ask only in response to the user switching alerts on.
      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result === 'denied') toast("Browser notifications are blocked. You'll still see the badge here.");
      } else if (Notification.permission === 'denied') {
        toast("Browser notifications are blocked. You'll still see the badge here.");
      }
    },
    [houseId],
  );

  return { enabled, setEnabled };
}

/**
 * Fire a browser notification when the number of things waiting on the viewer
 * goes up while this tab is in the background (and alerts are on).
 *
 * @param needsCount items waiting on the viewer, or null while still loading
 */
export function useNeedsNotifier(
  houseId: string,
  houseName: string | undefined,
  needsCount: number | null,
  enabled: boolean,
) {
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (needsCount === null) return;
    const before = previous.current;
    previous.current = needsCount;
    if (before === null || needsCount <= before || !enabled) return;
    if (document.visibilityState === 'visible') return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = needsCount;
    new Notification(`Roomies · ${houseName ?? 'your house'}`, {
      body: `${n} thing${n === 1 ? '' : 's'} waiting on you`,
      tag: `roomies-${houseId}`,
    });
  }, [needsCount, enabled, houseId, houseName]);
}
