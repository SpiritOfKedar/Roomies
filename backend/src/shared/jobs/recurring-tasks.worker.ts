/**
 * =============================================================================
 * Recurring Tasks Worker — safety net for missed immediate spawns
 * =============================================================================
 */

import { Queue, Worker, type Job } from 'bullmq';
import { prisma } from '../db/prisma';
import * as tasksService from '../../modules/tasks/tasks.service';
import { logger } from '../utils/logger';
import { redisConnection } from './queue';

export const recurringTasksQueue = new Queue('recurring-tasks-queue', {
  // @ts-expect-error: BullMQ and IORedis type definition mismatch
  connection: redisConnection,
});

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
      repeat: { pattern: '0 * * * *' },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
}

export async function closeRecurringTasksQueue(): Promise<void> {
  await recurringTasksQueue.close();
}

let recurringTasksWorker: Worker | null = null;

export function startRecurringTasksWorker(): void {
  logger.info('Initializing BullMQ Recurring Tasks Worker');

  recurringTasksWorker = new Worker(
    'recurring-tasks-queue',
    async (job: Job) => {
      const now = new Date();
      logger.info(`Recurring Tasks Worker [${job.id}]: Scanning for missed rotations...`);

      const missedRotations = await prisma.task.findMany({
        where: {
          status: 'completed',
          rotationSpawnedAt: null,
          isRecurring: true,
        },
        select: {
          id: true,
          houseId: true,
          title: true,
          createdAt: true,
          deadline: true,
          cronSchedule: true,
          rewardPoints: true,
          penaltyFine: true,
          isRecurring: true,
          assignedTo: true,
        },
      });

      let spawned = 0;

      for (const task of missedRotations) {
        try {
          const result = await tasksService.completeAndRotateTask(task.id);
          if (result.rotated) {
            spawned++;
            logger.info(
              {
                completedTaskId: task.id,
                newTaskId: result.newTaskId,
                assignedTo: result.assignedTo,
                assigneeName: result.assigneeName,
                title: task.title,
              },
              'Recurring worker: rotated chore to next assignee',
            );
          } else if (result.skipped) {
            logger.debug(
              { taskId: task.id, reason: result.reason },
              'Recurring worker: rotation skipped',
            );
          } else {
            logger.warn(
              { taskId: task.id, reason: result.reason },
              'Recurring worker: rotation did not spawn a new task',
            );
          }
        } catch (err) {
          logger.error({ err, taskId: task.id }, 'Recurring worker: failed to rotate chore');
        }
      }

      logger.info(
        `Recurring Tasks Worker [${job.id}]: Sweep complete. Spawned ${spawned} task(s).`,
      );
      return { evaluated: missedRotations.length, spawned };
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
}

export async function closeRecurringTasksWorker(): Promise<void> {
  if (recurringTasksWorker) {
    await recurringTasksWorker.close();
    recurringTasksWorker = null;
  }
}
