import type { PrismaClient } from '@prisma/client';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface ApplyPenaltyData {
  userId: string;
  taskId: string;
  points: number;
  fineAmount: number;
}

export async function createPenalty(tx: TxClient, data: ApplyPenaltyData) {
  return tx.penalty.create({
    data: {
      userId: data.userId,
      taskId: data.taskId,
      points: data.points,
      fineAmount: data.fineAmount,
    },
  });
}

/**
 * Find a single penalty by its ID, including the houseId of the related task
 * (used for ownership/authorization checks).
 */
export async function findPenaltyById(penaltyId: string) {
  return import('../../shared/db/prisma').then(({ prisma }) =>
    prisma.penalty.findUnique({
      where: { id: penaltyId },
      select: {
        id: true,
        userId: true,
        status: true,
        points: true,
        fineAmount: true,
        createdAt: true,
        task: {
          select: { houseId: true },
        },
      },
    }),
  );
}

/**
 * Transition a penalty from 'unpaid' to 'settled'.
 * Uses optimistic concurrency — only updates if the row is still 'unpaid'.
 *
 * @returns The updated penalty, or null if the penalty was already settled/forgiven.
 */
export async function settlePenalty(penaltyId: string) {
  return import('../../shared/db/prisma').then(async ({ prisma }) => {
    // updateMany lets us apply a WHERE filter without throwing on 0 rows
    const result = await prisma.penalty.updateMany({
      where: { id: penaltyId, status: 'unpaid' },
      data: { status: 'settled' },
    });

    if (result.count === 0) {
      return null; // Already settled or forgiven
    }

    return prisma.penalty.findUnique({
      where: { id: penaltyId },
      select: {
        id: true,
        userId: true,
        status: true,
        points: true,
        fineAmount: true,
        createdAt: true,
      },
    });
  });
}
