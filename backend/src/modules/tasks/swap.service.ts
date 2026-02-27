/**
 * =============================================================================
 * Task Swap Service — Business Logic
 * =============================================================================
 * Implements the peer-to-peer chore marketplace state machine.
 *
 * State transitions:
 *   pending → accepted  (receiver accepts)
 *   pending → rejected  (receiver rejects)
 *   pending → canceled  (requester cancels — future endpoint)
 *
 * CRITICAL: task assignment swaps execute inside a Prisma transaction
 * with row-level locking to prevent race conditions.
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../shared/utils/app-error';
import * as swapRepo from './swap.repository';
import * as houseService from '../house/house.service';
import { logger } from '../../shared/utils/logger';

// ---- Service Functions ----

/**
 * Propose a chore swap between two house members.
 *
 * Guards:
 *   - Both tasks must belong to the given house.
 *   - Both tasks must be in 'pending' status.
 *   - requesterId must own offeredTaskId (assignedTo === requesterId).
 *   - receiverId must own requestedTaskId (assignedTo === receiverId).
 *   - requester must be an active member of the house.
 *   - requester and receiver must be different users.
 *   - offeredTaskId and requestedTaskId must be different tasks.
 *
 * @param requesterId     - User proposing the swap
 * @param houseId         - House scope
 * @param receiverId      - User receiving the swap proposal
 * @param offeredTaskId   - The task the requester is willing to give away
 * @param requestedTaskId - The task the requester wants in exchange
 * @returns The created TaskSwap record
 */
export async function proposeSwap(
  requesterId: string,
  houseId: string,
  receiverId: string,
  offeredTaskId: string,
  requestedTaskId: string,
) {
  // 1. Validate unique IDs
  if (requesterId === receiverId) {
    throw new AppError('Cannot propose a swap with yourself', 400);
  }
  if (offeredTaskId === requestedTaskId) {
    throw new AppError('offeredTaskId and requestedTaskId must be different tasks', 400);
  }

  // 2. Verify requester is an active house member
  await houseService.verifyMembership(houseId, requesterId);

  // 3. Fetch both tasks in a single query
  const tasks = await prisma.task.findMany({
    where: { id: { in: [offeredTaskId, requestedTaskId] } },
    select: { id: true, houseId: true, assignedTo: true, status: true, title: true },
  });

  const offeredTask = tasks.find((t) => t.id === offeredTaskId);
  const requestedTask = tasks.find((t) => t.id === requestedTaskId);

  if (!offeredTask) throw NotFoundError('Offered task');
  if (!requestedTask) throw NotFoundError('Requested task');

  // 4. Both tasks must belong to this house
  if (offeredTask.houseId !== houseId) {
    throw new AppError('Offered task does not belong to this house', 400);
  }
  if (requestedTask.houseId !== houseId) {
    throw new AppError('Requested task does not belong to this house', 400);
  }

  // 5. Both tasks must be 'pending'
  if (offeredTask.status !== 'pending') {
    throw new AppError(
      `Offered task is not swappable: current status is '${offeredTask.status}'`,
      400,
    );
  }
  if (requestedTask.status !== 'pending') {
    throw new AppError(
      `Requested task is not swappable: current status is '${requestedTask.status}'`,
      400,
    );
  }

  // 6. Ownership checks
  if (offeredTask.assignedTo !== requesterId) {
    throw ForbiddenError('You can only offer tasks that are assigned to you');
  }
  if (requestedTask.assignedTo !== receiverId) {
    throw new AppError('The requested task is not assigned to the specified receiver', 400);
  }

  // 7. Create the swap proposal
  const swap = await swapRepo.createSwap({
    houseId,
    requesterId,
    receiverId,
    offeredTaskId,
    requestedTaskId,
  });

  logger.info(
    {
      swapId: swap.id,
      houseId,
      requesterId,
      receiverId,
      offeredTaskId,
      requestedTaskId,
    },
    'Swap proposed',
  );

  return swap;
}

/**
 * Resolve a swap proposal (accept or reject).
 *
 * Only the designated receiver may call this function.
 *
 * accept: Opens a Prisma transaction that atomically:
 *   - Locks both task rows (SELECT FOR UPDATE)
 *   - Re-validates both tasks are still 'pending'
 *   - Swaps their assignedTo fields
 *   - Updates swap status to 'accepted'
 *
 * reject: Updates swap status to 'rejected' (no task mutations).
 *
 * @param receiverId - The user accepting or rejecting (must match swap.receiverId)
 * @param houseId    - House scope (used to verify swap belongs to this house)
 * @param swapId     - The swap UUID to resolve
 * @param action     - 'accept' | 'reject'
 * @returns The updated TaskSwap record
 */
export async function resolveSwap(
  receiverId: string,
  houseId: string,
  swapId: string,
  action: 'accept' | 'reject',
) {
  // 1. Fetch the swap
  const swap = await swapRepo.findSwapById(swapId);

  if (!swap) throw NotFoundError('Swap');

  // 2. Verify it belongs to this house
  if (swap.houseId !== houseId) {
    throw NotFoundError('Swap');
  }

  // 3. Only the receiver may resolve
  if (swap.receiverId !== receiverId) {
    throw ForbiddenError('Only the swap receiver can resolve this request');
  }

  // 4. Only pending swaps can be resolved
  if (swap.status !== 'pending') {
    throw ConflictError(`Swap has already been resolved (current status: '${swap.status}')`);
  }

  // 5. Execute the action
  if (action === 'reject') {
    const updated = await swapRepo.updateSwapStatus(swapId, 'rejected');

    logger.info({ swapId, receiverId }, 'Swap rejected');

    return updated;
  }

  // action === 'accept' — run inside a transaction with row-level locking
  try {
    const updated = await prisma.$transaction(async (tx) => {
      return swapRepo.acceptSwapInTx(
        tx,
        swapId,
        swap.offeredTaskId,
        swap.requestedTaskId,
        swap.requesterId,
        swap.receiverId,
      );
    });

    logger.info(
      {
        swapId,
        receiverId,
        offeredTaskId: swap.offeredTaskId,
        requestedTaskId: swap.requestedTaskId,
      },
      'Swap accepted — tasks reassigned',
    );

    return updated;
  } catch (err) {
    // Re-throw with a clean 409 if a task is no longer pending (race condition)
    if (err instanceof Error && err.message.includes('no longer pending')) {
      throw ConflictError(err.message);
    }
    throw err;
  }
}
