import cron from 'node-cron';
import { prisma } from '../db/prisma';
import * as penaltyService from '../../modules/penalty/penalty.service';
import { logger } from '../utils/logger';

/**
 * Task Sweeper Job
 *
 * Runs periodically to find and penalize expired tasks.
 * Scheduled to run every hour. Uses transaction to ensure
 * changes are committed at once per chunk.
 */
export function startTaskSweeper() {
  logger.info('Starting Task Sweeper background job (runs every hour)');

  // Run every hour: "0 * * * *"
  // For testing/development you can use a faster schedule like "*/5 * * * *" (every 5 mins)
  cron.schedule('0 * * * *', async () => {
    logger.info('Task Sweeper: Checking for expired tasks...');

    try {
      const expiredTasks = await prisma.task.findMany({
        where: {
          deadline: { lt: new Date() }, // Past deadline
          status: { in: ['pending', 'submitted'] }, // Still pending or somehow just submitted without approval
        },
      });

      if (expiredTasks.length === 0) {
        logger.debug('Task Sweeper: No expired tasks found.');
        return;
      }

      logger.info(
        `Task Sweeper: Found ${expiredTasks.length} expired tasks. Applying penalties...`,
      );

      // One small transaction per task — avoids a single giant tx timing out on Neon
      // and ensures a failure on one task never rolls back the others.
      for (const task of expiredTasks) {
        await prisma.$transaction(async (tx: Parameters<typeof penaltyService.applyPenalty>[0]) => {
          await tx.task.update({
            where: { id: task.id },
            data: { status: 'expired' },
          });

          await penaltyService.applyPenalty(
            tx,
            task.assignedTo,
            task.id,
            'Task deadline expired without completion',
            task.rewardPoints,
            Number(task.penaltyFine),
          );
        });
      }

      logger.info(`Task Sweeper: Successfully processed ${expiredTasks.length} expired tasks.`);
    } catch (error) {
      logger.error({ error }, 'Task Sweeper: Failed to process expired tasks');
    }
  });
}
