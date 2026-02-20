/**
 * =============================================================================
 * House Repository — Database Access Layer
 * =============================================================================
 * Isolates all Prisma queries for the `houses` and `house_members` tables.
 * No business logic — just data access.
 *
 * The task rotation engine uses raw SQL for SELECT FOR UPDATE, which
 * is handled in the tasks repository (not here).
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';

// ---- Types ----

export interface CreateHouseData {
  name: string;
  createdBy: string;
}

export interface HouseWithMembers {
  id: string;
  name: string;
  createdBy: string;
  currentIndex: number;
  createdAt: Date;
  members: {
    id: string;
    userId: string;
    role: string;
    joinedAt: Date;
    status: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  }[];
}

// ---- Repository Functions ----

/**
 * Create a new house.
 *
 * @param data - House name and creator user ID
 * @returns The created house record
 */
export async function createHouse(data: CreateHouseData) {
  return prisma.house.create({
    data: {
      name: data.name,
      createdBy: data.createdBy,
    },
    select: {
      id: true,
      name: true,
      createdBy: true,
      currentIndex: true,
      createdAt: true,
    },
  });
}

/**
 * Find a house by its UUID.
 *
 * @param id - The house UUID
 * @returns House record or null
 */
export async function findHouseById(id: string) {
  return prisma.house.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      createdBy: true,
      currentIndex: true,
      createdAt: true,
    },
  });
}

/**
 * Find a house by ID with its members and their user details.
 *
 * @param id - The house UUID
 * @returns House with populated members, or null
 */
export async function findHouseWithMembers(id: string): Promise<HouseWithMembers | null> {
  return prisma.house.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      createdBy: true,
      currentIndex: true,
      createdAt: true,
      members: {
        select: {
          id: true,
          userId: true,
          role: true,
          joinedAt: true,
          status: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
}

/**
 * Add a user as a member of a house.
 *
 * @param houseId - The house UUID
 * @param userId - The user UUID
 * @param role - Member role (default: 'member')
 * @returns The created house_members record
 * @throws Prisma P2002 if the user is already a member (unique constraint)
 */
export async function addMember(houseId: string, userId: string, role = 'member') {
  return prisma.houseMember.create({
    data: {
      houseId,
      userId,
      role,
    },
    select: {
      id: true,
      houseId: true,
      userId: true,
      role: true,
      joinedAt: true,
      status: true,
    },
  });
}

/**
 * Check if a user is an active member of a specific house.
 *
 * @param houseId - The house UUID
 * @param userId - The user UUID
 * @returns True if the user is an active member
 */
export async function isActiveMember(houseId: string, userId: string): Promise<boolean> {
  const count = await prisma.houseMember.count({
    where: {
      houseId,
      userId,
      status: 'active',
    },
  });
  return count > 0;
}

/**
 * Check if a user is a member of a house (any status).
 *
 * @param houseId - The house UUID
 * @param userId - The user UUID
 * @returns True if a membership record exists
 */
export async function isMember(houseId: string, userId: string): Promise<boolean> {
  const count = await prisma.houseMember.count({
    where: {
      houseId,
      userId,
    },
  });
  return count > 0;
}

/**
 * Fetch all active members of a house, ordered by joined_at ASC.
 * This deterministic ordering is critical for the rotation engine.
 *
 * @param houseId - The house UUID
 * @returns Array of active members sorted by join date
 */
export async function getActiveMembers(houseId: string) {
  return prisma.houseMember.findMany({
    where: {
      houseId,
      status: 'active',
    },
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true,
      userId: true,
      role: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Get all houses a user belongs to.
 *
 * @param userId - The user UUID
 * @returns Array of houses with membership info
 */
export async function getHousesByUser(userId: string) {
  return prisma.houseMember.findMany({
    where: {
      userId,
      status: 'active',
    },
    select: {
      id: true,
      role: true,
      joinedAt: true,
      house: {
        select: {
          id: true,
          name: true,
          createdBy: true,
          createdAt: true,
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  });
}
