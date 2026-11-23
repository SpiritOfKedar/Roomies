'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { Icon } from '@/components/Icon';

export type HouseTab = 'tasks' | 'chat' | 'expenses' | 'leaderboard' | 'swaps' | 'penalties';

export const HOUSE_TABS: { id: HouseTab; label: string; icon: string }[] = [
  { id: 'tasks', label: 'Tasks', icon: 'check_circle' },
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'expenses', label: 'Expenses', icon: 'payments' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'leaderboard' },
  { id: 'swaps', label: 'Swaps', icon: 'swap_horiz' },
  { id: 'penalties', label: 'Penalties', icon: 'gavel' },
];

export function isHouseTab(value: string | null): value is HouseTab {
  return HOUSE_TABS.some((t) => t.id === value);
}

type Props = {
  active: HouseTab;
  onChange: (tab: HouseTab) => void;
  /** Small count shown next to a tab label (0 / undefined hides it). */
  badges?: Partial<Record<HouseTab, number>>;
};

/**
 * Sticky segmented tab bar for a house. A dark pill slides to the active tab;
 * once the bar sticks to the top it turns frosted so content can scroll under it.
 * On narrow screens it scrolls sideways and keeps the active tab in view.
 */
export default function HouseTabs({ active, onChange, badges = {} }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<HouseTab, HTMLButtonElement | null>>>({});
  const [stuck, setStuck] = useState(false);

  // The sentinel sits just above the bar; once it leaves the viewport, the bar is stuck.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
      rootMargin: '-16px 0px 0px 0px',
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Keep the active tab visible when the row overflows (phones). Scrolls the row only, never the page.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const tab = tabRefs.current[active];
    if (!scroller || !tab || scroller.scrollWidth <= scroller.clientWidth) return;
    const target = tab.offsetLeft - (scroller.clientWidth - tab.offsetWidth) / 2;
    scroller.scrollTo({ left: target, behavior: 'smooth' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = HOUSE_TABS.findIndex((t) => t.id === active);
    const next = HOUSE_TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + HOUSE_TABS.length) % HOUSE_TABS.length];
    onChange(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <div className="sticky top-3 md:top-4 z-30 mb-8 flex justify-center">
        <div
          ref={scrollerRef}
          className={clsx(
            'max-w-full overflow-x-auto rounded-full border p-1 transition-[background-color,box-shadow,border-color] duration-300',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            stuck
              ? 'border-black/[0.06] bg-white/70 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)] backdrop-blur-xl backdrop-saturate-150'
              : 'border-[#E5E5E5] bg-white shadow-sm',
          )}
        >
          <div role="tablist" aria-label="House sections" className="flex w-max gap-0.5" onKeyDown={onKeyDown}>
            {HOUSE_TABS.map((t) => {
              const selected = t.id === active;
              const count = badges[t.id] ?? 0;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[t.id] = el;
                  }}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => onChange(t.id)}
                  className={clsx(
                    'relative rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-black/20',
                    selected ? 'text-white' : 'text-[#737373] hover:text-[#171717]',
                  )}
                >
                  {selected && (
                    <motion.span
                      layoutId="house-tab-pill"
                      className="absolute inset-0 rounded-full bg-[#171717] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-2">
                    <Icon name={t.icon} size={16} />
                    {t.label}
                    {count > 0 && (
                      <span
                        className={clsx(
                          'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums transition-colors',
                          selected ? 'bg-white text-[#171717]' : 'bg-[#171717] text-white',
                        )}
                        aria-label={`${count} waiting`}
                      >
                        {count > 99 ? '99+' : count}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
