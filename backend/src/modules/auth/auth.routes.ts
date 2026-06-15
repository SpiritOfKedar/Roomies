/**
 * =============================================================================
 * Auth Routes
 * =============================================================================
 * Public authentication endpoints — no JWT required.
 *
 * Routes:
 *   POST /api/auth/register  → Create account + get tokens
 *   POST /api/auth/login     → Authenticate + get tokens
 *   POST /api/auth/refresh   → Rotate tokens
 *   POST /api/auth/logout    → Revoke refresh token
 *
 * All inputs are validated via Zod schemas before reaching the controller.
 * =============================================================================
 */

import { Router } from 'express';
import { validate } from '../../shared/middleware/validate';
import { asyncHandler } from '../../shared/middleware/async-handler';
import * as authController from './auth.controller';
import { registerSchema, loginSchema, refreshSchema, googleIdTokenSchema } from './auth.schema';
import {
  recoveryEmailSchema,
  verifyQuestionsSchema,
  verifyTokenSchema,
  resetPasswordSchema,
} from './recovery.schema';
import { authLimiter, recoveryLimiter } from '../../shared/middleware/rate-limiter';

const router = Router();

/**
 * POST /api/auth/register
 * Public — creates a new user account.
 */
router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(authController.register),
);

/**
 * POST /api/auth/login
 * Public — authenticates existing user.
 */
router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(authController.login),
);

/**
 * POST /api/auth/refresh
 * Public — rotates token pair using a valid refresh token.
 */
router.post('/refresh', validate({ body: refreshSchema }), asyncHandler(authController.refresh));

/**
 * POST /api/auth/logout
 * Public — revokes the provided refresh token.
 */
router.post('/logout', validate({ body: refreshSchema }), asyncHandler(authController.logout));

/**
 * POST /api/auth/google
 * Public — verifies a Google ID token from the frontend.
 */
router.post(
  '/google',
  authLimiter,
  validate({ body: googleIdTokenSchema }),
  asyncHandler(authController.googleLogin),
);

/**
 * GET /api/auth/google
 * Public — starts the server-side Google OAuth redirect flow.
 */
router.get('/google', asyncHandler(authController.googleRedirect));

/**
 * GET /api/auth/google/callback
 * Public — Google OAuth redirect target; forwards tokens to the frontend.
 */
router.get('/google/callback', asyncHandler(authController.googleCallback));

router.post(
  '/recovery/options',
  recoveryLimiter,
  validate({ body: recoveryEmailSchema }),
  asyncHandler(authController.recoveryOptions),
);

router.post(
  '/recovery/email',
  recoveryLimiter,
  validate({ body: recoveryEmailSchema }),
  asyncHandler(authController.recoveryEmail),
);

router.post(
  '/recovery/verify-questions',
  recoveryLimiter,
  validate({ body: verifyQuestionsSchema }),
  asyncHandler(authController.recoveryVerifyQuestions),
);

router.get(
  '/recovery/verify-token',
  recoveryLimiter,
  validate({ query: verifyTokenSchema }),
  asyncHandler(authController.recoveryVerifyToken),
);

router.post(
  '/recovery/reset-password',
  recoveryLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(authController.recoveryResetPassword),
);

export default router;
