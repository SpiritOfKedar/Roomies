/**
 * =============================================================================
 * Tasks Repository — Database Access Layer
 * =============================================================================
 * Isolates all Prisma queries for the `tasks` table.
 *
 * CRITICAL: The rotation-related queries (lock house row, fetch active members,
 * create task, update index) accept a Prisma TransactionClient to ensure
 * they run inside the same serializable transaction.
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';
import { PrismaClient } from '@prisma/client';

/**
 * Transaction client type — matches the client interface available
 * inside Prisma's interactive transactions.
 */
type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ---- Types ----

export interface LockedHouseRow {
  id: string;
  current_index: number;
}

export interface ActiveMemberRow {
  id: string;
  userId: string;
  joinedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

// ---- Rotation Transaction Queries ----
// These methods accept a `tx` client to run inside an interactive transaction.

/**
 * Lock the house row using SELECT FOR UPDATE.
 * This prevents concurrent task assignments from reading stale `current_index`.
 *
 * MUST be called inside a Prisma interactive transaction.
 *
 * @param tx - The Prisma transaction client
 * @param houseId - The house UUID to lock
 * @returns The locked house row with current_index
 */
export async function lockHouseForUpdate(tx: TxClient, houseId: string): Promise<LockedHouseRow[]> {
  return tx.$queryRaw<LockedHouseRow[]>`
    SELECT id, current_index
    FROM houses
    WHERE id = ${houseId}::uuid
    FOR UPDATE
  `;
}

/**
 * Fetch all active members of a house ordered by joined_at ASC.
 * Called inside the rotation transaction to get the deterministic member list.
 *
 * @param tx - The Prisma transaction client
 * @param houseId - The house UUID
 * @returns Ordered list of active members
 */
export async function getActiveMembersInTx(
  tx: TxClient,
  houseId: string,
): Promise<ActiveMemberRow[]> {
  return tx.houseMember.findMany({
    where: {
      houseId,
      status: 'active',
    },
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true,
      userId: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Create a task record inside the rotation transaction.
 *
 * @param tx - The Prisma transaction client
 * @param data - Task creation data
 * @returns The created task with assignee details
 */
export async function createTaskInTx(
  tx: TxClient,
  data: {
    houseId: string;
    assignedTo: string;
    title: string;
    deadline: Date;
  },
) {
  return tx.task.create({
    data: {
      houseId: data.houseId,
      assignedTo: data.assignedTo,
      title: data.title,
      status: 'pending',
      deadline: data.deadline,
    },
    select: {
      id: true,
      houseId: true,
      assignedTo: true,
      title: true,
      status: true,
      deadline: true,
      createdAt: true,
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Update the house's current_index inside the rotation transaction.
 *
 * @param tx - The Prisma transaction client
 * @param houseId - The house UUID
 * @param newIndex - The next rotation index
 */
export async function updateHouseIndexInTx(
  tx: TxClient,
  houseId: string,
  newIndex: number,
): Promise<void> {
  await tx.house.update({
    where: { id: houseId },
    data: { currentIndex: newIndex },
  });
}

// ---- Standard Queries (outside transactions) ----

/**
 * Find a task by its UUID.
 *
 * @param taskId - The task UUID
 * @returns Task with assignee and house info, or null
 */
export async function findTaskById(taskId: string) {
  return prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      houseId: true,
      assignedTo: true,
      title: true,
      status: true,
      deadline: true,
      createdAt: true,
      imageUrl: true,
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Update a task's status atomically.
 * Ensures the status has not changed concurrently.
 *
 * @param taskId - The task UUID
 * @param newStatus - New status value
 * @param expectedStatus - The status value that must currently be present
 * @param imageUrl - Optional image URL (for proof submission)
 * @returns Updated task record, or null if the conditional update fails
 */
export async function updateTaskStatusAtomic(
  taskId: string,
  newStatus: string,
  expectedStatus: string,
  imageUrl?: string,
) {
  const result = await prisma.task.updateMany({
    where: { id: taskId, status: expectedStatus },
    data: {
      status: newStatus,
      ...(imageUrl && { imageUrl }),
    },
  });

  if (result.count === 0) return null;

  return findTaskById(taskId);
}

/**
 * Get paginated tasks for a house, newest first.
 *
 * @param houseId - The house UUID
 * @param limit - Number of tasks to return
 * @param offset - Number of tasks to skip
 * @returns Object with tasks array and total count
 */
export async function getTasksByHouse(
  houseId: string,
  limit: number,
  offset: number,
): Promise<{
  tasks: ReturnType<typeof findTaskById> extends Promise<infer T> ? NonNullable<T>[] : never;
  total: number;
}> {
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where: { houseId },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        houseId: true,
        assignedTo: true,
        title: true,
        status: true,
        deadline: true,
        createdAt: true,
        imageUrl: true,
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.task.count({ where: { houseId } }),
  ]);

  return { tasks, total };
}
// ---- Admin Mutation ----

export interface UpdateTaskFieldsData {
  title?: string;
  deadline?: Date;
  rewardPoints?: number;
  penaltyFine?: number;
}

/**
 * Update mutable fields of a pending task.
 * Only called after the admin + 'pending' status guards pass in the service.
 *
 * @param taskId - The task UUID
 * @param data   - Partial update object (only provided fields are changed)
 * @returns The updated task record
 */
export async function updateTaskFields(taskId: string, data: UpdateTaskFieldsData) {
  return prisma.task.update({
    where: { id: taskId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.deadline !== undefined && { deadline: data.deadline }),
      ...(data.rewardPoints !== undefined && { rewardPoints: data.rewardPoints }),
      ...(data.penaltyFine !== undefined && { penaltyFine: data.penaltyFine }),
    },
    select: {
      id: true,
      houseId: true,
      assignedTo: true,
      title: true,
      status: true,
      deadline: true,
      rewardPoints: true,
      penaltyFine: true,
      createdAt: true,
      imageUrl: true,
      assignee: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}