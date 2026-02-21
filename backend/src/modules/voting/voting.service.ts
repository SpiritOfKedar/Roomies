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
    select: {
      id: true,
      houseId: true,
      assignedTo: true,
      status: true,
      rewardPoints: true,
      penaltyFine: true,
    },
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
      // 0. Lock the task row to prevent concurrent voting write-skew (Lost Wake-up)
      await tx.$executeRaw`SELECT id FROM tasks WHERE id = ${taskId}::uuid FOR UPDATE`;

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

      // Per-task weighting (future-proofed gamification values)
      const taskRewardPoints = task.rewardPoints;
      const taskPenaltyFine = Number(task.penaltyFine);

      // ── 2-PLAYER DICTATORSHIP GUARD ──────────────────────────────────────
      // When a house has exactly 2 active members, only 1 eligible voter
      // exists. A single reject vote MUST NOT unilaterally fine the assignee;
      // instead we mark the task 'disputed' to require manual resolution.
      // An approve vote still resolves the task normally.
      const isTwoPlayerHouse = totalActiveMembers === 2;

      let finalStatus = task.status;
      let actionMsg = 'Vote cast, threshold not met';

      // d. Check thresholds
      if (approvedVotes >= majorityThreshold) {
        finalStatus = 'completed';
        actionMsg = 'Task approved';

        await tx.task.updateMany({
          where: { id: taskId, status: 'submitted' },
          data: { status: 'completed' },
        });

        // reward_points are stored on the task for future gamification reads;
        // no write needed here — the field is already set at task creation.
        void taskRewardPoints;
      } else if (rejectedVotes >= majorityThreshold) {
        if (isTwoPlayerHouse) {
          // 2-player special case: flag as disputed, no penalty applied
          finalStatus = 'disputed';
          actionMsg = 'Task disputed (2-player house — unilateral rejection blocked)';

          await tx.task.updateMany({
            where: { id: taskId, status: 'submitted' },
            data: { status: 'disputed' },
          });
        } else {
          finalStatus = 'rejected';
          actionMsg = 'Task rejected by peers';

          const updateResult = await tx.task.updateMany({
            where: { id: taskId, status: 'submitted' },
            data: { status: 'rejected' },
          });

          if (updateResult.count > 0) {
            // Apply Penalty using the exact requested transaction flow ONLY if this transaction changed the status
            await penaltyService.applyPenalty(
              tx,
              task.assignedTo,
              taskId,
              'Task proof rejected by majority vote',
              taskRewardPoints,
              taskPenaltyFine,
            );
          }
        }
      } else if (approvedVotes + rejectedVotes === eligibleVoters) {
        // TIE BREAKER: All eligible voters have voted, but neither reached absolute majority.
        // This occurs in even-voter scenarios where votes split exactly 50/50.
        // Defaulting to 'rejected' because majority consensus was mathematically not achieved.
        finalStatus = 'rejected';
        actionMsg = 'Task rejected by peers (Tie - Failed to reach majority consensus)';

        const updateResult = await tx.task.updateMany({
          where: { id: taskId, status: 'submitted' },
          data: { status: 'rejected' },
        });

        if (updateResult.count > 0) {
          await penaltyService.applyPenalty(
            tx,
            task.assignedTo,
            taskId,
            'Task proof rejected due to tied votes (failed to reach majority)',
            taskRewardPoints,
            taskPenaltyFine,
          );
        }
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
