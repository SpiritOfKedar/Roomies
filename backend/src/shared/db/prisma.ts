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
 */
export const prisma: PrismaClient =
    globalForPrisma.prisma ??
    new PrismaClient({
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
