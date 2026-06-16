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
 * Wake the Neon pool on startup so the first user request isn't penalized.
 */
export async function warmupDatabase(): Promise<void> {
  const start = performance.now();
  await prisma.$queryRaw`SELECT 1`;
  logger.info({ durationMs: Math.round(performance.now() - start) }, 'Database connection warmed up');
}

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Periodically ping the database so Neon's compute never scales to zero during
 * active use. Without this, the first request after ~5 min of idle pays a
 * multi-second cold-start penalty. Interval is below Neon's idle threshold.
 */
export function startDatabaseHeartbeat(intervalMs = 4 * 60 * 1000): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    prisma.$queryRaw`SELECT 1`.catch((err) => logger.warn({ err }, 'DB heartbeat failed'));
  }, intervalMs);
  // Don't let the heartbeat keep the process alive on its own.
  heartbeatTimer.unref?.();
}

export function stopDatabaseHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Gracefully disconnect Prisma on process termination.
 */
export async function disconnectPrisma(): Promise<void> {
  logger.info('Disconnecting Prisma client...');
  await prisma.$disconnect();
  logger.info('Prisma client disconnected.');
}
