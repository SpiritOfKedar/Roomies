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
  CreateTaskCommentInput,
  TaskCommentParams,
} from './tasks.schema';

/**
 * POST /api/houses/:id/tasks/assign
 * Triggers the rotation engine to assign a task to the next member.
 */
export async function assignTask(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const { title, deadline, assignedTo, weight, isRecurring, cronSchedule } = req.body as AssignTaskInput;

  const task = await tasksService.assignNextTask(userId, houseId, title, deadline, assignedTo, weight, isRecurring, cronSchedule);

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

  const body = req.body as Record<string, unknown>;
  const clarification =
    typeof body.note === 'string' ? body.note : typeof body.clarification === 'string' ? body.clarification : undefined;

  const task = await tasksService.submitTask(userId, taskId, imageUrl, clarification);

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

/**
 * GET /api/tasks/:id
 */
export async function getTaskById(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId } = req.params as unknown as TaskIdParams;

  const task = await tasksService.getTaskById(userId, taskId);

  sendSuccess(res, task);
}

/**
 * GET /api/tasks/:id/history
 */
export async function getTaskHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId } = req.params as unknown as TaskIdParams;

  const history = await tasksService.getTaskHistory(userId, taskId);

  sendSuccess(res, history);
}

/**
 * DELETE /api/houses/:id/tasks/:taskId
 */
export async function deleteTask(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId, taskId } = req.params as unknown as HouseTaskParams;

  const result = await tasksService.deleteTask(userId, houseId, taskId);

  sendSuccess(res, result);
}

/**
 * GET /api/tasks/:id/feed
 */
export async function getTaskFeed(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId } = req.params as unknown as TaskIdParams;

  const feed = await tasksService.getTaskFeed(userId, taskId);

  sendSuccess(res, feed);
}

/**
 * POST /api/tasks/:id/comments
 */
export async function createTaskComment(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId } = req.params as unknown as TaskIdParams;
  const { body, parentId } = req.body as CreateTaskCommentInput;

  let imageUrl: string | undefined;
  if (req.file) {
    imageUrl = await uploadImage(req.file.buffer, req.file.mimetype);
  }

  const comment = await tasksService.createTaskComment(userId, taskId, body, parentId, imageUrl);

  sendSuccess(res, comment, 201);
}

/**
 * DELETE /api/tasks/:id/comments/:commentId
 */
export async function deleteTaskComment(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId, commentId } = req.params as unknown as TaskCommentParams;

  const result = await tasksService.deleteTaskComment(userId, taskId, commentId);

  sendSuccess(res, result);
}
