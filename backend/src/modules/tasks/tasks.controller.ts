/**
 * =============================================================================
 * Tasks Controller — HTTP Handler Layer
 * =============================================================================
 * Thin controller for task-related endpoints.
 * Delegates all logic to tasks.service.ts.
 * =============================================================================
 */

import { Request, Response } from 'express';
import { sendSuccess, sendPaginated } from '../../shared/utils/api-response';
import * as tasksService from './tasks.service';
import { uploadImage } from '../../shared/utils/storage';
import type {
  AssignTaskInput,
  TaskIdParams,
  HouseIdParams,
  PaginationQuery,
  UpdateTaskInput,
  HouseTaskParams,
} from './tasks.schema';

/**
 * POST /api/houses/:id/tasks/assign
 * Triggers the rotation engine to assign a task to the next member.
 */
export async function assignTask(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const { title, deadline, assignedTo, weight } = req.body as AssignTaskInput;

  const task = await tasksService.assignNextTask(userId, houseId, title, deadline, assignedTo, weight);

  sendSuccess(res, task, 201);
}

/**
 * POST /api/tasks/:id/submit
 * Submits proof for a task.
 * Accepts multipart/form-data with an optional 'proof' image file.
 * If a file is provided it is uploaded via storage.uploadImage and the
 * resulting URL is stored on the task. Falls back to a body 'imageUrl'
 * string when no file is attached (useful for integration tests).
 */
export async function submitTask(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId } = req.params as unknown as TaskIdParams;

  // Resolve proof URL: prefer uploaded file over plain URL string
  let imageUrl: string | undefined;
  if (req.file) {
    imageUrl = await uploadImage(req.file.buffer, req.file.mimetype);
  } else {
    const body = req.body as Record<string, unknown>;
    if (typeof body.imageUrl === 'string' && body.imageUrl) {
      imageUrl = body.imageUrl;
    }
  }

  const task = await tasksService.submitTask(userId, taskId, imageUrl);

  sendSuccess(res, task);
}

/**
 * GET /api/houses/:id/tasks
 * Returns paginated tasks for a house.
 */
export async function getTasksByHouse(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const { limit, offset } = req.query as unknown as PaginationQuery;

  const result = await tasksService.getTasksByHouse(userId, houseId, limit, offset);

  sendPaginated(res, result.tasks, result.total, result.limit, result.offset);
}

/**
 * PATCH /api/houses/:id/tasks/:taskId
 * Admin-only mutation of a pending task's fields.
 */
export async function updateTask(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId, taskId } = req.params as unknown as HouseTaskParams;
  const data = req.body as UpdateTaskInput;

  const task = await tasksService.updateTask(userId, houseId, taskId, data);

  sendSuccess(res, task);
}
