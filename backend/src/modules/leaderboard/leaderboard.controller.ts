import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/api-response';
import * as leaderboardService from './leaderboard.service';
// Validation schema is handled in the routes file.

/**
 * GET /api/houses/:id/leaderboard
 * Fetch the leaderboard for a specific house.
 */
export async function getHouseLeaderboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: houseId } = req.params as { id: string };

  const leaderboard = await leaderboardService.getHouseLeaderboard(houseId, userId);

  sendSuccess(res, leaderboard);
}
