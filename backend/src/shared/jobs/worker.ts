import { Worker, Job } from 'bullmq';
import { prisma } from '../db/prisma';
import * as penaltyService from '../../modules/penalty/penalty.service';
import { logger } from '../utils/logger';
import { redisConnection } from './queue';
import { reconcileSubmittedTasks } from '../../modules/voting/voting.service';
import { completeAndRotateTask } from '../../modules/tasks/tasks.service';
import { invalidateHouseCache } from '../cache/redis-cache';

let taskSweeperWorker: Worker | null = null;

/**
 * Statuses that expire at the deadline:
 *   - pending:  never submitted.
 *   - disputed: proof rejected and not resubmitted in time. (Disputes always
 *               leave at least DISPUTE_GRACE_MS to resubmit — see voting.finalize.)
 * 'submitted' is deliberately excluded: the assignee did their part and is
 * waiting on roommates' votes, so they are not penalised for that delay.
 */
const EXPIRABLE_STATUSES = ['pending', 'disputed'];

/**
 * Expire overdue tasks, penalise the assignee with the task's own points/fine,
 * and rotate recurring chores on to their next cycle.
 */
export async function sweepExpiredTasks(): Promise<{ expired: number; rotated: number }> {
  const overdue = await prisma.task.findMany({
    where: { deadline: { lt: new Date() }, status: { in: EXPIRABLE_STATUSES } },
    select: {
      id: true,
      houseId: true,
      assignedTo: true,
      status: true,
      rewardPoints: true,
      penaltyFine: true,
    },
  });

  let expired = 0;
  let rotated = 0;
  const touchedHouses = new Set<string>();

  // One small transaction per task — avoids a single giant tx timing out on Neon
  // and ensures a failure on one task never rolls back the others.
  for (const task of overdue) {
    try {
      const didExpire = await prisma.$transaction(
        async (tx: Parameters<typeof penaltyService.applyPenalty>[0]) => {
          // Conditional on the status we read, so a concurrent submit/vote wins.
          const updateResult = await tx.task.updateMany({
            where: { id: task.id, status: task.status },
            data: { status: 'expired', currentSubmissionId: null },
          });
          if (updateResult.count === 0) return false;

          await penaltyService.applyPenalty(
            tx,
            task.assignedTo,
            task.id,
            task.status === 'disputed'
              ? 'Disputed task was not resubmitted before the deadline'
              : 'Task deadline expired without completion',
            task.rewardPoints,
            Number(task.penaltyFine),
          );
          return true;
        },
      );
      if (!didExpire) continue;

      expired++;
      touchedHouses.add(task.houseId);

      // Recurring chores move on to the next cycle; one-off chores are marked done.
      const rotation = await completeAndRotateTask(task.id);
      if (rotation.rotated) rotated++;
    } catch (err) {
      logger.error({ err, taskId: task.id }, 'Task Sweeper: failed to expire task');
    }
  }

  for (const houseId of touchedHouses) {
    await invalidateHouseCache(houseId);
  }

  return { expired, rotated };
}

export function startTaskSweeperWorker() {
  logger.info('Initializing BullMQ Task Sweeper Worker');

  taskSweeperWorker = new Worker(
    'task-sweeper-queue',
    async (job: Job) => {
      logger.info(`Task Sweeper [${job.id}]: Checking for expired tasks...`);

      // Finalize submissions whose vote threshold was met by a membership change.
      const reconciled = await reconcileSubmittedTasks().catch((err) => {
        logger.error({ err }, `Task Sweeper [${job.id}]: vote reconciliation failed`);
        return 0;
      });
      if (reconciled > 0) {
        logger.info(`Task Sweeper [${job.id}]: Reconciled ${reconciled} stuck submission(s).`);
      }

      const result = await sweepExpiredTasks();
      logger.info(
        `Task Sweeper [${job.id}]: expired ${result.expired} task(s), rotated ${result.rotated} recurring chore(s).`,
      );
      return result;
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
