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

/**
 * Cast a vote on a submitted task.
 *
 * Flow:
 * 1. Fetch task and check status
 * 2. Verify house membership
 * 3. Verify user is NOT the task assignee
 * 4. Execute transaction:
 *    a. Insert vote (handling "already voted" unique constraint)
 *    b. Count approvals and rejections
 *    c. Calculate majority threshold
 *    d. If threshold met, finalize task and optionally assign penalty
 */
export async function castVote(userId: string, taskId: string, voteType: 'approve' | 'reject') {
  // 1. Fetch Task
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, houseId: true, assignedTo: true, status: true },
  });

  if (!task) {
    throw NotFoundError('Task');
  }

  if (task.status !== 'submitted') {
    throw new AppError(
      `Cannot vote on task in state '${task.status}'. Task must be 'submitted'.`,
      400,
    );
  }

  // 2. Verify House Membership
  await houseService.verifyMembership(task.houseId, userId);

  // 3. User cannot vote on their own task
  if (task.assignedTo === userId) {
    throw ForbiddenError('You cannot vote on your own task');
  }

  // 4. Execute Transaction
  const result = await prisma.$transaction(
    async (tx: Parameters<typeof penaltyService.applyPenalty>[0]) => {
      // a. Insert Vote (Unique constraints prevent double voting: @@unique([taskId, userId]))
      try {
        await tx.vote.create({
          data: {
            taskId,
            userId,
            vote: voteType,
          },
        });
      } catch (error: unknown) {
        // Prisma error code for unique constraint violation
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
          throw ConflictError('You have already voted on this task');
        }
        throw error;
      }

      // b. Tally Votes
      const votes = await tx.vote.groupBy({
        by: ['vote'],
        where: { taskId },
        _count: { vote: true },
      });

      let approvedVotes = 0;
      let rejectedVotes = 0;

      for (const v of votes) {
        if (v.vote === 'approve') approvedVotes = v._count.vote;
        if (v.vote === 'reject') rejectedVotes = v._count.vote;
      }

      // c. Calculate majority
      // We only care about active members excluding the assignee.
      const totalActiveMembers = await tx.houseMember.count({
        where: { houseId: task.houseId, status: 'active' },
      });

      // Members eligible to vote
      const eligibleVoters = Math.max(0, totalActiveMembers - 1);

      // Majority is strictly > 50%
      const majorityThreshold = Math.floor(eligibleVoters / 2) + 1;

      let finalStatus = task.status;
      let actionMsg = 'Vote cast, threshold not met';

      // d. Check thresholds
      if (approvedVotes >= majorityThreshold) {
        finalStatus = 'completed';
        actionMsg = 'Task approved';

        await tx.task.update({
          where: { id: taskId },
          data: { status: 'completed' },
        });
      } else if (rejectedVotes >= majorityThreshold) {
        finalStatus = 'rejected';
        actionMsg = 'Task rejected by peers';

        await tx.task.update({
          where: { id: taskId },
          data: { status: 'rejected' },
        });

        // Apply Penalty using the exact requested transaction flow
        await penaltyService.applyPenalty(
          tx,
          task.assignedTo,
          taskId,
          'Task proof rejected by majority vote',
          10,
          50.0,
        );
      }

      logger.info(
        { taskId, userId, voteType, finalStatus, approvedVotes, rejectedVotes, majorityThreshold },
        actionMsg,
      );

      return {
        taskId,
        finalStatus,
        tallies: {
          approved: approvedVotes,
          rejected: rejectedVotes,
          required: majorityThreshold,
        },
      };
    },
  );

  return result;
}
