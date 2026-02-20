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
import type {
  AssignTaskInput,
  SubmitTaskInput,
  TaskIdParams,
  HouseIdParams,
  PaginationQuery,
} from './tasks.schema';

/**
 * POST /api/houses/:id/tasks/assign
 * Triggers the rotation engine to assign a task to the next member.
 */
export async function assignTask(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const { title, deadline } = req.body as AssignTaskInput;

  const task = await tasksService.assignNextTask(userId, houseId, title, deadline);

  sendSuccess(res, task, 201);
}

/**
 * POST /api/tasks/:id/submit
 * Submits proof for a task (changes status to 'submitted').
 */
export async function submitTask(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId } = req.params as unknown as TaskIdParams;
  const { imageUrl } = (req.body || {}) as SubmitTaskInput;

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
