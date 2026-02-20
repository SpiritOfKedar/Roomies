/**
 * =============================================================================
 * Tasks Validation Schemas — Zod
 * =============================================================================
 * Input validation for task-related endpoints.
 * =============================================================================
 */

import { z } from 'zod';

// ---- Assign Task ----

export const assignTaskSchema = z.object({
  title: z
    .string()
    .min(2, 'Task title must be at least 2 characters')
    .max(200, 'Task title must be at most 200 characters')
    .trim(),
  deadline: z.string().datetime({ message: 'Deadline must be a valid ISO 8601 datetime' }),
});

export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

// ---- Submit Task ----

export const submitTaskSchema = z.object({
  imageUrl: z.string().url('Image URL must be a valid URL').optional(),
});

export type SubmitTaskInput = z.infer<typeof submitTaskSchema>;

// ---- Task ID Param ----

export const taskIdParamsSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
});

export type TaskIdParams = z.infer<typeof taskIdParamsSchema>;

// ---- House ID Param (for house-scoped task endpoints) ----

export const houseIdParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
});

export type HouseIdParams = z.infer<typeof houseIdParamsSchema>;

// ---- Pagination Query ----

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
