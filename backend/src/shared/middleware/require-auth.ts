/**
 * =============================================================================
 * Authentication Middleware — JWT Verification
 * =============================================================================
 * Extracts the Bearer token from the Authorization header, verifies it,
 * and attaches the decoded user payload to `req.user`.
 *
 * Usage in routes:
 *   router.get('/protected', requireAuth, controller.method);
 *
 * On failure:
 *   - Missing header → 401 "Authorization header required"
 *   - Malformed header → 401 "Bearer token required"
 *   - Invalid/expired → 401 (from jwt.ts verifyAccessToken)
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/app-error';

/**
 * Express middleware that enforces JWT authentication.
 * Must be placed before any route handler that requires a logged-in user.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw UnauthorizedError('Authorization header required');
  }

  // Expect format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw UnauthorizedError('Bearer token required');
  }

  const token = parts[1];

  // verifyAccessToken throws UnauthorizedError on failure
  const payload = verifyAccessToken(token);

  // Attach decoded payload to request for downstream handlers
  // Type-safe via the express.d.ts augmentation from Phase 1
  req.user = {
    userId: payload.userId,
    email: '', // Email is not in the access token payload; populated by service if needed
  };

  next();
}
