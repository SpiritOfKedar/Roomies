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

/** Collect task IDs in rotation lineage (ancestors + descendants). */
export async function getTaskLineageIds(taskId: string): Promise<string[]> {
  const ids = new Set<string>([taskId]);

  let current = await prisma.task.findUnique({
    where: { id: taskId },
    select: { spawnedFromTaskId: true },
  });

  while (current?.spawnedFromTaskId) {
    if (ids.has(current.spawnedFromTaskId)) break;
    ids.add(current.spawnedFromTaskId);
    current = await prisma.task.findUnique({
      where: { id: current.spawnedFromTaskId },
      select: { spawnedFromTaskId: true },
    });
  }

  const queue = [taskId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const children = await prisma.task.findMany({
      where: { spawnedFromTaskId: id },
      select: { id: true },
    });
    for (const child of children) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        queue.push(child.id);
      }
    }
  }

  return Array.from(ids);
}
