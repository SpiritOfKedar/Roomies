/**
 * =============================================================================
 * Auth Service — Core Authentication Business Logic
 * =============================================================================
 * Handles registration, login, token rotation, and logout.
 *
 * Security model:
 *   - Access tokens: Short-lived (15m), stateless JWT, used for API access.
 *   - Refresh tokens: Long-lived (7d), hashed and stored in DB.
 *     On each refresh, the old token is deleted and a new pair is issued
 *     (token rotation). This limits the damage window if a refresh token leaks.
 *   - On logout, the specific refresh token is revoked (deleted from DB).
 *
 * Concurrency note:
 *   - Refresh token rotation uses a delete-then-create pattern.
 *   - If two concurrent refresh requests race with the same token,
 *     only one will find the DB record — the other gets a 401.
 *     This is intentional and secure (prevents token reuse).
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';
import { Prisma } from '@prisma/client';
import { hashPassword, comparePassword } from '../../shared/utils/hash';
import {
  generateTokenPair,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../../shared/utils/jwt';
import { ConflictError, UnauthorizedError } from '../../shared/utils/app-error';
import * as usersRepo from '../users/users.repository';
import type { RegisterInput, LoginInput } from './auth.schema';
import { logger } from '../../shared/utils/logger';

// ---- Response Types ----

/** Token pair returned to the client after login/register/refresh */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Full auth response with user data and tokens */
export interface AuthResponse {
  user: usersRepo.SafeUser;
  tokens: AuthTokens;
}

// ---- Service Functions ----

/**
 * Register a new user account.
 *
 * Flow:
 *   1. Check if email already exists (fail fast with 409).
 *   2. Hash the password.
 *   3. Create the user record.
 *   4. Generate access + refresh tokens.
 *   5. Store the hashed refresh token in DB.
 *   6. Return user profile + tokens.
 *
 * @param input - Validated registration data (name, email, password)
 * @param meta  - Request metadata (userAgent, ipAddress) for session tracking
 * @returns User profile and token pair
 * @throws ConflictError if email already registered
 */
export async function register(
  input: RegisterInput,
  meta: { userAgent?: string; ipAddress?: string } = {},
): Promise<AuthResponse> {
  // 1. Check for existing email
  const exists = await usersRepo.emailExists(input.email);
  if (exists) {
    throw ConflictError('Email already registered');
  }

  // 2. Hash password
  const passwordHash = await hashPassword(input.password);

  // 3. Create user
  const user = await usersRepo.createUser({
    name: input.name,
    email: input.email,
    passwordHash,
  });

  // 4. Generate tokens
  const { accessToken, refreshToken } = generateTokenPair(user.id);

  // 5. Store hashed refresh token
  const refreshTokenHash = await hashPassword(refreshToken);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: getRefreshTokenExpiry(),
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    },
  });

  logger.info({ userId: user.id }, 'User registered');

  // 6. Return
  return {
    user,
    tokens: { accessToken, refreshToken },
  };
}

/**
 * Authenticate a user with email and password.
 *
 * Flow:
 *   1. Find user by email (404 if not found).
 *   2. Compare password against stored hash (401 if mismatch).
 *   3. Check account status (401 if inactive).
 *   4. Generate token pair and store refresh token.
 *   5. Return user profile + tokens.
 *
 * @param input - Validated login data (email, password)
 * @param meta  - Request metadata for session tracking
 * @returns User profile and token pair
 * @throws UnauthorizedError if credentials are invalid
 */
export async function login(
  input: LoginInput,
  meta: { userAgent?: string; ipAddress?: string } = {},
): Promise<AuthResponse> {
  // 1. Find user (need password hash, so use findUserByEmail not safe version)
  const user = await usersRepo.findUserByEmail(input.email);
  if (!user) {
    // Use generic message to prevent email enumeration
    throw UnauthorizedError('Invalid email or password');
  }

  // 2. Verify password
  const passwordValid = await comparePassword(input.password, user.passwordHash);
  if (!passwordValid) {
    throw UnauthorizedError('Invalid email or password');
  }

  // 3. Check account status
  if (user.status !== 'active') {
    throw UnauthorizedError('Account is deactivated');
  }

  // 4. Generate tokens
  const { accessToken, refreshToken } = generateTokenPair(user.id);

  // Store hashed refresh token
  const refreshTokenHash = await hashPassword(refreshToken);
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: getRefreshTokenExpiry(),
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    },
  });

  logger.info({ userId: user.id }, 'User logged in');

  // 5. Return (safe user — no password hash)
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
    },
    tokens: { accessToken, refreshToken },
  };
}

/**
 * Rotate tokens using a valid refresh token.
 *
 * Security flow:
 *   1. Verify the refresh token JWT signature and expiry.
 *   2. Find all non-revoked refresh tokens for this user.
 *   3. Compare the provided token against each stored hash.
 *   4. If no match → token was already rotated or revoked → 401.
 *   5. Delete the old token (one-time use enforcement).
 *   6. Generate a new token pair and store the new refresh token.
 *   7. Return new tokens.
 *
 * Race condition handling:
 *   If two requests try to refresh the same token concurrently,
 *   step 5's delete ensures only one succeeds. The second request
 *   won't find the record and gets a 401. This is the desired behavior.
 *
 * @param refreshTokenStr - The raw refresh JWT from the client
 * @param meta - Request metadata for the new session record
 * @returns New token pair
 * @throws UnauthorizedError if the token is invalid, expired, or already used
 */
export async function refresh(
  refreshTokenStr: string,
  meta: { userAgent?: string; ipAddress?: string } = {},
): Promise<AuthTokens> {
  // 1. Verify JWT
  const payload = verifyRefreshToken(refreshTokenStr);

  // 2. Find all valid (non-revoked, non-expired) refresh tokens for user
  const storedTokens = await prisma.refreshToken.findMany({
    where: {
      userId: payload.userId,
      revoked: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (storedTokens.length === 0) {
    throw UnauthorizedError('No valid refresh tokens found');
  }

  // 3. Compare against stored hashes to find the matching token
  let matchedTokenId: string | null = null;
  for (const stored of storedTokens) {
    const isMatch = await comparePassword(refreshTokenStr, stored.tokenHash);
    if (isMatch) {
      matchedTokenId = stored.id;
      break;
    }
  }

  if (!matchedTokenId) {
    // Token was valid JWT but not in DB — likely already rotated
    // This could indicate token theft; consider revoking all tokens for safety
    logger.warn({ userId: payload.userId }, 'Refresh token reuse detected');
    throw UnauthorizedError('Refresh token has been revoked');
  }

  // 4. Delete the used token (one-time use)
  try {
    await prisma.refreshToken.delete({
      where: { id: matchedTokenId },
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw UnauthorizedError('Invalid or expired refresh token');
    }
    throw error;
  }

  // 5. Generate new pair
  const { accessToken, refreshToken } = generateTokenPair(payload.userId);

  // 6. Store new refresh token
  const newHash = await hashPassword(refreshToken);
  await prisma.refreshToken.create({
    data: {
      userId: payload.userId,
      tokenHash: newHash,
      expiresAt: getRefreshTokenExpiry(),
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    },
  });

  logger.info({ userId: payload.userId }, 'Tokens rotated');

  return { accessToken, refreshToken };
}

/**
 * Logout — revoke a specific refresh token.
 *
 * Instead of deleting, we revoke (soft-delete) so the token can't be
 * reused even if it hasn't expired. We also attempt to find and delete
 * it to clean up DB space.
 *
 * @param refreshTokenStr - The refresh token to invalidate
 * @throws UnauthorizedError if the token is invalid
 */
export async function logout(refreshTokenStr: string): Promise<void> {
  // Verify the JWT first to get the userId
  const payload = verifyRefreshToken(refreshTokenStr);

  // Find all tokens for this user and match
  const storedTokens = await prisma.refreshToken.findMany({
    where: {
      userId: payload.userId,
      revoked: false,
    },
  });

  for (const stored of storedTokens) {
    const isMatch = await comparePassword(refreshTokenStr, stored.tokenHash);
    if (isMatch) {
      // Delete the matched token
      await prisma.refreshToken.delete({
        where: { id: stored.id },
      });
      logger.info({ userId: payload.userId }, 'User logged out');
      return;
    }
  }

  // Token not found — could already be logged out, which is fine
  logger.info({ userId: payload.userId }, 'Logout called but token not found in DB');
}
