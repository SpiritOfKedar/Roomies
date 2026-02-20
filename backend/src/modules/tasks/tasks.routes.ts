/**
 * =============================================================================
 * Tasks Routes
 * =============================================================================
 * Task-related endpoints. All protected by JWT authentication.
 *
 * House-scoped routes (mounted under /api/houses):
 *   POST /api/houses/:id/tasks/assign  → Trigger rotation engine
 *   GET  /api/houses/:id/tasks         → Paginated task list
 *
 * Task-scoped routes (mounted under /api/tasks):
 *   POST /api/tasks/:id/submit         → Submit proof
 * =============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as tasksController from './tasks.controller';
import {
  assignTaskSchema,
  submitTaskSchema,
  taskIdParamsSchema,
  houseIdParamsSchema,
  paginationQuerySchema,
} from './tasks.schema';

// ---- House-scoped task routes (/api/houses/:id/tasks) ----
export const houseTaskRoutes = Router({ mergeParams: true });

houseTaskRoutes.use(requireAuth);

/**
 * POST /api/houses/:id/tasks/assign
 * Triggers the rotation engine. Requires house membership.
 */
houseTaskRoutes.post(
  '/assign',
  validate({ params: houseIdParamsSchema, body: assignTaskSchema }),
  asyncHandler(tasksController.assignTask),
);

/**
 * GET /api/houses/:id/tasks
 * Returns paginated tasks for the house. Requires house membership.
 */
houseTaskRoutes.get(
  '/',
  validate({ params: houseIdParamsSchema, query: paginationQuerySchema }),
  asyncHandler(tasksController.getTasksByHouse),
);

// ---- Task-scoped routes (/api/tasks) ----
export const taskRoutes = Router();

taskRoutes.use(requireAuth);

/**
 * POST /api/tasks/:id/submit
 * Submit proof for a task. Only the assigned user can submit.
 */
taskRoutes.post(
  '/:id/submit',
  validate({ params: taskIdParamsSchema, body: submitTaskSchema }),
  asyncHandler(tasksController.submitTask),
);
