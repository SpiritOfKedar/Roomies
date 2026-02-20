import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as votingController from './voting.controller';
import { castVoteSchema, taskIdParamsSchema } from './voting.schema';

export const votingRoutes = Router();

votingRoutes.use(requireAuth);

/**
 * POST /api/tasks/:id/vote
 * Cast an approve/reject vote on a task proof.
 */
votingRoutes.post(
  '/:id/vote',
  validate({ params: taskIdParamsSchema, body: castVoteSchema }),
  asyncHandler(votingController.castVote),
);
