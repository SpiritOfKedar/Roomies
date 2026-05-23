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
import { computeNextRotationDeadline } from './tasks.rotation';

export interface RotationAssignOptions {
  excludeUserId?: string;
  choreTitle?: string;
  spawnedFromTaskId?: string;
  rewardPoints?: number;
  penaltyFine?: number;
}

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
  rotationOptions?: RotationAssignOptions,
) {
  await houseService.verifyMembership(houseId, requestingUserId);

  const deadline = new Date(deadlineStr);
  if (deadline <= new Date()) {
    throw new AppError('Deadline must be in the future', 400);
  }

  if (explicitAssignedTo && explicitAssignedTo !== requestingUserId) {
    await houseService.verifyAdminRole(houseId, requestingUserId);
  }

  const rewardPoints =
    rotationOptions?.rewardPoints ??
    (explicitWeight ? explicitWeight * 10 : undefined);
  const penaltyFine =
    rotationOptions?.penaltyFine ??
    (explicitWeight ? explicitWeight * 5 : undefined);

  const task = await prisma.$transaction(async (tx) => {
    return executeAssignmentInTx(tx, {
      houseId,
      title,
      deadline,
      explicitAssignedTo,
      rewardPoints,
      penaltyFine,
      isRecurring,
      cronSchedule,
      rotationOptions,
    });
  });

  return task;
}

interface AssignmentParams {
  houseId: string;
  title: string;
  deadline: Date;
  explicitAssignedTo?: string;
  rewardPoints?: number;
  penaltyFine?: number;
  isRecurring?: boolean;
  cronSchedule?: string;
  rotationOptions?: RotationAssignOptions;
}

async function executeAssignmentInTx(
  tx: Parameters<typeof tasksRepo.lockHouseForUpdate>[0],
  params: AssignmentParams,
) {
  const {
    houseId,
    title,
    deadline,
    explicitAssignedTo,
    rewardPoints,
    penaltyFine,
    isRecurring,
    cronSchedule,
    rotationOptions,
  } = params;

  const lockedRows = await tasksRepo.lockHouseForUpdate(tx, houseId);
  if (lockedRows.length === 0) {
    throw NotFoundError('House');
  }

  const currentIndex = lockedRows[0].current_index;
  const activeMembers = await tasksRepo.getActiveMembersInTx(tx, houseId);

  if (activeMembers.length === 0) {
    throw new AppError('Cannot assign task: no active members in house', 400);
  }

  let assignedMemberId: string;
  let assignedMemberName: string;
  let nextIndex = currentIndex;

  if (explicitAssignedTo) {
    const member = activeMembers.find((m) => m.userId === explicitAssignedTo);
    if (!member) {
      throw new AppError('Cannot assign task: designated user is not an active member', 400);
    }
    assignedMemberId = member.userId;
    assignedMemberName = member.user.name;
  } else {
    const choreTitle = rotationOptions?.choreTitle ?? title;
    const excludeUserId = rotationOptions?.excludeUserId;

    // 2-member house: always assign to the non-completer
    if (activeMembers.length === 2 && excludeUserId) {
      const other = activeMembers.find((m) => m.userId !== excludeUserId);
      if (!other) {
        throw new AppError('Cannot assign task: no other active member for rotation', 400);
      }
      assignedMemberId = other.userId;
      assignedMemberName = other.user.name;
      const otherIndex = activeMembers.findIndex((m) => m.userId === other.userId);
      nextIndex = (otherIndex + 1) % activeMembers.length;

      logger.info(
        {
          event: 'rotation_decision',
          houseId,
          choreTitle,
          excludeUserId,
          mode: 'two_member_switch',
          selected: { userId: other.userId, name: other.user.name },
        },
        'Rotation engine: 2-member hard switch to non-completer',
      );
    } else {
    const choreStats = await tasksRepo.getChoreRotationStats(tx, houseId, choreTitle);
    const maxOpen = env.TASK_MAX_OPEN_PER_USER;

    const candidates = choreStats.map((stat) => {
      const excludedByOpen = stat.openTasks >= maxOpen;
      const excludedByCompleter = excludeUserId === stat.userId;
      const excluded = excludedByOpen || excludedByCompleter;
      const score =
        stat.openTasks * 10 +
        stat.openTasksSameTitle * 15 +
        stat.completedCountSameTitle * 5 -
        stat.daysSinceLastAssignmentSameTitle * 2;

      return {
        userId: stat.userId,
        name: stat.name,
        index: stat.index,
        openTasks: stat.openTasks,
        openTasksSameTitle: stat.openTasksSameTitle,
        completedCountSameTitle: stat.completedCountSameTitle,
        daysSinceLastAssignmentSameTitle:
          Math.round(stat.daysSinceLastAssignmentSameTitle * 10) / 10,
        score: Math.round(score * 100) / 100,
        excluded,
        exclusionReason: excludedByCompleter
          ? 'completed this chore — excluded from immediate re-assign'
          : excludedByOpen
            ? `openTasks (${stat.openTasks}) >= max (${maxOpen})`
            : null,
      };
    });

    let eligible = candidates.filter((c) => !c.excluded);

    if (eligible.length === 0 && excludeUserId) {
      eligible = candidates.filter((c) => c.userId !== excludeUserId);
    }
    if (eligible.length === 0) {
      throw new AppError(
        'Cannot assign task: no eligible members for rotation',
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
        choreTitle,
        excludeUserId,
        currentIndex,
        maxOpenPerUser: maxOpen,
        candidates,
        selected: {
          userId: selected.userId,
          name: selected.name,
          reason: `lowest score (${selected.score}); ${selected.openTasks} open, ${selected.openTasksSameTitle} same-title open, ${selected.completedCountSameTitle} completed (90d)`,
        },
      },
      'Rotation engine: per-chore fair assignment',
    );
    }
  }

  if (explicitAssignedTo) {
    logger.info(
      { houseId, assignedTo: assignedMemberId, mode: 'explicit' },
      'Rotation engine: explicit assignment',
    );
  }

  const createdTask = await tasksRepo.createTaskInTx(tx, {
    houseId,
    assignedTo: assignedMemberId,
    title,
    deadline,
    rewardPoints,
    penaltyFine,
    isRecurring,
    cronSchedule,
    spawnedFromTaskId: rotationOptions?.spawnedFromTaskId,
  });

  if (!explicitAssignedTo && nextIndex !== currentIndex) {
    await tasksRepo.updateHouseIndexInTx(tx, houseId, nextIndex);
  }

  return createdTask;
}

export interface RotationResult {
  rotated: boolean;
  skipped?: boolean;
  reason?: string;
  newTaskId?: string;
  assignedTo?: string;
  assigneeName?: string;
}

/**
 * After a task is completed, spawn the next pending instance for the same chore.
 */
export async function completeAndRotateTask(completedTaskId: string): Promise<RotationResult> {
  const completed = await prisma.task.findUnique({
    where: { id: completedTaskId },
    select: {
      id: true,
      houseId: true,
      assignedTo: true,
      title: true,
      status: true,
      rotationSpawnedAt: true,
      createdAt: true,
      deadline: true,
      rewardPoints: true,
      penaltyFine: true,
      isRecurring: true,
      cronSchedule: true,
    },
  });

  if (!completed) {
    return { rotated: false, reason: 'task_not_found' };
  }
  if (completed.status !== 'completed') {
    return { rotated: false, reason: 'not_completed', skipped: true };
  }
  if (completed.rotationSpawnedAt) {
    return { rotated: false, reason: 'already_rotated', skipped: true };
  }

  const activeCount = await prisma.houseMember.count({
    where: { houseId: completed.houseId, status: 'active' },
  });
  if (activeCount <= 1) {
    logger.debug({ completedTaskId }, 'completeAndRotateTask: solo house, skip rotation');
    await prisma.task.update({
      where: { id: completedTaskId },
      data: { rotationSpawnedAt: new Date() },
    });
    return { rotated: false, reason: 'solo_house', skipped: true };
  }

  const newDeadline = computeNextRotationDeadline(
    completed.cronSchedule,
    completed.createdAt,
    completed.deadline,
  );

  const newTask = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ rotation_spawned_at: Date | null }[]>`
      SELECT rotation_spawned_at FROM tasks WHERE id = ${completedTaskId}::uuid FOR UPDATE
    `;
    if (locked[0]?.rotation_spawned_at) {
      return null;
    }

    const created = await executeAssignmentInTx(tx, {
      houseId: completed.houseId,
      title: completed.title,
      deadline: newDeadline,
      rewardPoints: completed.rewardPoints,
      penaltyFine: Number(completed.penaltyFine),
      isRecurring: completed.isRecurring,
      cronSchedule: completed.cronSchedule ?? undefined,
      rotationOptions: {
        excludeUserId: completed.assignedTo,
        choreTitle: completed.title,
        spawnedFromTaskId: completedTaskId,
      },
    });

    await tx.task.update({
      where: { id: completedTaskId },
      data: { rotationSpawnedAt: new Date() },
    });

    return created;
  });

  if (!newTask) {
    return { rotated: false, reason: 'already_rotated', skipped: true };
  }

  const assignee = await prisma.user.findUnique({
    where: { id: newTask.assignedTo },
    select: { name: true },
  });

  logger.info(
    {
      completedTaskId,
      newTaskId: newTask.id,
      assignedTo: newTask.assignedTo,
      assigneeName: assignee?.name,
      title: completed.title,
      newDeadline,
    },
    'Chore rotation: spawned next instance',
  );

  return {
    rotated: true,
    newTaskId: newTask.id,
    assignedTo: newTask.assignedTo,
    assigneeName: assignee?.name ?? undefined,
  };
}

/** @deprecated Use completeAndRotateTask */
export async function spawnNextChoreInstance(completedTaskId: string) {
  const result = await completeAndRotateTask(completedTaskId);
  if (!result.rotated || !result.newTaskId) return null;
  return prisma.task.findUnique({
    where: { id: result.newTaskId },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
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

  if (isSoloHouse) {
    await completeAndRotateTask(taskId);
  }

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
    const majorityMet = approved >= rejected && approved > 0 && sub.votes.length > 0;

    if (!isCurrent) {
      if (approved > rejected) outcome = 'approved';
      else if (rejected > approved) outcome = 'disputed';
      else if (sub.votes.length > 0) outcome = 'tie';
    } else if (task.status === 'completed' || majorityMet) {
      outcome = 'approved';
    } else if (task.status === 'disputed') {
      outcome = 'disputed';
    } else if (task.status === 'rejected') {
      outcome = 'rejected';
    } else if (task.status === 'submitted') {
      outcome = majorityMet ? 'approved' : 'voting';
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
