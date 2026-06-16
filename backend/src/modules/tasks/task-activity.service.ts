/**
 * Task activity event logging for chore timeline feeds.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma';

export type TaskActivityType =
  | 'assigned'
  | 'swapped'
  | 'submitted'
  | 'vote'
  | 'completed'
  | 'rotated'
  | 'expired'
  | 'admin_edit'
  | 'reassigned'
  | 'deleted';

export async function logTaskActivity(
  taskId: string,
  type: TaskActivityType,
  actorId?: string | null,
  payload: Record<string, unknown> = {},
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const client = tx ?? prisma;
  await client.taskActivityEvent.create({
    data: {
      taskId,
      type,
      actorId: actorId ?? null,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

/** Collect all task instance IDs for a chore (replaces lineage walk). */
export async function getTaskLineageIds(taskId: string): Promise<string[]> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { choreId: true },
  });
  if (!task) return [taskId];

  const instances = await prisma.task.findMany({
    where: { choreId: task.choreId },
    select: { id: true },
    orderBy: { cycleNumber: 'asc' },
  });

  return instances.map((i) => i.id);
}
