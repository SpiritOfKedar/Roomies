/**
 * Chore thread — unified timeline across all instances and submissions.
 */

import { prisma } from '../../shared/db/prisma';
import { env } from '../../shared/utils/env';
import * as submissionsRepo from './task-submissions.repository';
import * as commentsRepo from './task-comments.repository';

function buildCommentTree(
  comments: Awaited<ReturnType<typeof commentsRepo.getCommentsForChore>>,
  submissionId: string,
) {
  const scoped = comments.filter((c) => c.submissionId === submissionId);
  const byId = new Map(scoped.map((c) => [c.id, { ...c, replies: [] as typeof scoped }]));
  const roots: (typeof scoped[0] & { replies: unknown[] })[] = [];

  for (const c of scoped) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.replies.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function computeOutcome(
  taskStatus: string,
  isCurrent: boolean,
  approved: number,
  rejected: number,
  voteCount: number,
): string | null {
  const majorityMet = approved >= rejected && approved > 0 && voteCount > 0;

  if (!isCurrent) {
    if (approved > rejected) return 'approved';
    if (rejected > approved) return 'disputed';
    if (voteCount > 0) return 'tie';
    return null;
  }
  if (taskStatus === 'completed' || majorityMet) return 'approved';
  if (taskStatus === 'disputed') return 'disputed';
  if (taskStatus === 'rejected') return 'rejected';
  if (taskStatus === 'submitted') return majorityMet ? 'approved' : 'voting';
  return null;
}

export async function buildChoreThread(choreId: string) {
  const chore = await prisma.chore.findUnique({
    where: { id: choreId },
    include: {
      instances: {
        orderBy: { cycleNumber: 'asc' },
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!chore) return null;

  const instanceIds = chore.instances.map((i) => i.id);
  const allSubmissions = await submissionsRepo.getSubmissionsWithVotesBatch(instanceIds);
  const comments = await commentsRepo.getCommentsForChore(choreId);

  const submissionsByTask = new Map<string, typeof allSubmissions>();
  for (const sub of allSubmissions) {
    const list = submissionsByTask.get(sub.taskId) ?? [];
    list.push(sub);
    submissionsByTask.set(sub.taskId, list);
  }

  const activeInstance =
    chore.instances.find((i) => ['pending', 'submitted', 'disputed'].includes(i.status)) ??
    chore.instances[chore.instances.length - 1] ??
    null;

  const cycles = chore.instances.map((instance) => {
    const subs = submissionsByTask.get(instance.id) ?? [];
    const submissions = subs.map((sub) => {
      const approved = sub.votes.filter((v) => v.vote === 'approve').length;
      const rejected = sub.votes.filter((v) => v.vote === 'reject').length;
      const isCurrent = sub.id === instance.currentSubmissionId;

      return {
        submissionId: sub.id,
        attemptNumber: sub.attemptNumber,
        imageUrl: sub.imageUrl,
        clarification: sub.clarification,
        submittedAt: sub.createdAt,
        isCurrent,
        outcome: computeOutcome(
          instance.status,
          isCurrent,
          approved,
          rejected,
          sub.votes.length,
        ),
        tallies: { approved, rejected },
        votes: sub.votes.map((v) => ({
          userId: v.userId,
          userName: v.user.name,
          vote: v.vote,
          reason: v.reason,
          createdAt: v.createdAt,
        })),
        comments: buildCommentTree(comments, sub.id),
      };
    });

    return {
      cycleNumber: instance.cycleNumber,
      instanceId: instance.id,
      assigneeName: instance.assignee.name,
      assigneeId: instance.assignedTo,
      status: instance.status,
      deadline: instance.deadline,
      completedAt: instance.status === 'completed' ? instance.deadline : undefined,
      submissions,
    };
  });

  return {
    choreId: chore.id,
    title: chore.title,
    isRecurring: chore.isRecurring,
    rewardPoints: chore.rewardPoints,
    penaltyFine: chore.penaltyFine,
    maxResubmissions: env.TASK_MAX_RESUBMISSIONS,
    activeInstance: activeInstance
      ? {
          id: activeInstance.id,
          choreId: activeInstance.choreId,
          cycleNumber: activeInstance.cycleNumber,
          houseId: activeInstance.houseId,
          assignedTo: activeInstance.assignedTo,
          title: activeInstance.title,
          status: activeInstance.status,
          deadline: activeInstance.deadline,
          createdAt: activeInstance.createdAt,
          rewardPoints: activeInstance.rewardPoints,
          penaltyFine: activeInstance.penaltyFine,
          isRecurring: activeInstance.isRecurring,
          cronSchedule: activeInstance.cronSchedule,
          resubmissionCount: activeInstance.resubmissionCount,
          currentSubmissionId: activeInstance.currentSubmissionId,
          assignee: activeInstance.assignee,
        }
      : null,
    cycles,
  };
}
