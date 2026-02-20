/**
 * =============================================================================
 * Users Repository — Database Access Layer
 * =============================================================================
 * Isolates all Prisma queries for the `users` table.
 * No business logic here — just data access.
 *
 * This repository is shared across modules (auth uses it for registration,
 * house module uses it for member lookups, etc.).
 * =============================================================================
 */

import { prisma } from '../../shared/db/prisma';

// ---- Types ----

/** Fields required to create a new user */
export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
}

/** Safe user projection (excludes password hash) */
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: Date;
}

/** Select clause that excludes the password hash from query results */
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  status: true,
  createdAt: true,
} as const;

// ---- Repository Functions ----

/**
 * Create a new user record.
 *
 * @param data - Name, email, and pre-hashed password
 * @returns The created user (without password hash)
 * @throws Prisma P2002 if email already exists (caught by global error handler)
 */
export async function createUser(data: CreateUserData): Promise<SafeUser> {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
    },
    select: SAFE_USER_SELECT,
  });
}

/**
 * Find a user by email address.
 * Returns the full record INCLUDING password hash (needed for auth verification).
 *
 * @param email - The email to search for
 * @returns Full user record or null if not found
 */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

/**
 * Find a user by UUID.
 * Returns a safe projection (no password hash).
 *
 * @param id - The user's UUID
 * @returns Safe user record or null if not found
 */
export async function findUserById(id: string): Promise<SafeUser | null> {
  return prisma.user.findUnique({
    where: { id },
    select: SAFE_USER_SELECT,
  });
}

/**
 * Check if a user with the given email already exists.
 * More efficient than findUserByEmail when you only need existence.
 *
 * @param email - The email to check
 * @returns True if the email is already registered
 */
export async function emailExists(email: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { email },
  });
  return count > 0;
}
