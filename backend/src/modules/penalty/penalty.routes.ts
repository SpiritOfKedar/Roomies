/**
 * =============================================================================
 * Penalty Routes
 * =============================================================================
 * Penalty-related endpoints. All protected by JWT authentication.
 *
 * House-scoped routes (mounted under /api/houses):
 *   POST /api/houses/:houseId/penalties/:penaltyId/settle
 *     → Mark an outstanding penalty as settled (admin only)
 * =============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as penaltyController from './penalty.controller';

export const penaltyRoutes = Router({ mergeParams: true });

penaltyRoutes.use(requireAuth);

/**
 * POST /api/houses/:houseId/penalties/:penaltyId/settle
 *
 * Transitions a penalty from 'unpaid' → 'settled'.
 * Requires: JWT auth + house admin role.
 */
penaltyRoutes.post('/:penaltyId/settle', asyncHandler(penaltyController.settlePenalty));
