import { Prisma } from '@prisma/client';
import * as penaltyRepo from './penalty.repository';
import { logger } from '../../shared/utils/logger';

type TxClient = Prisma.TransactionClient;

/**
 * Apply a penalty to a user for failing a task.
 * Called automatically when a task is rejected by peers or expires.
 *
 * @param tx - The Prisma transaction client
 * @param userId - The user receiving the penalty
 * @param taskId - The task that failed
 * @param reason - Reason for the penalty
 * @param points - Points to deduct (default: 10)
 * @param fineAmount - Fine amount in dollars (default: 50.00)
 */
export async function applyPenalty(
  tx: TxClient,
  userId: string,
  taskId: string,
  reason: string,
  points = 10,
  fineAmount = 50.0,
) {
  const penalty = await penaltyRepo.createPenalty(tx, {
    userId,
    taskId,
    points,
    fineAmount,
  });

  logger.info({ userId, taskId, points, fineAmount, reason }, 'Penalty applied');

  return penalty;
}
