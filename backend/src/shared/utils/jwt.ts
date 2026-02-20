/**
 * =============================================================================
 * JWT Token Utilities
 * =============================================================================
 * Centralized JWT signing and verification for access and refresh tokens.
 *
 * Access Token:
 *   - Short-lived (15m default)
 *   - Payload: { userId }
 *   - Used in Authorization header for API calls
 *
 * Refresh Token:
 *   - Long-lived (7d default)
 *   - Payload: { userId, jti }
 *   - `jti` (JWT ID) is a unique identifier used to track/revoke individual tokens
 *   - Stored (hashed) in the database for validation and rotation
 * =============================================================================
 */

import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from './env';
import { UnauthorizedError } from './app-error';

// ---- Payload Types ----

/** Decoded access token payload */
export interface AccessTokenPayload {
    userId: string;
}

/** Decoded refresh token payload */
export interface RefreshTokenPayload {
    userId: string;
    /** Unique token identifier for DB tracking and revocation */
    jti: string;
}

// ---- Token Generation ----

/**
 * Parse a duration string (e.g., "15m", "7d", "24h") into seconds.
 * Used to convert env config strings into the numeric format
 * expected by jwt.sign()'s expiresIn option.
 */
function parseDurationToSeconds(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // Default: 15 minutes

    const value = parseInt(match[1], 10);
    switch (match[2]) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        default: return 900;
    }
}

/**
 * Generate a short-lived access token.
 *
 * @param userId - The user's UUID
 * @returns Signed JWT access token string
 */
export function generateAccessToken(userId: string): string {
    return jwt.sign({ userId }, env.JWT_ACCESS_SECRET, {
        expiresIn: parseDurationToSeconds(env.JWT_ACCESS_EXPIRY),
    });
}

/**
 * Generate a long-lived refresh token with a unique JTI.
 * The JTI is used to identify this specific token in the database
 * for rotation and revocation.
 *
 * @param userId - The user's UUID
 * @returns Object containing the signed token and its JTI
 */
export function generateRefreshToken(userId: string): { token: string; jti: string } {
    const jti = uuidv4();
    const token = jwt.sign({ userId, jti }, env.JWT_REFRESH_SECRET, {
        expiresIn: parseDurationToSeconds(env.JWT_REFRESH_EXPIRY),
    });
    return { token, jti };
}

/**
 * Generate both access and refresh tokens at once.
 * Convenience method used during login and token rotation.
 *
 * @param userId - The user's UUID
 * @returns Both tokens and the refresh token's JTI
 */
export function generateTokenPair(userId: string): {
    accessToken: string;
    refreshToken: string;
    refreshJti: string;
} {
    const accessToken = generateAccessToken(userId);
    const { token: refreshToken, jti: refreshJti } = generateRefreshToken(userId);
    return { accessToken, refreshToken, refreshJti };
}

// ---- Token Verification ----

/**
 * Verify and decode an access token.
 * Throws an UnauthorizedError (401) if the token is invalid or expired.
 *
 * @param token - The raw JWT string from the Authorization header
 * @returns Decoded payload with userId
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
    try {
        const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
        return payload;
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            throw UnauthorizedError('Access token expired');
        }
        if (error instanceof JsonWebTokenError) {
            throw UnauthorizedError('Invalid access token');
        }
        throw UnauthorizedError('Token verification failed');
    }
}

/**
 * Verify and decode a refresh token.
 * Throws an UnauthorizedError (401) if the token is invalid or expired.
 *
 * @param token - The raw refresh JWT string
 * @returns Decoded payload with userId and jti
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
        const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
        return payload;
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            throw UnauthorizedError('Refresh token expired');
        }
        if (error instanceof JsonWebTokenError) {
            throw UnauthorizedError('Invalid refresh token');
        }
        throw UnauthorizedError('Token verification failed');
    }
}

/**
 * Calculate the expiry date for a refresh token from now.
 * Parses the JWT_REFRESH_EXPIRY string (e.g., "7d") into a Date.
 *
 * @returns Date object representing when the refresh token expires
 */
export function getRefreshTokenExpiry(): Date {
    const expiry = env.JWT_REFRESH_EXPIRY;
    const now = new Date();

    // Parse duration string: supports "7d", "24h", "30m"
    const match = expiry.match(/^(\d+)([dhm])$/);
    if (!match) {
        // Default to 7 days if parsing fails
        now.setDate(now.getDate() + 7);
        return now;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 'd':
            now.setDate(now.getDate() + value);
            break;
        case 'h':
            now.setHours(now.getHours() + value);
            break;
        case 'm':
            now.setMinutes(now.getMinutes() + value);
            break;
    }

    return now;
}
