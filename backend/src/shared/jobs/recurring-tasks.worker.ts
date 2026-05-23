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
          const result = await tasksService.spawnNextChoreInstance(task.id);
          if (result) spawned++;
        } catch (err) {
          logger.error({ err, taskId: task.id }, 'Failed to process missed rotation');
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
