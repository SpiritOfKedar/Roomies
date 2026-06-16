/**
 * =============================================================================
 * Users Service — Business Logic
 * =============================================================================
 * Thin service layer for user-related operations that don't fall
 * under authentication (those live in auth.service.ts).
 *
 * Currently provides user profile retrieval.
 * Will expand as features like profile updates are added.
 * =============================================================================
 */

import { NotFoundError } from '../../shared/utils/app-error';
import * as usersRepo from './users.repository';
import { cached, userProfileKey } from '../../shared/cache/redis-cache';
import type { SafeUser } from './users.repository';

/**
 * Get a user's profile by their UUID.
 * Throws 404 if the user does not exist.
 *
 * @param userId - The user's UUID
 * @returns Safe user record (no password hash)
 */
export async function getUserProfile(userId: string): Promise<SafeUser> {
  const user = await cached(userProfileKey(userId), 60, () => usersRepo.findUserById(userId));
  if (!user) {
    throw NotFoundError('User');
  }
  return user;
}
