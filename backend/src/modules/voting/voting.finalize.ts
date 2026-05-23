/**
 * Vote finalization — apply terminal status when majority is reached.
 */

import type { Prisma } from '@prisma/client';
import * as penaltyService from '../penalty/penalty.service';
import { env } from '../../shared/utils/env';
import { logger } from '../../shared/utils/logger';

type TxClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface FinalizeVotingResult {
  finalized: boolean;
  newStatus: string;
  shouldRotate: boolean;
  actionMsg: string;
}

function computeMajority(eligibleVoters: number) {
  return Math.floor(eligibleVoters / 2) + 1;
}

async function tallySubmissionVotesInTx(tx: TxClient, submissionId: string) {
  const votes = await tx.vote.groupBy({
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
 * If vote tallies meet majority, transition task from submitted to terminal status.
 * Must run inside a transaction with the task row locked.
 */
export async function finalizeTaskVotingIfComplete(
  tx: TxClient,
  taskId: string,
): Promise<FinalizeVotingResult> {
  const task = await tx.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      houseId: true,
      assignedTo: true,
      status: true,
      rewardPoints: true,
      penaltyFine: true,
      currentSubmissionId: true,
      currentSubmission: { select: { id: true, attemptNumber: true } },
    },
  });

  if (!task) {
    return { finalized: false, newStatus: 'unknown', shouldRotate: false, actionMsg: 'Task not found' };
  }

  if (task.status !== 'submitted') {
    return {
      finalized: false,
      newStatus: task.status,
      shouldRotate: task.status === 'completed',
      actionMsg: `Task already in state ${task.status}`,
    };
  }

  if (!task.currentSubmissionId || !task.currentSubmission) {
    return {
      finalized: false,
      newStatus: task.status,
      shouldRotate: false,
      actionMsg: 'No active submission',
    };
  }

  const submissionId = task.currentSubmissionId;
  const attemptNumber = task.currentSubmission.attemptNumber;
  const { approved: approvedVotes, rejected: rejectedVotes } = await tallySubmissionVotesInTx(
    tx,
    submissionId,
  );

  const totalActiveMembers = await tx.houseMember.count({
    where: { houseId: task.houseId, status: 'active' },
  });
  const eligibleVoters = Math.max(0, totalActiveMembers - 1);
  const majorityThreshold = computeMajority(eligibleVoters);
  const maxAttempts = env.TASK_MAX_RESUBMISSIONS;
  const taskRewardPoints = task.rewardPoints;
  const taskPenaltyFine = Number(task.penaltyFine);

  let newStatus = task.status;
  let shouldRotate = false;
  let actionMsg = 'Threshold not met';

  if (approvedVotes >= majorityThreshold) {
    const updateResult = await tx.task.updateMany({
      where: { id: taskId, status: 'submitted' },
      data: { status: 'completed', currentSubmissionId: null },
    });

    if (updateResult.count > 0) {
      newStatus = 'completed';
      shouldRotate = true;
      actionMsg = 'Task approved';
    } else {
      const current = await tx.task.findUnique({
        where: { id: taskId },
        select: { status: true },
      });
      if (current?.status === 'completed') {
        newStatus = 'completed';
        shouldRotate = true;
        actionMsg = 'Task already approved';
      }
    }
  } else if (rejectedVotes >= majorityThreshold) {
    if (attemptNumber >= maxAttempts) {
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
      newStatus = 'rejected';
      actionMsg = 'Task rejected — max resubmission attempts exhausted';
    } else {
      await tx.task.updateMany({
        where: { id: taskId, status: 'submitted' },
        data: { status: 'disputed' },
      });
      newStatus = 'disputed';
      actionMsg = 'Task disputed';
    }
  } else if (approvedVotes + rejectedVotes === eligibleVoters && eligibleVoters > 0) {
    if (attemptNumber >= maxAttempts) {
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
      newStatus = 'rejected';
      actionMsg = 'Task rejected (tie)';
    } else {
      await tx.task.updateMany({
        where: { id: taskId, status: 'submitted' },
        data: { status: 'disputed' },
      });
      newStatus = 'disputed';
      actionMsg = 'Task disputed (tie)';
    }
  } else {
    return {
      finalized: false,
      newStatus: task.status,
      shouldRotate: false,
      actionMsg,
    };
  }

  const finalized = newStatus !== 'submitted';

  if (finalized) {
    logger.info(
      { taskId, newStatus, shouldRotate, approvedVotes, rejectedVotes, majorityThreshold },
      actionMsg,
    );
  }

  return { finalized, newStatus, shouldRotate, actionMsg };
}
