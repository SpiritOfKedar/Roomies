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
import multer from 'multer';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as tasksController from './tasks.controller';
import {
  assignTaskSchema,
  taskIdParamsSchema,
  houseIdParamsSchema,
  paginationQuerySchema,
  updateTaskSchema,
  houseTaskParamsSchema,
} from './tasks.schema';

/**
 * Multer — in-memory storage so the Buffer is directly available for upload.
 * Limits: 5 MB per file, single image field named 'proof'.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

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

/**
 * PATCH /api/houses/:id/tasks/:taskId
 * Admin-only mutation of a pending task (deadline, title, rewardPoints, penaltyFine).
 */
houseTaskRoutes.patch(
  '/:taskId',
  validate({ params: houseTaskParamsSchema, body: updateTaskSchema }),
  asyncHandler(tasksController.updateTask),
);

// ---- Task-scoped routes (/api/tasks) ----
export const taskRoutes = Router();

taskRoutes.use(requireAuth);

/**
 * POST /api/tasks/:id/submit
 * Submit proof for a task. Accepts multipart/form-data with an optional
 * 'proof' image file. Only the assigned user can submit.
 */
taskRoutes.post(
  '/:id/submit',
  upload.single('proof'),
  validate({ params: taskIdParamsSchema }),
  asyncHandler(tasksController.submitTask),
);
