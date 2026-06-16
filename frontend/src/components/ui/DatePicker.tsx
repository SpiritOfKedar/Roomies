'use client';

import { useEffect, useRef, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import clsx from 'clsx';
import { Icon } from '@/components/Icon';

export interface DatePickerProps {
  value: string;
  onChange: (isoDate: string) => void;
  label?: string;
  required?: boolean;
  minDate?: Date;
  placeholder?: string;
  className?: string;
}

function toIso(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export default function DatePicker({
  value,
  onChange,
  label,
  required,
  minDate = startOfDay(new Date()),
  placeholder = 'Pick a date',
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = value ? parseISO(value) : null;
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date());

  useEffect(() => {
    if (selected) setViewMonth(selected);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const monthStart = startOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const pick = (d: Date) => {
    if (isBefore(d, minDate)) return;
    onChange(toIso(d));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-semibold text-neutral-800">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'flex h-11 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm transition-all',
          open
            ? 'border-neutral-900 ring-1 ring-neutral-900'
            : 'border-neutral-200 hover:border-neutral-400',
        )}
      >
        <span className={value ? 'font-medium text-neutral-900' : 'text-neutral-400'}>
          {value ? format(parseISO(value), 'EEE, MMM d, yyyy') : placeholder}
        </span>
        <Icon name="event" size={18} className="text-neutral-400" />
      </button>
      {required && !value && (
        <input tabIndex={-1} className="pointer-events-none absolute opacity-0" required readOnly value="" />
      )}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[min(100%,280px)] rounded-xl border border-neutral-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="flex size-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Previous month"
            >
              <Icon name="chevron_left" size={18} />
            </button>
            <span className="text-sm font-bold text-neutral-900">{format(viewMonth, 'MMMM yyyy')}</span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="flex size-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Next month"
            >
              <Icon name="chevron_right" size={18} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-400">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const disabled = isBefore(day, minDate);
              const selectedDay = selected && isSameDay(day, selected);
              const inMonth = isSameMonth(day, viewMonth);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(day)}
                  className={clsx(
                    'flex size-9 items-center justify-center rounded-lg text-sm font-medium transition-all',
                    !inMonth && 'text-neutral-300',
                    inMonth && !disabled && 'text-neutral-700 hover:bg-neutral-100',
                    disabled && 'cursor-not-allowed text-neutral-200',
                    isToday(day) && !selectedDay && inMonth && 'ring-1 ring-neutral-300',
                    selectedDay && 'bg-neutral-900 text-white hover:bg-neutral-800',
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2 border-t border-neutral-100 pt-3">
            <button
              type="button"
              onClick={() => pick(startOfDay(new Date()))}
              className="flex-1 rounded-lg bg-neutral-100 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-200"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const next = new Date();
                next.setDate(next.getDate() + 7);
                pick(startOfDay(next));
              }}
              className="flex-1 rounded-lg bg-neutral-100 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-200"
            >
              +1 week
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
