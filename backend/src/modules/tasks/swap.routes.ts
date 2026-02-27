/**
 * =============================================================================
 * Task Swap Routes
 * =============================================================================
 * Chore marketplace endpoints. All protected by JWT authentication.
 * Mounted at /api/houses/:id/swaps
 *
 *   POST /api/houses/:id/swaps                    → proposeSwap
 *   POST /api/houses/:id/swaps/:swapId/resolve    → resolveSwap
 * =============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as swapController from './swap.controller';
import {
  houseIdParamsSchema,
  swapParamsSchema,
  proposeSwapSchema,
  resolveSwapSchema,
} from './swap.schema';

export const swapRoutes = Router({ mergeParams: true });

swapRoutes.use(requireAuth);

/**
 * POST /api/houses/:id/swaps
 * Propose a task swap with another house member.
 */
swapRoutes.post(
  '/',
  validate({ params: houseIdParamsSchema, body: proposeSwapSchema }),
  asyncHandler(swapController.proposeSwap),
);

/**
 * POST /api/houses/:id/swaps/:swapId/resolve
 * Accept or reject a pending swap proposal.
 */
swapRoutes.post(
  '/:swapId/resolve',
  validate({ params: swapParamsSchema, body: resolveSwapSchema }),
  asyncHandler(swapController.resolveSwap),
);
