import { format, formatDistanceToNowStrict, isPast } from 'date-fns';

export interface TimeOfDay {
  hours: number;
  minutes: number;
}

/** End of day — the default due time when someone only picks a date. */
export const END_OF_DAY: TimeOfDay = { hours: 23, minutes: 59 };

/**
 * Build a deadline from a local calendar date ("yyyy-MM-dd") and a local time.
 * Uses the viewer's timezone, so "Sat 29, 18:00" means 6 PM where they are
 * (the old code appended a UTC "T23:59:59Z", which drifted by the UTC offset).
 */
export function toDeadlineISO(date: string, time: TimeOfDay = END_OF_DAY): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, time.hours, time.minutes, 0, 0).toISOString();
}

/** Split a stored deadline back into the local date + time a form edits. */
export function splitDeadline(iso: string): { date: string; time: TimeOfDay } {
  const d = new Date(iso);
  return { date: format(d, 'yyyy-MM-dd'), time: { hours: d.getHours(), minutes: d.getMinutes() } };
}

/** "Sat 29 Nov, 6:00 PM" */
export function formatDue(iso: string): string {
  return format(new Date(iso), 'EEE d MMM, h:mm a');
}

/** "in 3 days" / "3 hours ago" */
export function relativeDue(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

export function isOverdue(iso: string): boolean {
  return isPast(new Date(iso));
}

/** One phrase for lists: "due in 3 days" or "overdue by 2 hours". */
export function dueSummary(iso: string): string {
  const d = new Date(iso);
  return isPast(d)
    ? `overdue by ${formatDistanceToNowStrict(d)}`
    : `due ${formatDistanceToNowStrict(d, { addSuffix: true })}`;
}
