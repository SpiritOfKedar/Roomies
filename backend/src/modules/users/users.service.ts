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

import { NotFoundError, UnauthorizedError } from '../../shared/utils/app-error';
import { prisma } from '../../shared/db/prisma';
import { comparePassword } from '../../shared/utils/hash';
import { invalidateUserHouses } from '../../shared/cache/redis-cache';
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

/**
 * Delete (anonymize) the authenticated user's account.
 * Hard deletion would break FKs on expense/task history, so the row is scrubbed
 * of PII and credentials and marked `deleted` (login rejects non-active users).
 */
export async function deleteAccount(userId: string, currentPassword?: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'deleted') throw NotFoundError('User');

  if (user.passwordHash) {
    if (!currentPassword) throw UnauthorizedError('Current password is required');
    if (!(await comparePassword(currentPassword, user.passwordHash))) {
      throw UnauthorizedError('Incorrect password');
    }
  }

  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId } }),
    prisma.userSecurityQuestion.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Deleted user',
        email: `deleted+${userId}@deleted.roomies.invalid`,
        passwordHash: null,
        googleId: null,
        avatarUrl: null,
        status: 'deleted',
      },
    }),
  ]);
  await invalidateUserHouses(userId);
}
