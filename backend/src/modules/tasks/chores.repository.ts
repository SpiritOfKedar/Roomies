/**
 * Chores repository — template-level chore queries.
 */

import { prisma } from '../../shared/db/prisma';
import { PrismaClient } from '@prisma/client';
import { TASK_LIST_SELECT } from './tasks.repository';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const ACTIVE_STATUSES = ['pending', 'submitted', 'disputed'];
const DONE_STATUSES = ['completed', 'expired', 'rejected'];

export type ChoreListRow = {
  id: string;
  houseId: string;
  title: string;
  isRecurring: boolean;
  cronSchedule: string | null;
  rewardPoints: number;
  penaltyFine: { toString(): string };
  createdAt: Date;
  activeInstance: (typeof TASK_LIST_SELECT extends object
    ? Awaited<ReturnType<typeof prisma.task.findFirst<{ select: typeof TASK_LIST_SELECT }>>>
    : never) | null;
  completedCycleCount: number;
  totalCycles: number;
};

export async function findChoreById(choreId: string) {
  return prisma.chore.findUnique({
    where: { id: choreId },
    include: {
      instances: {
        orderBy: { cycleNumber: 'desc' },
        take: 1,
        select: TASK_LIST_SELECT,
      },
    },
  });
}

export async function findChoreByHouseAndTitle(houseId: string, title: string) {
  return prisma.chore.findUnique({
    where: { houseId_title: { houseId, title } },
  });
}

export async function createChoreInTx(
  tx: TxClient,
  data: {
    houseId: string;
    title: string;
    isRecurring?: boolean;
    cronSchedule?: string;
    rewardPoints?: number;
    penaltyFine?: number;
  },
) {
  return tx.chore.create({
    data: {
      houseId: data.houseId,
      title: data.title,
      isRecurring: data.isRecurring ?? false,
      cronSchedule: data.cronSchedule,
      rewardPoints: data.rewardPoints ?? 10,
      penaltyFine: data.penaltyFine ?? 50,
    },
  });
}

export async function getNextCycleNumber(tx: TxClient, choreId: string): Promise<number> {
  const max = await tx.task.aggregate({
    where: { choreId },
    _max: { cycleNumber: true },
  });
  return (max._max.cycleNumber ?? 0) + 1;
}

export async function countOpenInstancesForChore(choreId: string, excludeTaskId?: string) {
  return prisma.task.count({
    where: {
      choreId,
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      status: { in: ACTIVE_STATUSES },
    },
  });
}

export async function getInstanceIdsForChore(choreId: string): Promise<string[]> {
  const rows = await prisma.task.findMany({
    where: { choreId },
    select: { id: true },
    orderBy: { cycleNumber: 'asc' },
  });
  return rows.map((r) => r.id);
}

export interface ChoreListItem {
  id: string;
  houseId: string;
  title: string;
  isRecurring: boolean;
  cronSchedule: string | null;
  rewardPoints: number;
  penaltyFine: { toString(): string };
  createdAt: Date;
  activeInstance: ChoreListRow['activeInstance'];
  completedCycleCount: number;
  totalCycles: number;
}

export async function getChoresByHouse(
  houseId: string,
  limit: number,
  offset: number,
  statusFilter: 'active' | 'all' = 'active',
) {
  const chores = await prisma.chore.findMany({
    where: { houseId },
    orderBy: { createdAt: 'desc' },
    skip: offset,
    take: limit,
    include: {
      instances: {
        orderBy: { cycleNumber: 'desc' },
        select: TASK_LIST_SELECT,
      },
    },
  });

  const total = await prisma.chore.count({ where: { houseId } });

  let completedChoreCount = 0;
  if (statusFilter === 'active') {
    completedChoreCount = await prisma.chore.count({
      where: {
        houseId,
        instances: { every: { status: { in: DONE_STATUSES } } },
        NOT: { instances: { some: { status: { in: ACTIVE_STATUSES } } } },
      },
    });
  }

  const items = chores
    .map((chore) => {
      const instances = chore.instances;
      const activeInstance =
        instances.find((i) => ACTIVE_STATUSES.includes(i.status)) ?? instances[0] ?? null;
      const completedCycleCount = instances.filter((i) => i.status === 'completed').length;

      return {
        id: chore.id,
        houseId: chore.houseId,
        title: chore.title,
        isRecurring: chore.isRecurring,
        cronSchedule: chore.cronSchedule,
        rewardPoints: chore.rewardPoints,
        penaltyFine: chore.penaltyFine,
        createdAt: chore.createdAt,
        activeInstance,
        completedCycleCount,
        totalCycles: instances.length,
      };
    })
    .filter((chore) => {
      if (statusFilter === 'all') return true;
      return chore.activeInstance && ACTIVE_STATUSES.includes(chore.activeInstance.status);
    });

  return {
    chores: items,
    total,
    completedChoreCount,
  };
}
