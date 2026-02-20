/**
 * =============================================================================
 * Bcrypt Hashing Utilities
 * =============================================================================
 * Centralized password hashing and comparison functions.
 * Uses bcrypt with configurable salt rounds from environment.
 *
 * IMPORTANT: These functions are async because bcrypt's hashing is CPU-intensive.
 * Using the async variants prevents blocking the event loop under load.
 * =============================================================================
 */

import bcrypt from 'bcrypt';
import { env } from './env';

/**
 * Hash a plaintext password using bcrypt.
 * Salt rounds are configured via BCRYPT_SALT_ROUNDS env variable.
 *
 * @param plaintext - The raw password to hash
 * @returns The bcrypt hash string
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, env.BCRYPT_SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 * Uses constant-time comparison to prevent timing attacks.
 *
 * @param plaintext - The raw password to verify
 * @param hash - The stored bcrypt hash
 * @returns True if the password matches, false otherwise
 */
export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
