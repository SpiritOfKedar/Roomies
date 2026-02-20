/**
 * =============================================================================
 * Global Error Handler Middleware
 * =============================================================================
 * Catches all errors thrown in route handlers and services.
 * - AppError instances → structured response with correct HTTP status.
 * - Prisma known errors → user-friendly conflict/not-found messages.
 * - Unknown errors → 500 Internal Server Error (details hidden in production).
 * =============================================================================
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { sendError } from '../utils/api-response';
import { logger } from '../utils/logger';
import { ZodError } from 'zod';

/**
 * Type guard for Prisma known request errors.
 * Avoids direct import of Prisma runtime types which differ across versions.
 */
function isPrismaKnownError(err: unknown): err is { code: string; meta?: Record<string, unknown> } {
    if (typeof err !== 'object' || err === null) return false;
    const record = err as Record<string, unknown>;
    return 'code' in record && typeof record.code === 'string' && record.code.startsWith('P');
}

/**
 * Express error-handling middleware.
 * Must have 4 parameters to be recognized as an error handler.
 */
export function globalErrorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    // --- Operational errors (expected, thrown intentionally) ---
    if (err instanceof AppError) {
        logger.warn({ statusCode: err.statusCode, message: err.message }, 'Operational error');
        sendError(res, err.message, err.statusCode);
        return;
    }

    // --- Zod validation errors (Zod v4 uses `.issues`) ---
    if (err instanceof ZodError) {
        const formatted = err.issues
            .map((e) => `${(e.path as (string | number)[]).join('.')}: ${e.message}`)
            .join('; ');
        logger.warn({ issues: err.issues }, 'Validation error');
        sendError(res, `Validation failed: ${formatted}`, 422);
        return;
    }

    // --- Prisma known request errors ---
    if (isPrismaKnownError(err)) {
        if (err.code === 'P2002') {
            const target = (err.meta?.target as string[])?.join(', ') || 'field';
            sendError(res, `A record with this ${target} already exists`, 409);
            return;
        }
        if (err.code === 'P2025') {
            sendError(res, 'The requested record was not found', 404);
            return;
        }
    }

    // --- Unknown / unexpected errors ---
    logger.error({ err, stack: err.stack }, 'Unhandled error');

    const message =
        process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

    sendError(res, message, 500);
}
