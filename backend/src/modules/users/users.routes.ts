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
import { validate } from '../../shared/middleware/validate';
import {
  setSecurityQuestionsSchema,
  deleteSecurityQuestionsSchema,
} from '../auth/recovery.schema';
import * as usersController from './users.controller';

const router = Router();

/**
 * GET /api/users/me
 * Returns the logged-in user's profile.
 * Protected — requires valid access token.
 */
router.get('/me', requireAuth, asyncHandler(usersController.getMe));

router.get('/me/recovery', requireAuth, asyncHandler(usersController.getRecoveryStatus));

router.put(
  '/me/security-questions',
  requireAuth,
  validate({ body: setSecurityQuestionsSchema }),
  asyncHandler(usersController.setSecurityQuestions),
);

router.delete(
  '/me/security-questions',
  requireAuth,
  validate({ body: deleteSecurityQuestionsSchema }),
  asyncHandler(usersController.deleteSecurityQuestions),
);

export default router;
