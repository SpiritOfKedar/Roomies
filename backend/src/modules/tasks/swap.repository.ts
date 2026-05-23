/**
 * =============================================================================
 * Task Swap Repository — Database Access Layer
 * =============================================================================
 * Isolates all Prisma queries for the `task_swaps` table.
 * No business logic — pure data access.
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';
import { Prisma } from '@prisma/client';
import { computeReassignmentDeadline } from './tasks.rotation';

// ---- Shared select shape ----

const swapSelect = {
  id: true,
  houseId: true,
  requesterId: true,
  receiverId: true,
  offeredTaskId: true,
  requestedTaskId: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { id: true, name: true } },
  receiver: { select: { id: true, name: true } },
  offeredTask: { select: { id: true, title: true, assignedTo: true, status: true } },
  requestedTask: { select: { id: true, title: true, assignedTo: true, status: true } },
} as const;

export type SwapRecord = Prisma.TaskSwapGetPayload<{ select: typeof swapSelect }>;

// ---- Repository Functions ----

/**
 * Create a new swap proposal.
 */
export async function createSwap(data: {
  houseId: string;
  requesterId: string;
  receiverId: string;
  offeredTaskId: string;
  requestedTaskId: string;
}): Promise<SwapRecord> {
  return prisma.taskSwap.create({
    data: {
      houseId: data.houseId,
      requesterId: data.requesterId,
      receiverId: data.receiverId,
      offeredTaskId: data.offeredTaskId,
      requestedTaskId: data.requestedTaskId,
    },
    select: swapSelect,
  });
}

/**
 * Find a swap by ID including related task details.
 */
export async function findSwapById(swapId: string): Promise<SwapRecord | null> {
  return prisma.taskSwap.findUnique({
    where: { id: swapId },
    select: swapSelect,
  });
}

/**
 * Accept a swap inside a running transaction.
 * Atomically:
 *   1. Updates swap status to 'accepted'
 *   2. Swaps assignedTo on both tasks
 *
 * The caller MUST pass the Prisma transaction client.
 */
export async function acceptSwapInTx(
  tx: Prisma.TransactionClient,
  swapId: string,
  offeredTaskId: string,
  requestedTaskId: string,
  requesterId: string,
  receiverId: string,
): Promise<SwapRecord> {
  // Re-lock both task rows to prevent concurrent mutation inside the transaction
  await tx.$executeRaw`
    SELECT id FROM tasks
    WHERE id IN (${offeredTaskId}::uuid, ${requestedTaskId}::uuid)
    FOR UPDATE
  `;

  // Guard: both tasks must still be 'pending'
  const tasks = await tx.task.findMany({
    where: { id: { in: [offeredTaskId, requestedTaskId] } },
    select: {
      id: true,
      status: true,
      deadline: true,
      createdAt: true,
      cronSchedule: true,
    },
  });

  const offered = tasks.find((t) => t.id === offeredTaskId);
  const requested = tasks.find((t) => t.id === requestedTaskId);

  for (const task of tasks) {
    if (task.status !== 'pending') {
      throw new Error(`Task ${task.id} is no longer pending (status: ${task.status})`);
    }
  }

  if (!offered || !requested) {
    throw new Error('One or both swap tasks not found');
  }

  const offeredNewDeadline = computeReassignmentDeadline(
    offered.cronSchedule,
    offered.createdAt,
    offered.deadline,
  );
  const requestedNewDeadline = computeReassignmentDeadline(
    requested.cronSchedule,
    requested.createdAt,
    requested.deadline,
  );

  // Swap assignedTo and refresh deadlines for new assignees
  await tx.task.update({
    where: { id: offeredTaskId },
    data: { assignedTo: receiverId, deadline: offeredNewDeadline },
  });
  await tx.task.update({
    where: { id: requestedTaskId },
    data: { assignedTo: requesterId, deadline: requestedNewDeadline },
  });

  // Mark swap accepted
  return tx.taskSwap.update({
    where: { id: swapId },
    data: { status: 'accepted' },
    select: swapSelect,
  });
}

/**
 * Update swap status to 'rejected' or 'canceled'.
 */
export async function updateSwapStatus(
  swapId: string,
  status: 'rejected' | 'canceled',
): Promise<SwapRecord> {
  return prisma.taskSwap.update({
    where: { id: swapId },
    data: { status },
    select: swapSelect,
  });
}

/**
 * List all swaps for a house (paginated).
 */
export async function getSwapsByHouse(
  houseId: string,
  limit: number,
  offset: number,
): Promise<{ swaps: SwapRecord[]; total: number }> {
  const [swaps, total] = await prisma.$transaction([
    prisma.taskSwap.findMany({
      where: { houseId },
      select: swapSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.taskSwap.count({ where: { houseId } }),
  ]);
  return { swaps, total };
}
