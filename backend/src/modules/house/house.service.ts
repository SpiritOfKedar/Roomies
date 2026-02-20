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
  // 1. Create house
  const house = await houseRepo.createHouse({
    name,
    createdBy: userId,
  });

  // 2. Add creator as admin
  await houseRepo.addMember(house.id, userId, 'admin');

  // 3. Fetch full house with members
  const houseWithMembers = await houseRepo.findHouseWithMembers(house.id);

  logger.info({ houseId: house.id, userId }, 'House created');

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

  // 2. Check if already a member (any status)
  const alreadyMember = await houseRepo.isMember(houseId, userId);
  if (alreadyMember) {
    throw ConflictError('You are already a member of this house');
  }

  // 3. Add as member
  await houseRepo.addMember(houseId, userId, 'member');

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
