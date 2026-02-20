import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as leaderboardController from './leaderboard.controller';
import { z } from 'zod';

const houseIdParamsSchema = z.object({
  id: z.string().uuid('Invalid house ID'),
});

export const leaderboardRoutes = Router();

leaderboardRoutes.use(requireAuth);

/**
 * GET /api/leaderboard/:id
 * Retrieve the active leaderboard for a house.
 */
leaderboardRoutes.get(
  '/:id/leaderboard',
  validate({ params: houseIdParamsSchema }),
  asyncHandler(leaderboardController.getHouseLeaderboard),
);
