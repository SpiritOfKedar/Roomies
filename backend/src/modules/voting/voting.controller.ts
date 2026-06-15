import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/api-response';
import * as votingService from './voting.service';
import type { CastVoteInput, TaskIdParams } from './voting.schema';
import type { HouseIdParams } from '../tasks/tasks.schema';

/**
 * POST /api/tasks/:id/vote
 */
export async function castVote(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId } = req.params as unknown as TaskIdParams;
  const { vote, reason } = req.body as CastVoteInput;

  const result = await votingService.castVote(userId, taskId, vote, reason);

  sendSuccess(res, result);
}

/**
 * GET /api/tasks/:id/votes
 */
export async function getVoteStatus(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId } = req.params as unknown as TaskIdParams;

  const result = await votingService.getVoteStatus(userId, taskId);

  sendSuccess(res, result);
}

/**
 * GET /api/houses/:id/tasks/vote-statuses?taskIds=id1,id2,...
 * Returns vote status for multiple tasks in a single request.
 */
export async function getVoteStatusBatch(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as unknown as HouseIdParams;
  const raw = (req.query.taskIds as string | undefined) ?? '';
  const taskIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const result = await votingService.getVoteStatusBatch(userId, houseId, taskIds);

  sendSuccess(res, result);
}
