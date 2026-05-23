/**
 * Chore rotation helpers — deadline computation for spawned instances.
 */

import { CronExpressionParser } from 'cron-parser';
import { env } from '../../shared/utils/env';

export function computeNextRotationDeadline(
  cronSchedule: string | null | undefined,
  createdAt: Date,
  previousDeadline: Date,
): Date {
  const now = new Date();

  if (cronSchedule) {
    const interval = CronExpressionParser.parse(cronSchedule, { currentDate: now });
    return interval.next().toDate();
  }

  const durationMs = previousDeadline.getTime() - createdAt.getTime();
  const minMs = 24 * 60 * 60 * 1000;
  const maxMs = 30 * 24 * 60 * 60 * 1000;
  const defaultMs = env.ROTATION_DEFAULT_DEADLINE_DAYS * 24 * 60 * 60 * 1000;

  const clampedMs = Math.min(maxMs, Math.max(minMs, durationMs > 0 ? durationMs : defaultMs));
  return new Date(now.getTime() + clampedMs);
}

/**
 * Recompute deadline when a task is reassigned (swap or admin).
 * Uses cron next interval when scheduled; otherwise preserves the original window length.
 */
export function computeReassignmentDeadline(
  cronSchedule: string | null | undefined,
  createdAt: Date,
  previousDeadline: Date,
): Date {
  return computeNextRotationDeadline(cronSchedule, createdAt, previousDeadline);
}
