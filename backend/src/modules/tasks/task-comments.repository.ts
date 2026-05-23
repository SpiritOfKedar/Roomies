import { prisma } from '../../shared/db/prisma';

const commentSelect = {
  id: true,
  taskId: true,
  userId: true,
  parentId: true,
  body: true,
  imageUrl: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} as const;

export async function createComment(data: {
  taskId: string;
  userId: string;
  body: string;
  parentId?: string | null;
  imageUrl?: string | null;
}) {
  return prisma.taskComment.create({
    data: {
      taskId: data.taskId,
      userId: data.userId,
      body: data.body,
      parentId: data.parentId ?? null,
      imageUrl: data.imageUrl ?? null,
    },
    select: commentSelect,
  });
}

export async function findCommentById(commentId: string) {
  return prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { ...commentSelect, task: { select: { houseId: true } } },
  });
}

export async function deleteComment(commentId: string) {
  return prisma.taskComment.delete({ where: { id: commentId } });
}

export async function getCommentsForTasks(taskIds: string[]) {
  return prisma.taskComment.findMany({
    where: { taskId: { in: taskIds } },
    select: commentSelect,
    orderBy: { createdAt: 'asc' },
  });
}

export async function getActivityEventsForTasks(taskIds: string[]) {
  return prisma.taskActivityEvent.findMany({
    where: { taskId: { in: taskIds } },
    orderBy: { createdAt: 'asc' },
    include: {
      actor: { select: { id: true, name: true } },
    },
  });
}
