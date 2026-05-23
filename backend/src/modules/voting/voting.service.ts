/**
 * =============================================================================
 * Voting Service — Peer Validation Logic
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../shared/utils/app-error';
import * as houseService from '../house/house.service';
import * as tasksService from '../tasks/tasks.service';
import type { RotationResult } from '../tasks/tasks.service';
import { finalizeTaskVotingIfComplete } from './voting.finalize';

function computeMajority(eligibleVoters: number) {
  return Math.floor(eligibleVoters / 2) + 1;
}

async function tallySubmissionVotes(submissionId: string) {
  const votes = await prisma.vote.groupBy({
    by: ['vote'],
    where: { submissionId },
    _count: { vote: true },
  });

  let approved = 0;
  let rejected = 0;
  for (const v of votes) {
    if (v.vote === 'approve') approved = v._count.vote;
    if (v.vote === 'reject') rejected = v._count.vote;
  }
  return { approved, rejected };
}

function toRotationPayload(result: RotationResult) {
  if (!result.rotated || !result.newTaskId) return undefined;
  return {
    newTaskId: result.newTaskId,
    assignedTo: result.assignedTo,
    assigneeName: result.assigneeName,
  };
}

async function maybeRotateAfterComplete(taskId: string): Promise<RotationResult | undefined> {
  const rotation = await tasksService.completeAndRotateTask(taskId);
  if (!rotation.rotated && rotation.reason && !rotation.skipped) {
    throw new AppError(`Chore rotation failed: ${rotation.reason}`, 500);
  }
  return rotation;
}

/**
 * Self-heal tasks stuck in submitted when vote tallies already meet majority.
 */
async function selfHealStuckSubmission(taskId: string): Promise<{
  healed: boolean;
  newStatus: string;
  rotation?: RotationResult;
}> {
  const healResult = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM tasks WHERE id = ${taskId}::uuid FOR UPDATE`;
    return finalizeTaskVotingIfComplete(tx, taskId);
  });

  if (!healResult.finalized) {
    return { healed: false, newStatus: healResult.newStatus };
  }

  let rotation: RotationResult | undefined;
  if (healResult.shouldRotate && healResult.newStatus === 'completed') {
    rotation = await maybeRotateAfterComplete(taskId);
  }

  return { healed: true, newStatus: healResult.newStatus, rotation };
}

function majorityMet(
  approved: number,
  rejected: number,
  majorityThreshold: number,
  eligibleVoters: number,
) {
  return (
    approved >= majorityThreshold ||
    rejected >= majorityThreshold ||
    (eligibleVoters > 0 && approved + rejected >= eligibleVoters)
  );
}

/**
 * Cast a vote on the current submission round of a submitted task.
 */
export async function castVote(
  userId: string,
  taskId: string,
  voteType: 'approve' | 'reject',
  reason?: string,
) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      houseId: true,
      assignedTo: true,
      status: true,
      currentSubmissionId: true,
      currentSubmission: { select: { id: true, attemptNumber: true } },
    },
  });

  if (!task) throw NotFoundError('Task');
  if (task.status !== 'submitted') {
    throw new AppError(
      `Cannot vote on task in state '${task.status}'. Task must be 'submitted'.`,
      400,
    );
  }
  if (!task.currentSubmissionId || !task.currentSubmission) {
    throw new AppError('Task has no active submission to vote on', 400);
  }

  await houseService.verifyMembership(task.houseId, userId);

  if (task.assignedTo === userId) {
    throw ForbiddenError('You cannot vote on your own task');
  }

  if (voteType === 'reject' && reason !== undefined && reason.length > 500) {
    throw new AppError('Reject reason must be at most 500 characters', 400);
  }

  const submissionId = task.currentSubmissionId;

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM tasks WHERE id = ${taskId}::uuid FOR UPDATE`;

    try {
      await tx.vote.create({
        data: {
          taskId,
          submissionId,
          userId,
          vote: voteType,
          reason: voteType === 'reject' ? reason ?? null : null,
        },
      });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw ConflictError('You have already voted on this submission round');
      }
      throw error;
    }

    const { approved: approvedVotes, rejected: rejectedVotes } = await tallySubmissionVotes(
      submissionId,
    );

    const totalActiveMembers = await tx.houseMember.count({
      where: { houseId: task.houseId, status: 'active' },
    });
    const eligibleVoters = Math.max(0, totalActiveMembers - 1);
    const majorityThreshold = computeMajority(eligibleVoters);

    const finalize = await finalizeTaskVotingIfComplete(tx, taskId);

    return {
      taskId,
      submissionId,
      finalStatus: finalize.newStatus,
      votingComplete: finalize.finalized || finalize.newStatus !== 'submitted',
      shouldRotate: finalize.shouldRotate,
      tallies: {
        approved: approvedVotes,
        rejected: rejectedVotes,
        required: majorityThreshold,
      },
      eligibleVoters,
    };
  });

  let rotation: RotationResult | undefined;
  if (result.shouldRotate && result.finalStatus === 'completed') {
    rotation = await maybeRotateAfterComplete(taskId);
  }

  return {
    taskId: result.taskId,
    submissionId: result.submissionId,
    finalStatus: result.finalStatus,
    votingComplete: result.votingComplete,
    tallies: result.tallies,
    eligibleVoters: result.eligibleVoters,
    rotation: rotation ? toRotationPayload(rotation) : undefined,
  };
}

/**
 * Get vote status for the current submission round.
 */
export async function getVoteStatus(userId: string, taskId: string) {
  let task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      houseId: true,
      assignedTo: true,
      status: true,
      currentSubmissionId: true,
    },
  });

  if (!task) throw NotFoundError('Task');
  await houseService.verifyMembership(task.houseId, userId);

  const totalActiveMembers = await prisma.houseMember.count({
    where: { houseId: task.houseId, status: 'active' },
  });
  const eligibleVoters = Math.max(0, totalActiveMembers - 1);
  const majorityThreshold = computeMajority(eligibleVoters);

  if (!task.currentSubmissionId) {
    return {
      taskId,
      status: task.status,
      submissionId: null,
      tallies: { approved: 0, rejected: 0, required: majorityThreshold },
      eligibleVoters,
      votesCast: 0,
      votingComplete: task.status !== 'submitted',
      userVote: null,
      votes: [] as Array<{
        userId: string;
        userName: string;
        vote: string;
        reason: string | null;
        createdAt: Date;
      }>,
    };
  }

  const votes = await prisma.vote.findMany({
    where: { submissionId: task.currentSubmissionId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const { approved, rejected } = await tallySubmissionVotes(task.currentSubmissionId);
  const userVoteRecord = votes.find((v) => v.userId === userId);

  if (
    task.status === 'submitted' &&
    majorityMet(approved, rejected, majorityThreshold, eligibleVoters)
  ) {
    const heal = await selfHealStuckSubmission(taskId);
    if (heal.healed) {
      task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          houseId: true,
          assignedTo: true,
          status: true,
          currentSubmissionId: true,
        },
      });
      if (!task) throw NotFoundError('Task');
    }
  }

  const currentStatus = task.status;
  const votingComplete = currentStatus !== 'submitted';

  return {
    taskId,
    status: currentStatus,
    submissionId: task.currentSubmissionId,
    tallies: { approved, rejected, required: majorityThreshold },
    eligibleVoters,
    votesCast: votes.length,
    votingComplete,
    userVote: userVoteRecord
      ? { vote: userVoteRecord.vote, reason: userVoteRecord.reason }
      : null,
    votes: votes.map((v) => ({
      userId: v.userId,
      userName: v.user.name,
      vote: v.vote,
      reason: v.reason,
      createdAt: v.createdAt,
    })),
  };
}
