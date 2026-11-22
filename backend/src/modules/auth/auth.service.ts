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
import {
  verifyGoogleIdToken,
  exchangeGoogleCode,
  type GoogleProfile,
} from '../../shared/utils/google-oauth';

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

/** One message for every credential failure, so login can't be used to probe which emails exist. */
const INVALID_CREDENTIALS = 'Incorrect email or password';

/**
 * bcrypt hash of a random throwaway value. Compared against when the email is
 * unknown so that path costs the same as a wrong password (no timing oracle).
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(`dummy-${Date.now()}-${Math.random()}`);
  return dummyHashPromise;
}

async function issueAuthTokens(
  userId: string,
  meta: { userAgent?: string; ipAddress?: string } = {},
): Promise<AuthTokens> {
  const { accessToken, refreshToken, refreshJti } = generateTokenPair(userId);
  const refreshTokenHash = await hashPassword(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId,
      jti: refreshJti,
      tokenHash: refreshTokenHash,
      expiresAt: getRefreshTokenExpiry(),
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
    },
  });

  return { accessToken, refreshToken };
}

async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<usersRepo.SafeUser> {
  const byGoogle = await usersRepo.findUserByGoogleId(profile.googleId);
  if (byGoogle) {
    return byGoogle;
  }

  const byEmail = await usersRepo.findUserByEmail(profile.email);
  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
      throw ConflictError('Email already linked to another Google account');
    }

    if (!byEmail.googleId) {
      return usersRepo.linkGoogleAccount(byEmail.id, profile.googleId, profile.avatarUrl);
    }
  }

  return usersRepo.createUser({
    name: profile.name,
    email: profile.email,
    googleId: profile.googleId,
    avatarUrl: profile.avatarUrl,
  });
}

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
  const tokens = await issueAuthTokens(user.id, meta);

  logger.info({ userId: user.id }, 'User registered');

  // 6. Return
  return {
    user,
    tokens,
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
 * @throws UnauthorizedError if email is not found, password is wrong, or account is inactive
 */
export async function login(
  input: LoginInput,
  meta: { userAgent?: string; ipAddress?: string } = {},
): Promise<AuthResponse> {
  // 1. Find user (need password hash, so use findUserByEmail not safe version)
  const user = await usersRepo.findUserByEmail(input.email);
  if (!user) {
    await comparePassword(input.password, await getDummyHash());
    throw UnauthorizedError(INVALID_CREDENTIALS);
  }

  if (!user.passwordHash) {
    throw UnauthorizedError('This account uses Google sign-in. Please sign in with Google.');
  }

  // 2. Verify password
  const passwordValid = await comparePassword(input.password, user.passwordHash);
  if (!passwordValid) {
    throw UnauthorizedError(INVALID_CREDENTIALS);
  }

  // 3. Check account status
  if (user.status !== 'active') {
    throw UnauthorizedError('Account is deactivated');
  }

  // 4. Generate tokens
  const tokens = await issueAuthTokens(user.id, meta);

  logger.info({ userId: user.id }, 'User logged in');

  // 5. Return (safe user — no password hash)
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    tokens,
  };
}

/**
 * Authenticate or register a user via Google ID token (GIS / One Tap).
 */
export async function googleLoginWithIdToken(
  idToken: string,
  meta: { userAgent?: string; ipAddress?: string } = {},
): Promise<AuthResponse> {
  const profile = await verifyGoogleIdToken(idToken);
  const user = await findOrCreateGoogleUser(profile);

  if (user.status !== 'active') {
    throw UnauthorizedError('Account is deactivated');
  }

  const tokens = await issueAuthTokens(user.id, meta);
  logger.info({ userId: user.id }, 'User logged in via Google');

  return { user, tokens };
}

/**
 * Complete Google OAuth redirect flow using an authorization code.
 */
export async function googleLoginWithCode(
  code: string,
  meta: { userAgent?: string; ipAddress?: string } = {},
): Promise<AuthResponse> {
  const profile = await exchangeGoogleCode(code);
  const user = await findOrCreateGoogleUser(profile);

  if (user.status !== 'active') {
    throw UnauthorizedError('Account is deactivated');
  }

  const tokens = await issueAuthTokens(user.id, meta);
  logger.info({ userId: user.id }, 'User logged in via Google redirect');

  return { user, tokens };
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
  // 1. Verify JWT (also gives us the unique jti for an O(1) DB lookup)
  const payload = verifyRefreshToken(refreshTokenStr);

  // 2. Look up the exact token row by its jti — no full-table bcrypt scan.
  const stored = await prisma.refreshToken.findUnique({
    where: { jti: payload.jti },
  });

  if (
    !stored ||
    stored.revoked ||
    stored.userId !== payload.userId ||
    stored.expiresAt.getTime() <= Date.now()
  ) {
    // Valid JWT signature but no live DB record — already rotated, revoked, or stolen.
    logger.warn({ userId: payload.userId }, 'Refresh token reuse detected');
    throw UnauthorizedError('Refresh token has been revoked');
  }

  // 3. Defense-in-depth: confirm the raw token matches the single stored hash.
  const isMatch = await comparePassword(refreshTokenStr, stored.tokenHash);
  if (!isMatch) {
    throw UnauthorizedError('Refresh token has been revoked');
  }

  // 4. Delete the used token (one-time use)
  try {
    await prisma.refreshToken.delete({
      where: { id: stored.id },
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
  // Verify the JWT first to get the userId + jti
  const payload = verifyRefreshToken(refreshTokenStr);

  // O(1) lookup by jti — delete the exact session if it still exists.
  const result = await prisma.refreshToken.deleteMany({
    where: { jti: payload.jti, userId: payload.userId },
  });

  if (result.count > 0) {
    logger.info({ userId: payload.userId }, 'User logged out');
  } else {
    // Token not found — could already be logged out, which is fine
    logger.info({ userId: payload.userId }, 'Logout called but token not found in DB');
  }
}
