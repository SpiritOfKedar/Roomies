import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as votingController from './voting.controller';
import { castVoteSchema, taskIdParamsSchema } from './voting.schema';

export const votingRoutes = Router();

votingRoutes.use(requireAuth);

votingRoutes.post(
  '/:id/vote',
  validate({ params: taskIdParamsSchema, body: castVoteSchema }),
  asyncHandler(votingController.castVote),
);

votingRoutes.get(
  '/:id/votes',
  validate({ params: taskIdParamsSchema }),
  asyncHandler(votingController.getVoteStatus),
);
