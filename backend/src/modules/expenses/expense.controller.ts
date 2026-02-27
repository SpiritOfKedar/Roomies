/**
 * =============================================================================
 * Expense Controller — HTTP Handler Layer
 * =============================================================================
 * Thin controller for expense ledger endpoints.
 * Delegates all business logic to expense.service.ts.
 *
 * File uploads:
 *   POST /api/houses/:id/expenses accepts an optional 'receipt' image field.
 *   If present, the file is uploaded via storage.uploadImage and the
 *   resulting URL overwrites any body.receiptUrl value.
 * =============================================================================
 */

import { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../../shared/utils/api-response';
import { uploadImage } from '../../shared/utils/storage';
import * as expenseService from './expense.service';
import type {
  HouseIdParams,
  SplitParams,
  CreateExpenseInput,
  PaginationQuery,
} from './expense.schema';

/**
 * POST /api/houses/:id/expenses
 *
 * Create a shared expense and generate equal splits for all active members.
 * Accepts multipart/form-data with an optional 'receipt' image file.
 */
export async function createExpense(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const { amount, description, receiptUrl: bodyReceiptUrl } = req.body as CreateExpenseInput;

  // Prefer uploaded file; fall back to explicit URL in body
  let receiptUrl: string | undefined = bodyReceiptUrl;
  if (req.file) {
    receiptUrl = await uploadImage(req.file.buffer, req.file.mimetype);
  }

  const expense = await expenseService.createExpense(
    userId,
    houseId,
    amount,
    description,
    receiptUrl,
  );

  sendSuccess(res, expense, 201);
}

/**
 * GET /api/houses/:id/expenses
 *
 * Retrieve a paginated list of house expenses (most-recent first).
 */
export async function getExpenses(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const { limit, offset } = req.query as unknown as PaginationQuery;

  const result = await expenseService.getExpensesByHouse(userId, houseId, limit, offset);

  sendPaginated(res, result.expenses, result.total, result.limit, result.offset);
}

/**
 * POST /api/houses/:id/expenses/splits/:splitId/settle
 *
 * Mark an individual expense split as settled.
 * Callable by the member who owes the split OR the expense payer.
 */
export async function settleExpenseSplit(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId, splitId } = req.params as unknown as SplitParams;

  const split = await expenseService.settleExpenseSplit(userId, houseId, splitId);

  sendSuccess(res, split);
}
