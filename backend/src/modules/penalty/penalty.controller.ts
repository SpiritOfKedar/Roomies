/**
 * =============================================================================
 * Penalty Controller — HTTP Handler Layer
 * =============================================================================
 * Thin controller for penalty-related endpoints.
 * Delegates all business logic to penalty.service.ts.
 * =============================================================================
 */

import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/api-response';
import * as penaltyService from './penalty.service';
import { z } from 'zod';

const settleParamsSchema = z.object({
  houseId: z.string().uuid('Invalid house ID'),
  penaltyId: z.string().uuid('Invalid penalty ID'),
});

/**
 * POST /api/houses/:houseId/penalties/:penaltyId/settle
 *
 * Settle an outstanding penalty.
 * Only the house admin may call this endpoint.
 */
export async function settlePenalty(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;

  const { houseId, penaltyId } = settleParamsSchema.parse(req.params);

  const penalty = await penaltyService.settlePenalty(userId, houseId, penaltyId);

  sendSuccess(res, penalty);
}
