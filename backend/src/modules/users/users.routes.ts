/**
 * =============================================================================
 * Users Routes
 * =============================================================================
 * All user-related endpoints. Protected by JWT authentication.
 *
 * Routes:
 *   GET /api/users/me → Get authenticated user's profile
 * =============================================================================
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as usersController from './users.controller';

const router = Router();

/**
 * GET /api/users/me
 * Returns the logged-in user's profile.
 * Protected — requires valid access token.
 */
router.get('/me', requireAuth, asyncHandler(usersController.getMe));

export default router;
