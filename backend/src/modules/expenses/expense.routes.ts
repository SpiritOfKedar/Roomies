/**
 * =============================================================================
 * Expense Routes
 * =============================================================================
 * Expense ledger endpoints. All protected by JWT authentication.
 * Mounted at /api/houses/:id/expenses
 *
 *   POST /api/houses/:id/expenses                            → createExpense
 *   GET  /api/houses/:id/expenses                            → getExpenses
 *   POST /api/houses/:id/expenses/splits/:splitId/settle     → settleExpenseSplit
 * =============================================================================
 */

import { Router } from 'express';
import { imageUpload } from '../../shared/middleware/image-upload';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as expenseController from './expense.controller';
import {
  houseIdParamsSchema,
  splitParamsSchema,
  createExpenseSchema,
  paginationQuerySchema,
} from './expense.schema';

/**
 * Multer — in-memory storage for receipt images.
 * Field name: 'receipt'  |  Limit: 5 MB  |  Images only
 */
const upload = imageUpload;

export const expenseRoutes = Router({ mergeParams: true });

expenseRoutes.use(requireAuth);

/**
 * POST /api/houses/:id/expenses
 * Create a shared expense. Accepts multipart/form-data with optional 'receipt' field.
 */
expenseRoutes.post(
  '/',
  upload.single('receipt'),
  validate({ params: houseIdParamsSchema, body: createExpenseSchema }),
  asyncHandler(expenseController.createExpense),
);

/**
 * GET /api/houses/:id/expenses
 * Paginated list of house expenses.
 */
expenseRoutes.get(
  '/',
  validate({ params: houseIdParamsSchema, query: paginationQuerySchema }),
  asyncHandler(expenseController.getExpenses),
);

/**
 * POST /api/houses/:id/expenses/splits/:splitId/settle
 * Settle an individual expense split.
 */
expenseRoutes.post(
  '/splits/:splitId/settle',
  validate({ params: splitParamsSchema }),
  asyncHandler(expenseController.settleExpenseSplit),
);
