import { Worker, Job } from 'bullmq';
import { prisma } from '../db/prisma';
import * as penaltyService from '../../modules/penalty/penalty.service';
import { logger } from '../utils/logger';
import { redisConnection } from './queue';

let taskSweeperWorker: Worker | null = null;

export function startTaskSweeperWorker() {
  logger.info('Initializing BullMQ Task Sweeper Worker');

  taskSweeperWorker = new Worker(
    'task-sweeper-queue',
    async (job: Job) => {
      logger.info(`Task Sweeper [${job.id}]: Checking for expired tasks...`);

      const expiredTasks = await prisma.task.findMany({
        where: {
          deadline: { lt: new Date() }, // Past deadline
          status: 'pending', // Still pending
        },
      });

      if (expiredTasks.length === 0) {
        logger.debug(`Task Sweeper [${job.id}]: No expired tasks found.`);
        return { message: 'No tasks to process' };
      }

      logger.info(
        `Task Sweeper [${job.id}]: Found ${expiredTasks.length} expired tasks. Applying penalties...`,
      );

      // One small transaction per task — avoids a single giant tx timing out on Neon
      // and ensures a failure on one task never rolls back the others.
      let processed = 0;
      for (const task of expiredTasks) {
        await prisma.$transaction(async (tx: Parameters<typeof penaltyService.applyPenalty>[0]) => {
          // Update task status to expired ONLY if it's still 'pending'
          const updateResult = await tx.task.updateMany({
            where: { id: task.id, status: 'pending' },
            data: { status: 'expired' },
          });

          if (updateResult.count > 0) {
            processed++;
            await penaltyService.applyPenalty(
              tx,
              task.assignedTo,
              task.id,
              'Task deadline expired without completion',
              10, // 10 points
              50.0, // $50 fine
            );
          }
        });
      }

      logger.info(
        `Task Sweeper [${job.id}]: Successfully processed ${processed} of ${expiredTasks.length} expired tasks.`,
      );
      return { processed };
    },
    {
      // @ts-expect-error: BullMQ and IORedis type definition mismatch
      connection: redisConnection,
      concurrency: 1, // Prevent racing if single worker handles a massive backlog
    },
  );

  taskSweeperWorker.on('failed', (job, err) => {
    logger.error({ err }, `Task Sweeper Worker: Job ${job?.id} failed`);
  });

  taskSweeperWorker.on('completed', (job, result) => {
    logger.debug({ result }, `Task Sweeper Worker: Job ${job?.id} completed successfully`);
  });
}

/**
 * Shut down the BullMQ worker safely during SIGTERM inside the cluster.
 */
export async function closeWorker() {
  if (taskSweeperWorker) {
    logger.info('Shutting down BullMQ Task Sweeper Worker gracefully...');
    await taskSweeperWorker.close();
  }
}
