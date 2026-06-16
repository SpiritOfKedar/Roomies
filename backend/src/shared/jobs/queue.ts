import { Queue } from 'bullmq';
import { getRedis } from '../cache/redis-client';
import { logger } from '../utils/logger';

/**
 * BullMQ requires an underlying ioredis connection (shared with cache layer).
 */
export const redisConnection = getRedis()!;

/**
 * Instantiate the specific queue for orchestrating task sweeps.
 */
export const taskSweeperQueue = new Queue('task-sweeper-queue', {
  // @ts-expect-error: BullMQ and IORedis type definition mismatch
  connection: redisConnection,
});

/**
 * Schedules a repeatable job managed precisely by BullMQ.
 * Eliminates race conditions across multiple server instances via atomic clustering bounds.
 */
export async function scheduleTaskSweeperJob() {
  logger.info('Scheduling BullMQ Task Sweeper background job (runs every hour)');

  // Clear any existing repeatable jobs to avoid duplicates (safeguard)
  const repeatableJobs = await taskSweeperQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await taskSweeperQueue.removeRepeatableByKey(job.key);
  }

  // Add the new repeatable job configuration
  await taskSweeperQueue.add(
    'sweep-expired-tasks',
    {},
    {
      repeat: {
        pattern: '0 * * * *', // Every hour on the hour
      },
      removeOnComplete: true,
      removeOnFail: 100, // Keep last 100 failures for debugging metrics
    },
  );
}

export async function closeQueue() {
  await taskSweeperQueue.close();
}
