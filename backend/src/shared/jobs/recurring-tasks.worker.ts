/**
 * =============================================================================
 * Recurring Tasks Worker — BullMQ Background Job
 * =============================================================================
 * Runs on a repeatable schedule (every hour by default) and sweeps the tasks
 * table for recurring chores that are due for a new rotation cycle.
 *
 * Algorithm (per eligible recurring task):
 *   1. Task must have:  is_recurring = true  AND  status = 'completed'
 *   2. Parse cron_schedule with cron-parser to find the next scheduled time
 *      AFTER the task's createdAt timestamp.
 *   3. If that next scheduled time <= now → a new instance is overdue.
 *   4. Call the existing rotation engine (assignNextTask) to create the next
 *      task assignment for the house, preserving full round-robin fairness.
 *
 * Concurrency note:
 *   BullMQ guarantees that only ONE worker processes a given job at a time
 *   (via Redis LPOS).  The underlying assignNextTask already uses
 *   SELECT FOR UPDATE inside a Prisma interactive transaction, so concurrent
 *   triggers across multiple pods are fully safe.
 * =============================================================================
 */

import { Queue, Worker, type Job } from 'bullmq';
import { CronExpressionParser } from 'cron-parser';
import { prisma } from '../db/prisma';
import * as tasksService from '../../modules/tasks/tasks.service';
import { logger } from '../utils/logger';
import { redisConnection } from './queue';

// ---- Queue ----

export const recurringTasksQueue = new Queue('recurring-tasks-queue', {
  // @ts-expect-error: BullMQ and IORedis type definition mismatch
  connection: redisConnection,
});

/**
 * Schedule a global repeatable sweep job.
 * Safe to call on every server startup — existing repeatable jobs are cleared
 * first to prevent duplicates across rolling deployments.
 */
export async function scheduleRecurringTasksJob(): Promise<void> {
  logger.info('Scheduling BullMQ Recurring Tasks Sweeper (runs every hour)');

  const existing = await recurringTasksQueue.getRepeatableJobs();
  for (const job of existing) {
    await recurringTasksQueue.removeRepeatableByKey(job.key);
  }

  await recurringTasksQueue.add(
    'sweep-recurring-tasks',
    {},
    {
      repeat: { pattern: '0 * * * *' }, // Every hour on the hour
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
}

export async function closeRecurringTasksQueue(): Promise<void> {
  await recurringTasksQueue.close();
}

// ---- Worker ----

let recurringTasksWorker: Worker | null = null;

export function startRecurringTasksWorker(): void {
  logger.info('Initializing BullMQ Recurring Tasks Worker');

  recurringTasksWorker = new Worker(
    'recurring-tasks-queue',
    async (job: Job) => {
      const now = new Date();
      logger.info(`Recurring Tasks Worker [${job.id}]: Scanning for due recurring tasks...`);

      // Fetch all completed recurring tasks that have a cron schedule set
      const recurringTasks = await prisma.task.findMany({
        where: {
          isRecurring: true,
          status: 'completed',
          cronSchedule: { not: null },
        },
        select: {
          id: true,
          houseId: true,
          title: true,
          cronSchedule: true,
          createdAt: true,
          rewardPoints: true,
          penaltyFine: true,
          isRecurring: true,
        },
      });

      if (recurringTasks.length === 0) {
        logger.debug(`Recurring Tasks Worker [${job.id}]: No recurring tasks found.`);
        return { processed: 0 };
      }

      let spawned = 0;

      for (const task of recurringTasks) {
        // cronSchedule is guaranteed non-null by the query filter above
        const cronSchedule = task.cronSchedule!;

        try {
          // Parse the cron expression, anchored to the task's creation time
          const interval = CronExpressionParser.parse(cronSchedule, {
            currentDate: task.createdAt,
          });

          // Find the first scheduled occurrence AFTER the task was created
          const nextDueDate: Date = interval.next().toDate();

          if (nextDueDate > now) {
            // Next occurrence is still in the future — skip
            logger.debug({ taskId: task.id, nextDueDate }, 'Recurring task not yet due, skipping');
            continue;
          }

          // The next occurrence has passed → time to spawn a new rotation
          // Set deadline = next cron occurrence after NOW (the new task's window)
          const nextDeadlineInterval = CronExpressionParser.parse(cronSchedule, {
            currentDate: now,
          });
          const newDeadline: Date = nextDeadlineInterval.next().toDate();

          // Look up any active admin to satisfy assignNextTask's membership check
          const adminMember = await prisma.houseMember.findFirst({
            where: { houseId: task.houseId, role: 'admin', status: 'active' },
            select: { userId: true },
          });

          if (!adminMember) {
            logger.warn(
              { taskId: task.id, houseId: task.houseId },
              'Recurring task skipped: no active admin found in house',
            );
            continue;
          }

          await tasksService.assignNextTask(
            adminMember.userId,
            task.houseId,
            task.title,
            newDeadline.toISOString(),
          );

          spawned++;

          logger.info(
            { originalTaskId: task.id, houseId: task.houseId, title: task.title, newDeadline },
            'Recurring task: new rotation spawned',
          );
        } catch (err) {
          // Log per-task errors without killing the entire sweep
          logger.error({ err, taskId: task.id }, 'Failed to process recurring task');
        }
      }

      logger.info(
        `Recurring Tasks Worker [${job.id}]: Sweep complete. Spawned ${spawned} new task(s).`,
      );
      return { evaluated: recurringTasks.length, spawned };
    },
    {
      // @ts-expect-error: BullMQ and IORedis type definition mismatch
      connection: redisConnection,
      concurrency: 1,
    },
  );

  recurringTasksWorker.on('failed', (job, err) => {
    logger.error({ err }, `Recurring Tasks Worker: Job ${job?.id} failed`);
  });

  recurringTasksWorker.on('completed', (job, result) => {
    logger.debug({ result }, `Recurring Tasks Worker: Job ${job?.id} completed`);
  });
}

/**
 * Gracefully shut down the worker and queue during SIGTERM.
 */
export async function closeRecurringTasksWorker(): Promise<void> {
  if (recurringTasksWorker) {
    await recurringTasksWorker.close();
    recurringTasksWorker = null;
  }
}
