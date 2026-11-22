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
import crypto from 'crypto';
import type {
  RegisterInput,
  LoginInput,
  RefreshInput,
  GoogleIdTokenInput,
  GoogleExchangeInput,
} from './auth.schema';
import { putValue, takeValue } from '../../shared/cache/ephemeral-store';
import { UnauthorizedError } from '../../shared/utils/app-error';
import type {
  RecoveryEmailInput,
  VerifyQuestionsInput,
  VerifyTokenInput,
  ResetPasswordInput,
} from './recovery.schema';
import * as recoveryService from './recovery.service';
import { getGoogleAuthUrl } from '../../shared/utils/google-oauth';
import { env } from '../../shared/utils/env';

/** Lifetime of the one-time code that carries a Google sign-in to the frontend. */
const GOOGLE_CODE_TTL_SEC = 60;
const googleCodeKey = (code: string) => `oauth:google:${code}`;

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

/**
 * POST /auth/google
 * Verifies a Google ID token from the frontend GIS button.
 */
export async function googleLogin(req: Request, res: Response): Promise<void> {
  const { idToken } = req.body as GoogleIdTokenInput;

  const result = await authService.googleLoginWithIdToken(idToken, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  sendSuccess(res, result);
}

/**
 * GET /auth/google
 * Redirects the browser to Google's OAuth consent screen.
 */
export async function googleRedirect(_req: Request, res: Response): Promise<void> {
  const url = getGoogleAuthUrl();
  res.redirect(url);
}

/**
 * GET /auth/google/callback
 * Handles Google's redirect, issues JWTs, and sends the user back to the frontend.
 */
export async function googleCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  const oauthError = req.query.error as string | undefined;

  if (oauthError || !code) {
    const message = oauthError ?? 'missing_code';
    res.redirect(`${env.CORS_ORIGIN}/auth/google/callback?error=${encodeURIComponent(message)}`);
    return;
  }

  try {
    const result = await authService.googleLoginWithCode(code, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });

    // Never put session tokens in a URL (browser history, logs, Referer).
    // Hand the frontend a short-lived one-time code it exchanges via POST.
    const oneTimeCode = crypto.randomBytes(32).toString('hex');
    await putValue(googleCodeKey(oneTimeCode), JSON.stringify(result.tokens), GOOGLE_CODE_TTL_SEC);
    res.redirect(`${env.CORS_ORIGIN}/auth/google/callback?code=${oneTimeCode}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'google_auth_failed';
    res.redirect(`${env.CORS_ORIGIN}/auth/google/callback?error=${encodeURIComponent(message)}`);
  }
}

/**
 * POST /auth/google/exchange
 * Swaps the one-time code from the Google redirect for the session tokens.
 */
export async function googleExchange(req: Request, res: Response): Promise<void> {
  const { code } = req.body as GoogleExchangeInput;

  const stored = await takeValue(googleCodeKey(code));
  if (!stored) {
    throw UnauthorizedError('This sign-in link has expired. Please sign in with Google again.');
  }

  sendSuccess(res, JSON.parse(stored) as authService.AuthTokens);
}

export async function recoveryOptions(req: Request, res: Response): Promise<void> {
  const input = req.body as RecoveryEmailInput;
  const options = await recoveryService.getRecoveryOptions(input);
  sendSuccess(res, options);
}

export async function recoveryEmail(req: Request, res: Response): Promise<void> {
  const input = req.body as RecoveryEmailInput;
  await recoveryService.sendRecoveryEmail(input);
  sendSuccess(res, { message: 'If an account exists, a reset link has been sent.' });
}

export async function recoveryVerifyQuestions(req: Request, res: Response): Promise<void> {
  const input = req.body as VerifyQuestionsInput;
  const result = await recoveryService.verifySecurityQuestions(input, { ipAddress: req.ip });
  sendSuccess(res, result);
}

export async function recoveryVerifyToken(req: Request, res: Response): Promise<void> {
  const input = req.query as unknown as VerifyTokenInput;
  const result = await recoveryService.verifyRecoveryToken(input);
  sendSuccess(res, result);
}

export async function recoveryResetPassword(req: Request, res: Response): Promise<void> {
  const input = req.body as ResetPasswordInput;
  await recoveryService.resetPassword(input);
  sendSuccess(res, { message: 'Password updated successfully' });
}
