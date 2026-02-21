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
import { registerSchema, loginSchema, refreshSchema } from './auth.schema';
import { authLimiter } from '../../shared/middleware/rate-limiter';

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

export default router;
