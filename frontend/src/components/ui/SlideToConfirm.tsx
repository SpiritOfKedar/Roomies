'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { ChevronsRight } from 'lucide-react';
import StatusMark from '@/components/ui/reactbits/status-mark';
import type { ActionStatus } from '@/hooks/useActionStatus';
import { cn } from '@/lib/utils';

interface Props {
  /** Text in the track, e.g. "Slide to create chore" */
  label: string;
  /** Called once the handle reaches the end (or Enter/Space on the handle) */
  onConfirm: () => void;
  /** Status of the action the slide starts; drives the mark and the reset */
  status: ActionStatus;
  labels?: { running?: string; done?: string; failed?: string };
  disabled?: boolean;
  className?: string;
}

const PAD = 4; // gap between handle and track edge
const HANDLE = 44;
const CONFIRM_AT = 0.9; // share of the track the handle must travel
const SPRING = { type: 'spring' as const, stiffness: 500, damping: 40 };

/**
 * Slide-to-confirm: a deliberate gesture for actions you don't want to fire by
 * accident. Let go early and it springs back; if the action doesn't start
 * (e.g. the form is invalid) or fails, it slides back so you can try again.
 */
export default function SlideToConfirm({ label, onConfirm, status, labels, disabled = false, className }: Props) {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [max, setMax] = useState(0);
  const x = useMotionValue(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  // Label fades out and the dark fill follows the handle as it travels.
  const labelOpacity = useTransform(x, (v) => (max ? 1 - Math.min(1, v / (max * 0.6)) : 1));
  const fillWidth = useTransform(x, (v) => v + HANDLE + PAD * 2);
  // Hidden at rest so it doesn't ring the handle; fades in over the first few px of travel.
  const fillOpacity = useTransform(x, (v) => Math.min(1, v / 16));

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setMax(Math.max(0, el.clientWidth - HANDLE - PAD * 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const slideTo = (to: number) => (reduce ? x.set(to) : animate(x, to, SPRING));

  // Back to the start once the action has settled without succeeding.
  useEffect(() => {
    if (status === 'failed') {
      const t = setTimeout(() => slideTo(0), 900);
      return () => clearTimeout(t);
    }
    if (status === 'idle' && x.get() > 0) slideTo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const confirm = () => {
    slideTo(max);
    onConfirm();
    // If nothing started (validation blocked the submit), let go again.
    setTimeout(() => {
      if (statusRef.current === 'idle') slideTo(0);
    }, 450);
  };

  const working = status !== 'idle';
  const locked = disabled || working;

  return (
    <div
      ref={trackRef}
      className={cn(
        'relative h-[52px] select-none overflow-hidden rounded-full bg-neutral-100 ring-1 ring-inset ring-neutral-200',
        disabled && 'opacity-50',
        className,
      )}
    >
      {/* fill that grows behind the handle */}
      <motion.div aria-hidden className="absolute inset-y-0 left-0 rounded-full bg-neutral-900" style={{ width: fillWidth, opacity: fillOpacity }} />

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-sm font-semibold">
        {working ? (
          <StatusMark
            status={status === 'running' ? 'running' : status === 'done' ? 'done' : 'failed'}
            label={
              status === 'running'
                ? labels?.running ?? 'Working…'
                : status === 'done'
                  ? labels?.done ?? 'Done'
                  : labels?.failed ?? 'Failed'
            }
            color="#ffffff"
            doneColor="#4ade80"
            errorColor="#f87171"
            size={18}
            fontSize={14}
            strike={false}
          />
        ) : (
          <motion.span style={{ opacity: labelOpacity }} className="text-neutral-600">
            {label}
          </motion.span>
        )}
      </div>

      <motion.button
        type="button"
        aria-label={label}
        disabled={locked}
        drag={locked ? false : 'x'}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x, width: HANDLE, height: HANDLE, top: PAD, left: PAD }}
        onDragEnd={() => (x.get() >= max * CONFIRM_AT ? confirm() : slideTo(0))}
        onKeyDown={(e) => {
          if (locked) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            confirm();
          }
        }}
        className="absolute z-10 flex cursor-grab touch-none items-center justify-center rounded-full bg-white text-neutral-900 shadow-md ring-1 ring-black/5 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 active:cursor-grabbing disabled:cursor-default"
      >
        <ChevronsRight className="size-5" />
      </motion.button>
    </div>
  );
}
