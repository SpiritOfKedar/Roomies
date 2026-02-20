/**
 * =============================================================================
 * House Routes
 * =============================================================================
 * All house-related endpoints. Protected by JWT authentication.
 *
 * Routes:
 *   POST   /api/houses          → Create a new house
 *   GET    /api/houses          → List user's houses
 *   GET    /api/houses/:id      → Get house details + members
 *   POST   /api/houses/:id/join → Join a house
 * =============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as houseController from './house.controller';
import { createHouseSchema, houseIdParamsSchema } from './house.schema';

const router = Router();

// All house routes require authentication
router.use(requireAuth);

/**
 * POST /api/houses
 * Create a new house. Creator becomes admin.
 */
router.post('/', validate({ body: createHouseSchema }), asyncHandler(houseController.createHouse));

/**
 * GET /api/houses
 * List all houses the user belongs to.
 */
router.get('/', asyncHandler(houseController.getUserHouses));

/**
 * GET /api/houses/:id
 * Get house details and members. Must be a member.
 */
router.get(
  '/:id',
  validate({ params: houseIdParamsSchema }),
  asyncHandler(houseController.getHouse),
);

/**
 * POST /api/houses/:id/join
 * Join an existing house.
 */
router.post(
  '/:id/join',
  validate({ params: houseIdParamsSchema }),
  asyncHandler(houseController.joinHouse),
);

export default router;
