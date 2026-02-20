import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/api-response';
import * as votingService from './voting.service';
import type { CastVoteInput, TaskIdParams } from './voting.schema';

/**
 * POST /api/tasks/:id/vote
 * Cast a vote on a submitted task. Requires house membership.
 */
export async function castVote(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: taskId } = req.params as unknown as TaskIdParams;
  const { vote } = req.body as CastVoteInput;

  const result = await votingService.castVote(userId, taskId, vote);

  sendSuccess(res, result);
}
