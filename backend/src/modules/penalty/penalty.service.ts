import { Prisma } from '@prisma/client';
import * as penaltyRepo from './penalty.repository';
import { logger } from '../../shared/utils/logger';
import { AppError, NotFoundError } from '../../shared/utils/app-error';
import * as houseService from '../house/house.service';
import { invalidateHouseCache } from '../../shared/cache/redis-cache';

type TxClient = Prisma.TransactionClient;

/**
 * List all penalties for a house.
 *
 * @param requestingUserId - The user requesting the list (must be a house member)
 * @param houseId          - The house scope
 * @returns Array of penalty records with task and user info
 */
export async function getPenaltiesByHouse(requestingUserId: string, houseId: string) {
  await houseService.verifyMembership(houseId, requestingUserId);

  return penaltyRepo.findPenaltiesByHouse(houseId);
}

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

/**
 * Settle an outstanding penalty.
 * Transitions the penalty status from 'unpaid' → 'settled'.
 *
 * Security: Only a House Admin for the penalty's house may settle it.
 *
 * @param requestingUserId - The admin user triggering the settlement
 * @param houseId          - The house scope (verified against penalty's task)
 * @param penaltyId        - The penalty UUID to settle
 * @returns The updated penalty record
 *
 * @throws NotFoundError   if the penalty does not exist or belongs to a different house
 * @throws ForbiddenError  if the requesting user is not an admin of the house
 * @throws AppError(409)   if the penalty is already settled or forgiven
 */
export async function settlePenalty(requestingUserId: string, houseId: string, penaltyId: string) {
  // 1. Verify the requesting user is an admin of the house
  await houseService.verifyAdminRole(houseId, requestingUserId);

  // 2. Fetch the penalty and validate it belongs to this house
  const existing = await penaltyRepo.findPenaltyById(penaltyId);
  if (!existing || existing.task.houseId !== houseId) {
    throw NotFoundError('Penalty');
  }

  if (existing.status !== 'unpaid') {
    throw new AppError(`Penalty is already '${existing.status}' and cannot be settled again.`, 409);
  }

  // 3. Settle
  const updated = await penaltyRepo.settlePenalty(penaltyId);
  if (!updated) {
    // Race condition: another request settled it between the check and update
    throw new AppError('Penalty was already settled by a concurrent request.', 409);
  }

  logger.info({ penaltyId, houseId, requestingUserId }, 'Penalty settled by admin');

  // Settling removes penalty points from the leaderboard score
  await invalidateHouseCache(houseId);

  return updated;
}
