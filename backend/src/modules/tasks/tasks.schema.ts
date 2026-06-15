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
  assignedTo: z.string().uuid('Invalid user ID').optional(),
  rewardPoints: z.number().int().positive().optional(),
  penaltyFine: z.number().positive().optional(),
  weight: z.number().int().positive().optional(),
  isRecurring: z.boolean().optional(),
  cronSchedule: z.string().optional(),
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
  statusFilter: z.enum(['active', 'all']).default('active'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// ---- Admin Task Update ----

/**
 * Schema for PATCH /api/houses/:id/tasks/:taskId
 * At least one field must be supplied.
 */
export const updateTaskSchema = z
  .object({
    title: z.string().min(2).max(200).trim().optional(),
    deadline: z.string().datetime({ message: 'Deadline must be a valid ISO 8601 datetime' }).optional(),
    assignedTo: z.string().uuid('Invalid user ID').optional(),
    rewardPoints: z.number().int().positive().optional(),
    penaltyFine: z.number().positive().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/** Compound params for routes mounted under /api/houses/:id/tasks/:taskId */
export const houseTaskParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
  taskId: z.string().uuid('Invalid task ID'),
});

export type HouseTaskParams = z.infer<typeof houseTaskParamsSchema>;

// ---- Task comments ----

export const createTaskCommentSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
  parentId: z.string().uuid().optional(),
});

export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;

export const taskCommentParamsSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
  commentId: z.string().uuid('Invalid comment ID'),
});

export type TaskCommentParams = z.infer<typeof taskCommentParamsSchema>;
