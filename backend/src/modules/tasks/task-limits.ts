/**
 * =============================================================================
 * Task Limits — bounds and attempt rules shared by tasks, voting and jobs
 * =============================================================================
 */

import { env } from '../../shared/utils/env';

/** Upper bound for a task's reward points (weight 10 × 10 points). */
export const MAX_REWARD_POINTS = 100;

/** Upper bound for a task's penalty fine (currency units, 2 dp). */
export const MAX_PENALTY_FINE = 1000;

/** Assignment weight range offered in the UI; maps to points (×10) and fine (×5). */
export const MAX_TASK_WEIGHT = 10;

/**
 * Total submissions allowed for one task instance: the first submission plus
 * TASK_MAX_RESUBMISSIONS retries after disputes.
 */
export function maxSubmissionAttempts(): number {
  return env.TASK_MAX_RESUBMISSIONS + 1;
}

/**
 * Minimum time an assignee gets to resubmit after a dispute. Disputed tasks
 * expire at their deadline, so a dispute landing minutes before the deadline
 * must not leave the assignee with no chance to respond.
 */
export const DISPUTE_GRACE_MS = 24 * 60 * 60 * 1000;
