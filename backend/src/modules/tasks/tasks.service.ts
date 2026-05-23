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
import * as submissionsRepo from './task-submissions.repository';
import * as houseService from '../house/house.service';
import { logger } from '../../shared/utils/logger';
import { env } from '../../shared/utils/env';
import type { UpdateTaskInput } from './tasks.schema';

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
  explicitAssignedTo?: string,
  explicitWeight?: number,
  isRecurring?: boolean,
  cronSchedule?: string,
) {
  // Pre-check: Verify the requesting user is an active member
  await houseService.verifyMembership(houseId, requestingUserId);

  // Validate deadline is in the future
  const deadline = new Date(deadlineStr);
  if (deadline <= new Date()) {
    throw new AppError('Deadline must be in the future', 400);
  }

  // Admin check if explicitly assigning to someone else
  if (explicitAssignedTo && explicitAssignedTo !== requestingUserId) {
    await houseService.verifyAdminRole(houseId, requestingUserId);
  }

  const rewardPoints = explicitWeight ? explicitWeight * 10 : undefined;
  const penaltyFine = explicitWeight ? explicitWeight * 5 : undefined;

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
    let assignedMemberId: string;
    let assignedMemberName: string;
    let nextIndex = currentIndex; // default to no increment

    if (explicitAssignedTo) {
      const member = activeMembers.find((m) => m.userId === explicitAssignedTo);
      if (!member) {
        throw new AppError('Cannot assign task: designated user is not an active member', 400);
      }
      assignedMemberId = member.userId;
      assignedMemberName = member.user.name;
    } else {
      const workloadStats = await tasksRepo.getMemberWorkloadStats(tx, houseId);
      const maxOpen = env.TASK_MAX_OPEN_PER_USER;

      const candidates = workloadStats.map((stat, index) => {
        const excluded = stat.openTasks >= maxOpen;
        const score = stat.openTasks * 10 - stat.daysSinceLastAssignment;
        return {
          userId: stat.userId,
          name: stat.name,
          index,
          openTasks: stat.openTasks,
          daysSinceLastAssignment: Math.round(stat.daysSinceLastAssignment * 10) / 10,
          score: Math.round(score * 100) / 100,
          excluded,
          exclusionReason:
            excluded ? `openTasks (${stat.openTasks}) >= max (${maxOpen})` : null,
        };
      });

      const eligible = candidates.filter((c) => !c.excluded);
      if (eligible.length === 0) {
        throw new AppError(
          'Cannot assign task: all active members are at their open-task limit',
          400,
        );
      }

      eligible.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        const rotationOrderA =
          (a.index - (currentIndex % activeMembers.length) + activeMembers.length) %
          activeMembers.length;
        const rotationOrderB =
          (b.index - (currentIndex % activeMembers.length) + activeMembers.length) %
          activeMembers.length;
        return rotationOrderA - rotationOrderB;
      });

      const selected = eligible[0];
      assignedMemberId = selected.userId;
      assignedMemberName = selected.name;
      nextIndex = (selected.index + 1) % activeMembers.length;

      logger.info(
        {
          event: 'rotation_decision',
          houseId,
          currentIndex,
          maxOpenPerUser: maxOpen,
          candidates,
          selected: {
            userId: selected.userId,
            name: selected.name,
            reason: `lowest score (${selected.score}) with ${selected.openTasks} open task(s), ${selected.daysSinceLastAssignment} days since last assignment`,
          },
        },
        'Rotation engine: fair assignment decision',
      );
    }

    if (explicitAssignedTo) {
      logger.info(
        {
          houseId,
          assignedTo: assignedMemberId,
          assignedName: assignedMemberName,
          mode: 'explicit',
        },
        'Rotation engine: explicit assignment (index not advanced)',
      );
    }

    // Step 4: Create the task
    const createdTask = await tasksRepo.createTaskInTx(tx, {
      houseId,
      assignedTo: assignedMemberId,
      title,
      deadline,
      rewardPoints,
      penaltyFine,
      isRecurring,
      cronSchedule,
    });

    if (nextIndex !== currentIndex) {
      await tasksRepo.updateHouseIndexInTx(tx, houseId, nextIndex);
    }

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
export async function submitTask(
  userId: string,
  taskId: string,
  imageUrl?: string,
  clarification?: string,
) {
  const task = await tasksRepo.findTaskById(taskId);
  if (!task) {
    throw NotFoundError('Task');
  }

  if (task.assignedTo !== userId) {
    throw ForbiddenError('Only the assigned user can submit this task');
  }

  const isResubmit = task.status === 'disputed';
  const allowedStatuses = ['pending', 'disputed'];

  if (!allowedStatuses.includes(task.status)) {
    throw new AppError(
      `Cannot submit task: current status is '${task.status}' (must be pending or disputed)`,
      400,
    );
  }

  if (new Date(task.deadline) < new Date()) {
    throw new AppError('Cannot submit task: deadline has passed', 400);
  }

  const activeMembersCount = await prisma.houseMember.count({
    where: { houseId: task.houseId, status: 'active' },
  });

  const isSoloHouse = activeMembersCount <= 1;
  const maxAttempts = env.TASK_MAX_RESUBMISSIONS;

  const latestSubmission = await submissionsRepo.getLatestSubmission(taskId);
  const nextAttemptNumber = (latestSubmission?.attemptNumber ?? 0) + 1;

  if (nextAttemptNumber > maxAttempts) {
    throw new AppError(
      `Maximum resubmission attempts (${maxAttempts}) reached for this task`,
      400,
    );
  }

  if (isResubmit && !clarification?.trim()) {
    throw new AppError('Clarification is required when resubmitting after a dispute', 400);
  }

  const newStatus = isSoloHouse ? 'completed' : 'submitted';

  const updatedTask = await prisma.$transaction(async (tx) => {
    const statusCondition = isResubmit ? ['disputed'] : ['pending'];

    const updateResult = await tx.task.updateMany({
      where: { id: taskId, status: { in: statusCondition } },
      data: {
        status: newStatus,
        imageUrl: imageUrl ?? task.imageUrl,
        ...(isResubmit && { resubmissionCount: { increment: 1 } }),
      },
    });

    if (updateResult.count === 0) {
      return null;
    }

    const submission = await tx.taskSubmission.create({
      data: {
        taskId,
        attemptNumber: nextAttemptNumber,
        imageUrl,
        clarification: clarification?.trim() || null,
      },
    });

    await tx.task.update({
      where: { id: taskId },
      data: {
        currentSubmissionId: isSoloHouse ? null : submission.id,
      },
    });

    return tasksRepo.findTaskById(taskId);
  });

  if (!updatedTask) {
    throw new AppError('Task state was modified concurrently. Please try again.', 409);
  }

  logger.info(
    {
      taskId,
      userId,
      attemptNumber: nextAttemptNumber,
      isResubmit,
      newStatus,
    },
    `Task submitted (Solo House: ${isSoloHouse})`,
  );

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

/**
 * Get a single task with submission and vote context.
 */
export async function getTaskById(userId: string, taskId: string) {
  const task = await tasksRepo.findTaskById(taskId);
  if (!task) throw NotFoundError('Task');

  await houseService.verifyMembership(task.houseId, userId);

  return {
    ...task,
    maxResubmissions: env.TASK_MAX_RESUBMISSIONS,
    attemptsRemaining: Math.max(
      0,
      env.TASK_MAX_RESUBMISSIONS - (task.currentSubmission?.attemptNumber ?? 0),
    ),
  };
}

/**
 * Get submission and voting history for a task.
 */
export async function getTaskHistory(userId: string, taskId: string) {
  const task = await tasksRepo.findTaskById(taskId);
  if (!task) throw NotFoundError('Task');

  await houseService.verifyMembership(task.houseId, userId);

  const submissions = await submissionsRepo.getSubmissionsWithVotes(taskId);

  const rounds = submissions.map((sub) => {
    const approved = sub.votes.filter((v) => v.vote === 'approve').length;
    const rejected = sub.votes.filter((v) => v.vote === 'reject').length;
    const isCurrent = sub.id === task.currentSubmissionId;

    let outcome: string | null = null;
    if (!isCurrent) {
      if (approved > rejected) outcome = 'approved';
      else if (rejected > approved) outcome = 'disputed';
      else if (sub.votes.length > 0) outcome = 'tie';
    } else if (task.status === 'completed') {
      outcome = 'approved';
    } else if (task.status === 'disputed') {
      outcome = 'disputed';
    } else if (task.status === 'rejected') {
      outcome = 'rejected';
    } else if (task.status === 'submitted') {
      outcome = 'voting';
    }

    return {
      submissionId: sub.id,
      attemptNumber: sub.attemptNumber,
      imageUrl: sub.imageUrl,
      clarification: sub.clarification,
      submittedAt: sub.createdAt,
      isCurrent,
      outcome,
      votes: sub.votes.map((v) => ({
        userId: v.userId,
        userName: v.user.name,
        vote: v.vote,
        reason: v.reason,
        createdAt: v.createdAt,
      })),
      tallies: { approved, rejected },
    };
  });

  return {
    taskId,
    title: task.title,
    status: task.status,
    resubmissionCount: task.resubmissionCount,
    maxResubmissions: env.TASK_MAX_RESUBMISSIONS,
    rounds,
  };
}

/**
 * Admin mutation of a pending task.
 *
 * Guards:
 *   - Requesting user must be an active house admin.
 *   - Task must exist and belong to the given house.
 *   - Task must be in 'pending' state (completed/rejected tasks are immutable).
 *   - If deadline is being updated, it must be in the future.
 *
 * @param requestingUserId - The admin user's UUID
 * @param houseId          - The house UUID (ownership scope)
 * @param taskId           - The task UUID to update
 * @param data             - Partial update object
 * @returns The updated task record
 *
 * @throws ForbiddenError   if requester is not an admin
 * @throws NotFoundError    if task doesn't exist or is in a different house
 * @throws AppError(400)    if task is not in 'pending' status
 * @throws AppError(400)    if the provided deadline is in the past
 */
export async function updateTask(
  requestingUserId: string,
  houseId: string,
  taskId: string,
  data: UpdateTaskInput,
) {
  // 1. Admin-only guard
  await houseService.verifyAdminRole(houseId, requestingUserId);

  // 2. Task existence + house ownership check
  const task = await tasksRepo.findTaskById(taskId);
  if (!task || task.houseId !== houseId) {
    throw NotFoundError('Task');
  }

  // 3. Immutability guard — only 'pending' tasks are mutable
  if (task.status !== 'pending') {
    throw new AppError(
      `Cannot modify task in state '${task.status}'. Only 'pending' tasks are mutable.`,
      400,
    );
  }

  // 4. Deadline validation (if being updated)
  let deadline: Date | undefined;
  if (data.deadline) {
    deadline = new Date(data.deadline);
    if (deadline <= new Date()) {
      throw new AppError('New deadline must be in the future', 400);
    }
  }

  // 5. Apply update
  const updated = await tasksRepo.updateTaskFields(taskId, {
    ...(data.title !== undefined && { title: data.title }),
    ...(deadline !== undefined && { deadline }),
    ...(data.rewardPoints !== undefined && { rewardPoints: data.rewardPoints }),
    ...(data.penaltyFine !== undefined && { penaltyFine: data.penaltyFine }),
  });

  logger.info({ taskId, houseId, requestingUserId, changes: data }, 'Admin mutated pending task');

  return updated;
}
