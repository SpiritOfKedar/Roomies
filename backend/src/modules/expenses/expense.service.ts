/**
 * =============================================================================
 * Expense Service — Business Logic
 * =============================================================================
 * Implements the shared expense ledger for house finances.
 *
 * Ledger model:
 *   - One member pays upfront for everyone (e.g. groceries, utilities).
 *   - The total is split equally across ALL active members at the moment of
 *     creation.
 *   - The payer's own split is auto-marked 'settled' (they fronted the cash).
 *   - Each other member must settle their own split to clear their debt.
 *
 * Financial integrity:
 *   - createExpense runs entirely inside a Prisma.$transaction.
 *   - Split amounts use Decimal arithmetic to avoid floating-point drift.
 *   - The payer split auto-settlement is idempotent.
 * =============================================================================
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../shared/utils/app-error';
import * as expenseRepo from './expense.repository';
import * as houseService from '../house/house.service';
import { logger } from '../../shared/utils/logger';
import { invalidateHouseCache } from '../../shared/cache/redis-cache';

// ---- Service Functions ----

/**
 * Record a new shared expense and auto-generate equal splits.
 *
 * Flow (all inside a single transaction):
 *   1. Verify payer is an active member of the house.
 *   2. Fetch all active member IDs.
 *   3. Compute split_amount = amount / active_member_count  (Decimal precision).
 *   4. Create expense row.
 *   5. Create one ExpenseSplit per active member:
 *        - payer's split → status: 'settled'
 *        - all other splits → status: 'unpaid'
 *   6. Return expense with splits.
 *
 * @param userId      - The user who paid (payer)
 * @param houseId     - House scope
 * @param amount      - Total expense amount
 * @param description - Human-readable label (e.g. "November groceries")
 * @param receiptUrl  - Optional URL to a receipt image
 * @returns Created expense record including all splits
 */
export async function createExpense(
  userId: string,
  houseId: string,
  amount: number,
  description: string,
  receiptUrl?: string,
) {
  // 1. Verify membership
  await houseService.verifyMembership(houseId, userId);

  const expense = await prisma.$transaction(async (tx) => {
    // 2. Fetch all active member IDs inside the transaction for consistency
    const activeMembers = await tx.houseMember.findMany({
      where: { houseId, status: 'active' },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' },
    });

    if (activeMembers.length === 0) {
      throw new AppError('House has no active members', 400);
    }

    const memberIds = activeMembers.map((m) => m.userId);

    // 3. Split in whole cents so the shares always add up to the total.
    //    Leftover cents go one each to the first members in order — payer
    //    first, since their own share is pre-settled — so no debtor is
    //    ever charged more than one cent above an even split.
    const totalDecimal = new Prisma.Decimal(amount);
    const totalCents = totalDecimal.mul(100).toDecimalPlaces(0).toNumber();
    const baseCents = Math.floor(totalCents / memberIds.length);
    const leftoverCents = totalCents - baseCents * memberIds.length;
    const ordered = [userId, ...memberIds.filter((id) => id !== userId)];
    const splits = ordered.map((owedBy, i) => ({
      owedBy,
      amount: new Prisma.Decimal(baseCents + (i < leftoverCents ? 1 : 0)).div(100),
    }));

    // 4+5. Create expense + splits atomically
    return expenseRepo.createExpenseWithSplits(tx, {
      houseId,
      paidBy: userId,
      amount: totalDecimal,
      description,
      receiptUrl,
      splits,
    });
  });

  logger.info(
    {
      expenseId: expense.id,
      houseId,
      paidBy: userId,
      amount,
      splitCount: expense.splits.length,
    },
    'Expense created and splits generated',
  );

  await invalidateHouseCache(houseId);

  return expense;
}

/**
 * Settle an individual expense split.
 *
 * Authorization: Either the person who owes the split (owedBy) OR the
 * expense payer (paidBy) can settle it.  This allows the payer to
 * acknowledge cash payments received outside the app.
 *
 * @param callerId - The user initiating the settlement
 * @param houseId  - House scope (verified against split's expense)
 * @param splitId  - The ExpenseSplit UUID to settle
 * @returns The updated split record
 *
 * @throws NotFoundError   if the split doesn't exist or belongs to a different house
 * @throws ForbiddenError  if the caller is neither the owedBy nor the paidBy user
 * @throws ConflictError   if the split is already settled
 */
export async function settleExpenseSplit(callerId: string, houseId: string, splitId: string) {
  // 1. Fetch the split including its parent expense for house-scope verification
  const split = await expenseRepo.findSplitById(splitId);

  if (!split || split.expense.houseId !== houseId) {
    throw NotFoundError('Expense split');
  }

  // 2. Already settled?
  if (split.status !== 'unpaid') {
    throw ConflictError(`Split is already '${split.status}' and cannot be settled again`);
  }

  // 3. Authorization: only the payer can confirm they were paid back.
  //    (A debtor marking their own debt as paid would be self-certifying.)
  if (split.expense.paidBy !== callerId) {
    throw ForbiddenError('Only the member who paid this expense can mark a share as settled');
  }

  await houseService.verifyMembership(houseId, callerId);

  // 4. Settle (updateMany guards against race conditions)
  const updated = await expenseRepo.settleSplit(splitId);

  if (!updated) {
    // Race: settled concurrently between our check and the update
    throw ConflictError('Split was already settled by a concurrent request');
  }

  logger.info(
    { splitId, expenseId: split.expenseId, callerId, owedBy: split.owedBy },
    'Expense split settled',
  );

  await invalidateHouseCache(houseId);

  return updated;
}

/**
 * Retrieve paginated expenses for a house.
 * Membership verification is required before calling this function.
 *
 * @param userId  - The requesting user (must be a member)
 * @param houseId - House scope
 * @param limit   - Page size
 * @param offset  - Records to skip
 */
export async function getExpensesByHouse(
  userId: string,
  houseId: string,
  limit: number,
  offset: number,
) {
  await houseService.verifyMembership(houseId, userId);

  const { expenses, total } = await expenseRepo.getExpensesByHouse(houseId, limit, offset);

  return { expenses, total, limit, offset };
}
