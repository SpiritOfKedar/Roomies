/**
 * =============================================================================
 * Express Request Type Augmentation
 * =============================================================================
 * Extends the Express Request interface to include the authenticated user
 * payload from JWT verification. This gives us type-safe access to
 * `req.user` throughout the application.
 * =============================================================================
 */

export interface JwtPayload {
  /** User UUID */
  userId: string;
  /** User email */
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      /** Populated by the auth middleware after JWT verification */
      user?: JwtPayload;
    }
  }
}
