/**
 * Redis read-through cache (Upstash).
 * Postgres remains source of truth; Redis serves hot reads with short TTLs.
 */

import crypto from 'crypto';
import { ensureRedisReady } from './redis-client';
import { logger } from '../utils/logger';

export function membershipKey(houseId: string, userId: string): string {
  return `membership:${houseId}:${userId}`;
}

export function houseDetailKey(houseId: string): string {
  return `house:${houseId}:detail`;
}

export function houseTasksKey(houseId: string, statusFilter: string): string {
  return `house:${houseId}:tasks:${statusFilter}`;
}

export function houseVotesKey(houseId: string, userId: string, taskIds: string[]): string {
  const hash = crypto.createHash('sha1').update([...taskIds].sort().join(',')).digest('hex');
  return `house:${houseId}:votes:${userId}:${hash}`;
}

export function houseLeaderboardKey(houseId: string): string {
  return `house:${houseId}:leaderboard`;
}

export function houseMessagesKey(houseId: string, limit: number, after?: string, before?: string): string {
  return `house:${houseId}:messages:${limit}:${after ?? ''}:${before ?? ''}`;
}

export function houseDashboardKey(houseId: string, userId: string): string {
  return `house:${houseId}:dashboard:${userId}`;
}

export function userHousesKey(userId: string): string {
  return `user:${userId}:houses`;
}

export function userProfileKey(userId: string): string {
  return `user:${userId}:profile`;
}

export function houseMessagesFeedKey(houseId: string): string {
  return `house:${houseId}:messages:feed`;
}

/**
 * Read-through cache with JSON serialization.
 * Falls back to fetcher when Redis is unavailable.
 */
export async function cached<T>(key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<T> {
  const redis = await ensureRedisReady();
  if (!redis) return fetcher();

  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch (err) {
    logger.warn({ err, key }, 'Redis cache read failed');
  }

  const data = await fetcher();

  try {
    await redis.setex(key, ttlSec, JSON.stringify(data));
  } catch (err) {
    logger.warn({ err, key }, 'Redis cache write failed');
  }

  return data;
}

/** Membership cache: "1" = active, "0" = not active. Returns null on miss. */
export async function getCachedMembership(
  houseId: string,
  userId: string,
): Promise<boolean | null> {
  const redis = await ensureRedisReady();
  if (!redis) return null;

  try {
    const hit = await redis.get(membershipKey(houseId, userId));
    if (hit === '1') return true;
    if (hit === '0') return false;
    return null;
  } catch (err) {
    logger.warn({ err }, 'Redis membership cache read failed');
    return null;
  }
}

export async function setCachedMembership(
  houseId: string,
  userId: string,
  isActive: boolean,
  ttlSec = 300,
): Promise<void> {
  const redis = await ensureRedisReady();
  if (!redis) return;

  try {
    await redis.setex(membershipKey(houseId, userId), ttlSec, isActive ? '1' : '0');
  } catch (err) {
    logger.warn({ err }, 'Redis membership cache write failed');
  }
}

/** Delete all house-scoped cache keys (detail, tasks, votes, leaderboard, messages, membership). */
export async function invalidateHouseCache(houseId: string): Promise<void> {
  const redis = await ensureRedisReady();
  if (!redis) return;

  const patterns = [`house:${houseId}:*`, `membership:${houseId}:*`];

  try {
    for (const pattern of patterns) {
      let cursor = '0';
      do {
        const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = next;
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== '0');
    }
  } catch (err) {
    logger.warn({ err, houseId }, 'Redis cache invalidation failed');
  }
}

export async function invalidateMembership(houseId: string, userId: string): Promise<void> {
  const redis = await ensureRedisReady();
  if (!redis) return;
  try {
    await redis.del(membershipKey(houseId, userId));
  } catch (err) {
    logger.warn({ err }, 'Redis membership invalidation failed');
  }
}

export async function invalidateUserHouses(userId: string): Promise<void> {
  const redis = await ensureRedisReady();
  if (!redis) return;
  try {
    await redis.del(userHousesKey(userId));
  } catch (err) {
    logger.warn({ err, userId }, 'Redis user houses invalidation failed');
  }
}

/** Push a new message JSON to the Redis feed list (newest first). */
export async function pushMessageToFeed(houseId: string, message: unknown): Promise<void> {
  const redis = await ensureRedisReady();
  if (!redis) return;

  const key = houseMessagesFeedKey(houseId);
  try {
    // Pipeline the three ops into a single round-trip instead of three.
    await redis
      .multi()
      .lpush(key, JSON.stringify(message))
      .ltrim(key, 0, 99)
      .expire(key, 300)
      .exec();
  } catch (err) {
    logger.warn({ err, houseId }, 'Redis message feed push failed');
  }
}

/** Read cached message feed (chronological order). */
export async function getMessageFeedFromCache(houseId: string, limit: number): Promise<unknown[] | null> {
  const redis = await ensureRedisReady();
  if (!redis) return null;

  try {
    const raw = await redis.lrange(houseMessagesFeedKey(houseId), 0, limit - 1);
    if (raw.length === 0) return null;
    const parsed = raw.map((s) => JSON.parse(s));
    return parsed.reverse();
  } catch (err) {
    logger.warn({ err, houseId }, 'Redis message feed read failed');
  }
  return null;
}

export { disconnectRedis as disconnectCacheRedis, warmupRedis } from './redis-client';
