/**
 * =============================================================================
 * Prisma Client — Singleton Instance
 * =============================================================================
 * Ensures a single PrismaClient is reused across the application lifecycle.
 * During development with hot-reload (tsx watch), multiple instances can be
 * created. This module stores the client on `globalThis` to prevent that.
 * =============================================================================
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Extend globalThis to hold the Prisma client reference
 * across hot-reload cycles in development.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton PrismaClient instance.
 * Logs queries in development for debugging.
 *
 * In dev, drop any cached client on hot reload so a fresh instance is used
 * after `prisma generate` (still restart dev if schema fields seem missing).
 */
if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Neon is a remote pooler: each round-trip adds 100-300ms.
    // Default 5s transaction timeout is too tight for any tx with 3+ queries.
    transactionOptions: {
      maxWait: 10_000, // up to 10s to acquire a connection from the pool
      timeout: 30_000, // up to 30s for the transaction itself to complete
    },
    log:
      process.env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma on process termination.
 */
export async function disconnectPrisma(): Promise<void> {
  logger.info('Disconnecting Prisma client...');
  await prisma.$disconnect();
  logger.info('Prisma client disconnected.');
}
