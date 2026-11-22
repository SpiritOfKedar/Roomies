/**
 * =============================================================================
 * Ephemeral Store — short-lived counters and one-time values
 * =============================================================================
 * Backed by Redis so state is shared across instances and survives restarts.
 * Falls back to an in-process Map when Redis is unavailable (single-instance
 * dev only — documented, not relied on in production).
 * =============================================================================
 */

import { ensureRedisReady } from './redis-client';
import { logger } from '../utils/logger';

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

const memory = new Map<string, MemoryEntry>();

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Increment a counter, starting its TTL window on the first increment.
 * Returns the new count.
 */
export async function incrementCounter(key: string, ttlSec: number): Promise<number> {
  const redis = await ensureRedisReady();
  if (redis) {
    try {
      const count = await redis.incr(key);
      // First hit opens the window. (Avoids EXPIRE NX, which needs Redis 7+.)
      if (count === 1) await redis.expire(key, ttlSec);
      return count;
    } catch (err) {
      logger.warn({ err, key }, 'ephemeral-store: Redis incr failed — using memory');
    }
  }

  const current = Number(memoryGet(key) ?? 0) + 1;
  const existing = memory.get(key);
  memory.set(key, {
    value: String(current),
    expiresAt: existing && existing.expiresAt > Date.now() ? existing.expiresAt : Date.now() + ttlSec * 1000,
  });
  return current;
}

/** Read a counter (0 when missing or expired). */
export async function getCounter(key: string): Promise<number> {
  const redis = await ensureRedisReady();
  if (redis) {
    try {
      return Number((await redis.get(key)) ?? 0);
    } catch (err) {
      logger.warn({ err, key }, 'ephemeral-store: Redis get failed — using memory');
    }
  }
  return Number(memoryGet(key) ?? 0);
}

/** Delete one or more keys. */
export async function deleteKeys(...keys: string[]): Promise<void> {
  keys.forEach((k) => memory.delete(k));
  const redis = await ensureRedisReady();
  if (!redis) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    logger.warn({ err, keys }, 'ephemeral-store: Redis del failed');
  }
}

/** Store a value that expires after ttlSec. */
export async function putValue(key: string, value: string, ttlSec: number): Promise<void> {
  const redis = await ensureRedisReady();
  if (redis) {
    try {
      await redis.set(key, value, 'EX', ttlSec);
      return;
    } catch (err) {
      logger.warn({ err, key }, 'ephemeral-store: Redis set failed — using memory');
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

/** Read and delete a value atomically (one-time use). */
export async function takeValue(key: string): Promise<string | null> {
  const redis = await ensureRedisReady();
  if (redis) {
    try {
      const value = await redis.getdel(key);
      if (value !== null) return value;
    } catch (err) {
      logger.warn({ err, key }, 'ephemeral-store: Redis getdel failed — using memory');
    }
  }
  const value = memoryGet(key);
  memory.delete(key);
  return value;
}
