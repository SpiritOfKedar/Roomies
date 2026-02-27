/**
 * =============================================================================
 * Expense Repository — Database Access Layer
 * =============================================================================
 * Isolates all Prisma queries for the `expenses` and `expense_splits` tables.
 * No business logic — pure data access.
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';
import { Prisma } from '@prisma/client';

// ---- Shared select shapes ----

const expenseSelect = {
  id: true,
  houseId: true,
  paidBy: true,
  amount: true,
  description: true,
  receiptUrl: true,
  createdAt: true,
  payer: { select: { id: true, name: true } },
  splits: {
    select: {
      id: true,
      owedBy: true,
      amount: true,
      status: true,
      createdAt: true,
      user: { select: { id: true, name: true } },
    },
  },
} as const;

const splitSelect = {
  id: true,
  expenseId: true,
  owedBy: true,
  amount: true,
  status: true,
  createdAt: true,
  expense: {
    select: {
      id: true,
      houseId: true,
      paidBy: true,
      description: true,
    },
  },
  user: { select: { id: true, name: true } },
} as const;

export type ExpenseRecord = Prisma.ExpenseGetPayload<{ select: typeof expenseSelect }>;
export type SplitRecord = Prisma.ExpenseSplitGetPayload<{ select: typeof splitSelect }>;

// ---- Repository Functions ----

/**
 * Create an expense and all of its splits inside a transaction.
 *
 * The payer's own split is pre-marked 'settled' (they fronted the cash).
 * All other members receive an 'unpaid' split.
 *
 * @param tx          - Prisma transaction client
 * @param houseId     - House scope
 * @param paidBy      - User who paid
 * @param amount      - Total expense amount (Decimal-safe string)
 * @param description - Human-readable description
 * @param receiptUrl  - Optional proof of purchase URL
 * @param memberIds   - All active member IDs (including payer)
 * @param splitAmount - Per-person share (pre-computed by service)
 * @returns The created expense with its splits
 */
export async function createExpenseWithSplits(
  tx: Prisma.TransactionClient,
  data: {
    houseId: string;
    paidBy: string;
    amount: Prisma.Decimal | number;
    description: string;
    receiptUrl?: string;
    memberIds: string[];
    splitAmount: Prisma.Decimal;
  },
): Promise<ExpenseRecord> {
  const expense = await tx.expense.create({
    data: {
      houseId: data.houseId,
      paidBy: data.paidBy,
      amount: data.amount,
      description: data.description,
      receiptUrl: data.receiptUrl ?? null,
      splits: {
        create: data.memberIds.map((memberId) => ({
          owedBy: memberId,
          amount: data.splitAmount,
          // Payer's own share is already settled — they fronted the money
          status: memberId === data.paidBy ? 'settled' : 'unpaid',
        })),
      },
    },
    select: expenseSelect,
  });

  return expense;
}

/**
 * Find an expense split by ID, including its parent expense (for house verification).
 */
export async function findSplitById(splitId: string): Promise<SplitRecord | null> {
  return prisma.expenseSplit.findUnique({
    where: { id: splitId },
    select: splitSelect,
  });
}

/**
 * Settle an expense split (unpaid → settled).
 * Uses updateMany so a concurrent settlement is a no-op (not an error at DB layer).
 * Returns the updated record, or null if it was already settled.
 */
export async function settleSplit(splitId: string): Promise<SplitRecord | null> {
  const { count } = await prisma.expenseSplit.updateMany({
    where: { id: splitId, status: 'unpaid' },
    data: { status: 'settled' },
  });

  if (count === 0) return null; // Already settled

  return prisma.expenseSplit.findUnique({
    where: { id: splitId },
    select: splitSelect,
  });
}

/**
 * Get paginated expenses for a house, most-recent first.
 */
export async function getExpensesByHouse(
  houseId: string,
  limit: number,
  offset: number,
): Promise<{ expenses: ExpenseRecord[]; total: number }> {
  const [expenses, total] = await prisma.$transaction([
    prisma.expense.findMany({
      where: { houseId },
      select: expenseSelect,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.expense.count({ where: { houseId } }),
  ]);

  return { expenses, total };
}
