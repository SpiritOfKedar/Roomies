/**
 * =============================================================================
 * Async Handler Wrapper
 * =============================================================================
 * Express doesn't natively catch errors from async route handlers.
 * This wrapper ensures that any rejected promise is forwarded to the
 * global error-handling middleware, eliminating the need for try/catch
 * blocks in every controller method.
 *
 * Usage:
 *   router.get('/path', asyncHandler(controller.method));
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps an async route handler to catch and forward errors to next().
 */
export function asyncHandler(fn: AsyncRouteHandler) {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
