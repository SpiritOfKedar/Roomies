/**
 * =============================================================================
 * Auth Controller — HTTP Handler Layer
 * =============================================================================
 * Thin controller that extracts request data, calls auth service methods,
 * and returns standardized API responses.
 *
 * No business logic or database calls here — everything is delegated
 * to auth.service.ts.
 * =============================================================================
 */

import { Request, Response } from 'express';
import { sendSuccess } from '../../shared/utils/api-response';
import * as authService from './auth.service';
import type { RegisterInput, LoginInput, RefreshInput } from './auth.schema';

/**
 * POST /auth/register
 * Creates a new user account and returns tokens.
 */
export async function register(req: Request, res: Response): Promise<void> {
    const input = req.body as RegisterInput;

    const result = await authService.register(input, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
    });

    sendSuccess(res, result, 201);
}

/**
 * POST /auth/login
 * Authenticates a user and returns tokens.
 */
export async function login(req: Request, res: Response): Promise<void> {
    const input = req.body as LoginInput;

    const result = await authService.login(input, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
    });

    sendSuccess(res, result);
}

/**
 * POST /auth/refresh
 * Rotates the refresh token and issues a new token pair.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as RefreshInput;

    const tokens = await authService.refresh(refreshToken, {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
    });

    sendSuccess(res, tokens);
}

/**
 * POST /auth/logout
 * Revokes the provided refresh token.
 * Returns 200 regardless of whether the token was found (idempotent).
 */
export async function logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body as RefreshInput;

    await authService.logout(refreshToken);

    sendSuccess(res, { message: 'Logged out successfully' });
}
