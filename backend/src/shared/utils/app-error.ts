/**
 * =============================================================================
 * Application Error Class
 * =============================================================================
 * Custom error class that carries an HTTP status code.
 * Service-layer code throws AppError instances, and the centralized
 * error-handling middleware converts them into proper API responses.
 *
 * This keeps business logic clean — services throw, controllers don't
 * need try/catch boilerplate, and the middleware handles everything.
 * =============================================================================
 */

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    /**
     * @param message  - Human-readable error description
     * @param statusCode - HTTP status code (default: 400)
     * @param isOperational - Whether this is an expected error (true) or a bug (false)
     */
    constructor(message: string, statusCode = 400, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        // Maintain proper prototype chain for instanceof checks
        Object.setPrototypeOf(this, AppError.prototype);

        // Capture stack trace, excluding the constructor call from it
        Error.captureStackTrace(this, this.constructor);
    }
}

// ---- Common error factory functions ----

export const NotFoundError = (resource: string): AppError =>
    new AppError(`${resource} not found`, 404);

export const UnauthorizedError = (message = 'Unauthorized'): AppError =>
    new AppError(message, 401);

export const ForbiddenError = (message = 'Forbidden'): AppError =>
    new AppError(message, 403);

export const ConflictError = (message: string): AppError =>
    new AppError(message, 409);

export const ValidationError = (message: string): AppError =>
    new AppError(message, 422);
