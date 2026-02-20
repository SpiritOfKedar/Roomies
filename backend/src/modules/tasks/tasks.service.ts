/**
 * =============================================================================
 * Tasks Service — Business Logic + Rotation Engine
 * =============================================================================
 * The core fairness engine of the application.
 *
 * CRITICAL — Task Rotation Engine (assignNextTask):
 *   Uses PostgreSQL row-level locking (SELECT FOR UPDATE) inside a
 *   Prisma interactive transaction to prevent race conditions.
 *
 *   Concurrency scenario:
 *     Two users trigger /assign at the exact same time for the same house.
 *     Without locking, both would read the same current_index, assign
 *     to the same user, and increment to the same next_index.
 *     WITH SELECT FOR UPDATE, the second transaction blocks until
 *     the first commits, then reads the updated index.
 *
 *   Algorithm:
 *     1. Lock house row (SELECT FOR UPDATE)
 *     2. Fetch active members sorted by joined_at ASC
 *     3. Select member at index = current_index % total_active
 *     4. Skip inactive users (already filtered by query)
 *     5. Create task assigned to that member
 *     6. Update index = (current_index + 1) % total_active
 *     7. Commit
 *
 *   Transaction isolation: The default READ COMMITTED + row-level lock
 *   is sufficient here because we only need to serialize writes to
 *   the same house row. Different houses are fully concurrent.
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';

import { AppError, NotFoundError, ForbiddenError } from '../../shared/utils/app-error';
import * as tasksRepo from './tasks.repository';
import * as houseService from '../house/house.service';
import { logger } from '../../shared/utils/logger';

// ---- Service Functions ----

/**
 * ============================================================================
 * ROTATION ENGINE — Assign the next task using round-robin rotation.
 * ============================================================================
 *
 * This is the most critical function in the application. It MUST be
 * atomic and race-condition-free.
 *
 * @param requestingUserId - The user triggering the assignment (must be a house member)
 * @param houseId - The house UUID
 * @param title - The task title
 * @param deadlineStr - ISO 8601 deadline string
 * @returns The created task with assignee details
 *
 * @throws ForbiddenError - If the requesting user is not an active house member
 * @throws AppError(400) - If the house has no active members
 * @throws NotFoundError - If the house doesn't exist
 */
export async function assignNextTask(
  requestingUserId: string,
  houseId: string,
  title: string,
  deadlineStr: string,
) {
  // Pre-check: Verify the requesting user is an active member
  await houseService.verifyMembership(houseId, requestingUserId);

  // Validate deadline is in the future
  const deadline = new Date(deadlineStr);
  if (deadline <= new Date()) {
    throw new AppError('Deadline must be in the future', 400);
  }

  // ---- BEGIN CRITICAL SECTION ----
  // Interactive transaction with row-level locking
  const task = await prisma.$transaction(async (tx) => {
    // Step 1: Lock the house row to prevent concurrent index reads
    // This is the key concurrency control mechanism.
    // Any concurrent transaction attempting to lock the same row will BLOCK
    // here until this transaction commits or rolls back.
    const lockedRows = await tasksRepo.lockHouseForUpdate(tx, houseId);

    if (lockedRows.length === 0) {
      throw NotFoundError('House');
    }

    const currentIndex = lockedRows[0].current_index;

    // Step 2: Fetch all active members in deterministic order
    // ORDER BY joined_at ASC ensures the rotation sequence is consistent
    const activeMembers = await tasksRepo.getActiveMembersInTx(tx, houseId);

    if (activeMembers.length === 0) {
      throw new AppError('Cannot assign task: no active members in house', 400);
    }

    // Step 3: Calculate which member gets this task
    // The modulo handles wrap-around when members leave/join
    const effectiveIndex = currentIndex % activeMembers.length;
    const assignedMember = activeMembers[effectiveIndex];

    logger.info(
      {
        houseId,
        currentIndex,
        effectiveIndex,
        totalActive: activeMembers.length,
        assignedTo: assignedMember.userId,
        assignedName: assignedMember.user.name,
      },
      'Rotation engine: assigning task',
    );

    // Step 4: Create the task
    const createdTask = await tasksRepo.createTaskInTx(tx, {
      houseId,
      assignedTo: assignedMember.userId,
      title,
      deadline,
    });

    // Step 5: Advance the rotation index
    const nextIndex = (currentIndex + 1) % activeMembers.length;
    await tasksRepo.updateHouseIndexInTx(tx, houseId, nextIndex);

    logger.info(
      { houseId, oldIndex: currentIndex, newIndex: nextIndex, taskId: createdTask.id },
      'Rotation engine: index updated',
    );

    return createdTask;
  });
  // ---- END CRITICAL SECTION ----

  return task;
}

/**
 * Submit proof for a task (change status to 'submitted').
 *
 * Guards:
 *   - Task must exist.
 *   - Only the assigned user can submit.
 *   - Task must be in 'pending' status.
 *   - Task must not be past its deadline.
 *
 * @param userId - The submitting user's UUID
 * @param taskId - The task UUID
 * @param imageUrl - Optional proof image URL
 * @returns The updated task
 */
export async function submitTask(userId: string, taskId: string, imageUrl?: string) {
  // 1. Fetch task
  const task = await tasksRepo.findTaskById(taskId);
  if (!task) {
    throw NotFoundError('Task');
  }

  // 2. Verify the submitting user is the assigned user
  if (task.assignedTo !== userId) {
    throw ForbiddenError('Only the assigned user can submit this task');
  }

  // 3. Verify task is in 'pending' status
  if (task.status !== 'pending') {
    throw new AppError(
      `Cannot submit task: current status is '${task.status}' (must be 'pending')`,
      400,
    );
  }

  // 4. Check deadline hasn't passed
  if (new Date(task.deadline) < new Date()) {
    throw new AppError('Cannot submit task: deadline has passed', 400);
  }

  // 5. Update status
  const updatedTask = await tasksRepo.updateTaskStatus(taskId, 'submitted', imageUrl);

  logger.info({ taskId, userId }, 'Task submitted');

  return updatedTask;
}

/**
 * Get paginated tasks for a house.
 * Verifies the requesting user is a member.
 *
 * @param userId - The requesting user's UUID
 * @param houseId - The house UUID
 * @param limit - Page size
 * @param offset - Number of records to skip
 * @returns Paginated task list with total count
 */
export async function getTasksByHouse(
  userId: string,
  houseId: string,
  limit: number,
  offset: number,
) {
  // Verify membership before returning tasks
  await houseService.verifyMembership(houseId, userId);

  const { tasks, total } = await tasksRepo.getTasksByHouse(houseId, limit, offset);

  return { tasks, total, limit, offset };
}
