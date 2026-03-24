/**
 * =============================================================================
 * Expense Validation Schemas — Zod
 * =============================================================================
 * Input validation for expense ledger endpoints.
 * =============================================================================
 */

import { z } from 'zod';

// ---- House-scoped params ----

export const houseIdParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
});

export type HouseIdParams = z.infer<typeof houseIdParamsSchema>;

// ---- Split settle params (/api/houses/:id/expenses/splits/:splitId/settle) ----

export const splitParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
  splitId: z.string().uuid('Invalid split ID'),
});

export type SplitParams = z.infer<typeof splitParamsSchema>;

// ---- Create Expense body ----

export const createExpenseSchema = z.object({
  amount: z.coerce
    .number()
    .positive('Amount must be a positive number')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
  description: z
    .string()
    .min(2, 'Description must be at least 2 characters')
    .max(500, 'Description must be at most 500 characters')
    .trim(),
  receiptUrl: z.string().url('receiptUrl must be a valid URL').optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ---- Pagination Query ----

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
