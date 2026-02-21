/**
 * =============================================================================
 * House Service — Business Logic
 * =============================================================================
 * Handles house creation, joining, and membership validation.
 *
 * Key rules:
 *   - House creator is automatically added as 'admin' member.
 *   - Users cannot join a house they already belong to.
 *   - Membership verification is used by other modules (tasks, voting)
 *     to enforce house-scoped access control.
 * =============================================================================
 */

import { NotFoundError, ConflictError, ForbiddenError } from '../../shared/utils/app-error';
import * as houseRepo from './house.repository';
import { logger } from '../../shared/utils/logger';
import { prisma } from '../../shared/db/prisma';
import { Prisma } from '@prisma/client';

// ---- Service Functions ----

/**
 * Create a new house and add the creator as an admin member.
 *
 * Flow:
 *   1. Create the house record.
 *   2. Add the creator as a member with role 'admin'.
 *   3. Return the house with its members.
 *
 * @param userId - The creator's UUID
 * @param name - The house name
 * @returns The created house with members
 */
export async function createHouse(userId: string, name: string) {
  const houseId = await prisma.$transaction(async (tx) => {
    // 1. Create house
    const house = await tx.house.create({
      data: {
        name,
        createdBy: userId,
      },
      select: { id: true },
    });

    // 2. Add creator as admin
    await tx.houseMember.create({
      data: {
        houseId: house.id,
        userId,
        role: 'admin',
      },
    });

    return house.id;
  });

  // 3. Fetch full house with members
  const houseWithMembers = await houseRepo.findHouseWithMembers(houseId);

  logger.info({ houseId, userId }, 'House created');

  return houseWithMembers;
}

/**
 * Join an existing house.
 *
 * Guards:
 *   - House must exist.
 *   - User must not already be a member (409 Conflict).
 *
 * @param userId - The joining user's UUID
 * @param houseId - The house UUID
 * @returns The updated house with members
 */
export async function joinHouse(userId: string, houseId: string) {
  // 1. Verify house exists
  const house = await houseRepo.findHouseById(houseId);
  if (!house) {
    throw NotFoundError('House');
  }

  // 2. Find existing member record
  const existingMember = await prisma.houseMember.findFirst({
    where: { houseId, userId },
  });

  if (existingMember) {
    if (existingMember.status === 'active') {
      throw ConflictError('You are already a member of this house');
    } else if (existingMember.status === 'inactive') {
      await prisma.houseMember.update({
        where: { id: existingMember.id },
        data: { status: 'active' },
      });
    }
  } else {
    // 3. Add as member (handles concurrent 500 crash mapping to 409 gracefully)
    try {
      await houseRepo.addMember(houseId, userId, 'member');
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw ConflictError('You are already a member of this house');
      }
      throw error;
    }
  }

  // 4. Return updated house
  const houseWithMembers = await houseRepo.findHouseWithMembers(houseId);

  logger.info({ houseId, userId }, 'User joined house');

  return houseWithMembers;
}

/**
 * Get a house by ID with its members.
 * Verifies the requesting user is a member of the house.
 *
 * @param userId - The requesting user's UUID
 * @param houseId - The house UUID
 * @returns House with members
 * @throws ForbiddenError if user is not a member
 * @throws NotFoundError if house doesn't exist
 */
export async function getHouse(userId: string, houseId: string) {
  const house = await houseRepo.findHouseWithMembers(houseId);
  if (!house) {
    throw NotFoundError('House');
  }

  // Verify membership
  const isMember = house.members.some((m) => m.userId === userId);
  if (!isMember) {
    throw ForbiddenError('You are not a member of this house');
  }

  return house;
}

/**
 * Get all houses that a user belongs to.
 *
 * @param userId - The user's UUID
 * @returns Array of houses with membership info
 */
export async function getUserHouses(userId: string) {
  return houseRepo.getHousesByUser(userId);
}

/**
 * Verify that a user is an active member of a house.
 * Used by other modules (tasks, voting) for access control.
 *
 * @param houseId - The house UUID
 * @param userId - The user UUID
 * @throws ForbiddenError if user is not an active member
 */
export async function verifyMembership(houseId: string, userId: string): Promise<void> {
  const isActive = await houseRepo.isActiveMember(houseId, userId);
  if (!isActive) {
    throw ForbiddenError('You are not an active member of this house');
  }
}

/**
 * Verify that a user is an active ADMIN of a house.
 * Used by privileged operations (e.g. penalty settlement).
 *
 * @param houseId - The house UUID
 * @param userId - The user UUID
 * @throws ForbiddenError if user is not an active admin of the house
 */
export async function verifyAdminRole(houseId: string, userId: string): Promise<void> {
  const isAdmin = await houseRepo.isActiveAdmin(houseId, userId);
  if (!isAdmin) {
    throw ForbiddenError('Only a house admin can perform this action');
  }
}

/**
 * Update a house member's status (vacation mode / offboarding).
 *
 * Allowed transitions:
 *   active  → on_leave   (Vacation Mode: member is skipped in rotation)
 *   active  → inactive   (Offboarding: member is removed, pending tasks expired)
 *   on_leave → active    (Return from vacation)
 *
 * When status becomes 'inactive' all 'pending' tasks assigned to the member
 * in this house are automatically expired to prevent queue blockage.
 *
 * @param requestingUserId - Must be an active admin of the house
 * @param houseId          - The house UUID
 * @param targetUserId     - The member whose status is being changed
 * @param status           - New status value
 * @returns Updated membership record
 *
 * @throws ForbiddenError  if requester is not admin
 * @throws NotFoundError   if target is not a member of the house
 */
export async function updateMemberStatus(
  requestingUserId: string,
  houseId: string,
  targetUserId: string,
  status: 'active' | 'on_leave' | 'inactive',
): Promise<ReturnType<typeof houseRepo.updateMemberStatus>> {
  // 1. Requester must be an active admin
  await verifyAdminRole(houseId, requestingUserId);

  // 2. Target user must be an existing member of the house
  const member = await houseRepo.findMemberRecord(houseId, targetUserId);
  if (!member) {
    throw NotFoundError('House member');
  }

  // 3. Update the membership status
  const updated = await houseRepo.updateMemberStatus(houseId, targetUserId, status);

  // 4. Offboarding side-effect: expire all pending tasks so the queue never blocks
  if (status === 'inactive') {
    const expiredCount = await houseRepo.expirePendingTasksForMember(houseId, targetUserId);
    logger.info(
      { houseId, targetUserId, expiredCount },
      'Member deactivated — pending tasks expired',
    );
  }

  logger.info({ houseId, targetUserId, status, requestingUserId }, 'Member status updated');

  return updated;
}
