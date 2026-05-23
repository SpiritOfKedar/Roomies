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
import * as penaltyService from '../penalty/penalty.service';
import { logger } from '../../shared/utils/logger';
import { env } from '../../shared/utils/env';

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
      rewardPoints: true,
      penaltyFine: true,
      currentSubmissionId: true,
      resubmissionCount: true,
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
  const attemptNumber = task.currentSubmission.attemptNumber;

  const result = await prisma.$transaction(
    async (tx: Parameters<typeof penaltyService.applyPenalty>[0]) => {
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

      const taskRewardPoints = task.rewardPoints;
      const taskPenaltyFine = Number(task.penaltyFine);
      const maxAttempts = env.TASK_MAX_RESUBMISSIONS;

      let finalStatus = task.status;
      let actionMsg = 'Vote cast, threshold not met';
      let votingComplete = false;

      if (approvedVotes >= majorityThreshold) {
        finalStatus = 'completed';
        actionMsg = 'Task approved';
        votingComplete = true;

        await tx.task.updateMany({
          where: { id: taskId, status: 'submitted' },
          data: { status: 'completed', currentSubmissionId: null },
        });
      } else if (rejectedVotes >= majorityThreshold) {
        votingComplete = true;
        if (attemptNumber >= maxAttempts) {
          finalStatus = 'rejected';
          actionMsg = 'Task rejected — max resubmission attempts exhausted';

          const updateResult = await tx.task.updateMany({
            where: { id: taskId, status: 'submitted' },
            data: { status: 'rejected', currentSubmissionId: null },
          });

          if (updateResult.count > 0) {
            await penaltyService.applyPenalty(
              tx,
              task.assignedTo,
              taskId,
              'Task proof rejected after exhausting all resubmission attempts',
              taskRewardPoints,
              taskPenaltyFine,
            );
          }
        } else {
          finalStatus = 'disputed';
          actionMsg = 'Task disputed — assignee may resubmit with clarification';

          await tx.task.updateMany({
            where: { id: taskId, status: 'submitted' },
            data: { status: 'disputed' },
          });
        }
      } else if (approvedVotes + rejectedVotes === eligibleVoters) {
        votingComplete = true;
        if (attemptNumber >= maxAttempts) {
          finalStatus = 'rejected';
          actionMsg = 'Task rejected (tie) — max resubmission attempts exhausted';

          const updateResult = await tx.task.updateMany({
            where: { id: taskId, status: 'submitted' },
            data: { status: 'rejected', currentSubmissionId: null },
          });

          if (updateResult.count > 0) {
            await penaltyService.applyPenalty(
              tx,
              task.assignedTo,
              taskId,
              'Task proof rejected due to tied votes after exhausting resubmission attempts',
              taskRewardPoints,
              taskPenaltyFine,
            );
          }
        } else {
          finalStatus = 'disputed';
          actionMsg = 'Task disputed (tie) — assignee may resubmit';

          await tx.task.updateMany({
            where: { id: taskId, status: 'submitted' },
            data: { status: 'disputed' },
          });
        }
      }

      logger.info(
        {
          taskId,
          submissionId,
          attemptNumber,
          userId,
          voteType,
          finalStatus,
          approvedVotes,
          rejectedVotes,
          majorityThreshold,
        },
        actionMsg,
      );

      return {
        taskId,
        submissionId,
        finalStatus,
        votingComplete,
        tallies: {
          approved: approvedVotes,
          rejected: rejectedVotes,
          required: majorityThreshold,
        },
        eligibleVoters,
      };
    },
  );

  return result;
}

/**
 * Get vote status for the current submission round.
 */
export async function getVoteStatus(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
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

  return {
    taskId,
    status: task.status,
    submissionId: task.currentSubmissionId,
    tallies: { approved, rejected, required: majorityThreshold },
    eligibleVoters,
    votesCast: votes.length,
    votingComplete:
      task.status !== 'submitted' ||
      approved >= majorityThreshold ||
      rejected >= majorityThreshold ||
      votes.length >= eligibleVoters,
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
