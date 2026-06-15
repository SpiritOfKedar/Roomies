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
import {
  createHouseSchema,
  houseIdParamsSchema,
  memberParamsSchema,
  updateMemberStatusBodySchema,
  addMemberByEmailSchema,
} from './house.schema';

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
 * POST /api/houses/join
 * Join a house using an invite code. Body: { inviteCode: string }
 * Must be placed before /:id routes to avoid route conflicts.
 */
router.post('/join', asyncHandler(houseController.joinByInviteCode));

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
 * GET /api/houses/:id/dashboard
 * Aggregate house page data (house + tasks + vote statuses).
 */
router.get(
  '/:id/dashboard',
  validate({ params: houseIdParamsSchema }),
  asyncHandler(houseController.getHouseDashboard),
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

/**
 * POST /api/houses/:id/members/email
 * Add a member to a house by their email address.
 * Admin only.
 */
router.post(
  '/:id/members/email',
  validate({ params: houseIdParamsSchema, body: addMemberByEmailSchema }),
  asyncHandler(houseController.addMemberByEmail),
);

/**
 * PATCH /api/houses/:id/members/:userId
 * Update a member's status. Admins may update any member; users may update themselves (leave / vacation).
 */
router.patch(
  '/:id/members/:userId',
  validate({ params: memberParamsSchema, body: updateMemberStatusBodySchema }),
  asyncHandler(houseController.updateMemberStatus),
);

/**
 * POST /api/houses/:id/leave
 * Leave the house (sets membership to inactive).
 */
router.post(
  '/:id/leave',
  validate({ params: houseIdParamsSchema }),
  asyncHandler(houseController.leaveHouse),
);

export default router;
