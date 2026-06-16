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
import * as votingController from '../voting/voting.controller';
import {
  assignTaskSchema,
  taskIdParamsSchema,
  houseIdParamsSchema,
  paginationQuerySchema,
  updateTaskSchema,
  houseTaskParamsSchema,
  createTaskCommentSchema,
  taskCommentParamsSchema,
  choreIdParamsSchema,
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
 * GET /api/houses/:id/tasks/vote-statuses?taskIds=id1,id2,...
 * Returns vote status for multiple tasks in one request (eliminates N+1 from task list).
 * Must be declared before /:taskId to avoid route conflict.
 */
houseTaskRoutes.get(
  '/vote-statuses',
  validate({ params: houseIdParamsSchema }),
  asyncHandler(votingController.getVoteStatusBatch),
);

/**
 * POST /api/houses/:id/tasks/:taskId
 * Admin-only mutation of a pending, submitted, or disputed task.
 */
houseTaskRoutes.patch(
  '/:taskId',
  validate({ params: houseTaskParamsSchema, body: updateTaskSchema }),
  asyncHandler(tasksController.updateTask),
);

/**
 * DELETE /api/houses/:id/tasks/:taskId
 * Admin-only delete of a pending task.
 */
houseTaskRoutes.delete(
  '/:taskId',
  validate({ params: houseTaskParamsSchema }),
  asyncHandler(tasksController.deleteTask),
);

// ---- House-scoped chore routes (/api/houses/:id/chores) ----
export const houseChoreRoutes = Router({ mergeParams: true });

houseChoreRoutes.use(requireAuth);

houseChoreRoutes.post(
  '/assign',
  validate({ params: houseIdParamsSchema, body: assignTaskSchema }),
  asyncHandler(tasksController.assignChore),
);

houseChoreRoutes.get(
  '/',
  validate({ params: houseIdParamsSchema, query: paginationQuerySchema }),
  asyncHandler(tasksController.getChoresByHouse),
);

// ---- Chore-scoped routes (/api/chores) ----
export const choreRoutes = Router();

choreRoutes.use(requireAuth);

choreRoutes.get(
  '/:id/thread',
  validate({ params: choreIdParamsSchema }),
  asyncHandler(tasksController.getChoreThread),
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

/**
 * GET /api/tasks/:id
 */
taskRoutes.get(
  '/:id',
  validate({ params: taskIdParamsSchema }),
  asyncHandler(tasksController.getTaskById),
);

/**
 * GET /api/tasks/:id/history
 */
taskRoutes.get(
  '/:id/thread',
  validate({ params: taskIdParamsSchema }),
  asyncHandler(tasksController.getChoreThreadForTask),
);

taskRoutes.get(
  '/:id/history',
  validate({ params: taskIdParamsSchema }),
  asyncHandler(tasksController.getTaskHistory),
);

taskRoutes.get(
  '/:id/feed',
  validate({ params: taskIdParamsSchema }),
  asyncHandler(tasksController.getTaskFeed),
);

taskRoutes.post(
  '/:id/comments',
  upload.single('image'),
  validate({ params: taskIdParamsSchema, body: createTaskCommentSchema }),
  asyncHandler(tasksController.createTaskComment),
);

taskRoutes.delete(
  '/:id/comments/:commentId',
  validate({ params: taskCommentParamsSchema }),
  asyncHandler(tasksController.deleteTaskComment),
);
