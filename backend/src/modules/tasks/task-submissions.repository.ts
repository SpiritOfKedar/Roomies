/**
 * =============================================================================
 * Task Submissions Repository
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';

export async function getLatestSubmission(taskId: string) {
  return prisma.taskSubmission.findFirst({
    where: { taskId },
    orderBy: { attemptNumber: 'desc' },
  });
}

export async function createSubmission(data: {
  taskId: string;
  attemptNumber: number;
  imageUrl?: string;
  clarification?: string;
}) {
  return prisma.taskSubmission.create({
    data: {
      taskId: data.taskId,
      attemptNumber: data.attemptNumber,
      imageUrl: data.imageUrl,
      clarification: data.clarification,
    },
  });
}

export async function getSubmissionsWithVotes(taskId: string) {
  return prisma.taskSubmission.findMany({
    where: { taskId },
    orderBy: { attemptNumber: 'asc' },
    include: {
      votes: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function getSubmissionById(submissionId: string) {
  return prisma.taskSubmission.findUnique({
    where: { id: submissionId },
  });
}

/**
 * Load submissions + votes for multiple tasks in a single DB round-trip.
 * Returns the same shape as getSubmissionsWithVotes but for an array of tasks.
 */
export async function getSubmissionsWithVotesBatch(taskIds: string[]) {
  if (taskIds.length === 0) return [];
  return prisma.taskSubmission.findMany({
    where: { taskId: { in: taskIds } },
    orderBy: { attemptNumber: 'asc' },
    include: {
      votes: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}
