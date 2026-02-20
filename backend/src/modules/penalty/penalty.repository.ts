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
