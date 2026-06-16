/**
 * Shared ioredis client for cache + BullMQ.
 * Eager-connects on startup; recreates client after connection loss.
 */

import Redis from 'ioredis';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

let client: Redis | null = null;
let readyPromise: Promise<Redis | null> | null = null;

function isRedisConfigured(): boolean {
  return !!(env.REDIS_URL || env.REDIS_HOST);
}

function createClient(): Redis {
  const redis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        connectTimeout: 10_000,
        enableOfflineQueue: true,
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2_000)),
      })
    : new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        connectTimeout: 10_000,
        enableOfflineQueue: true,
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2_000)),
      });

  redis.on('error', (err) => {
    logger.warn({ err: err.message }, 'Redis connection error');
  });

  redis.on('end', () => {
    if (client === redis) {
      client = null;
      readyPromise = null;
    }
  });

  return redis;
}

/** Returns the shared client, creating it if needed. May not be connected yet. */
export function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!client) client = createClient();
  return client;
}

/** Returns a connected client, or null if Redis is unavailable. */
export async function ensureRedisReady(): Promise<Redis | null> {
  const redis = getRedis();
  if (!redis) return null;
  if (redis.status === 'ready') return redis;

  if (!readyPromise) {
    readyPromise = new Promise<Redis | null>((resolve) => {
      const onReady = () => {
        cleanup();
        resolve(redis);
      };
      const onEnd = () => {
        cleanup();
        resolve(null);
      };
      const onTimeout = () => {
        cleanup();
        logger.warn('Redis connect timeout — cache disabled until reconnect');
        resolve(null);
      };

      const timer = setTimeout(onTimeout, 10_000);
      const cleanup = () => {
        clearTimeout(timer);
        redis.off('ready', onReady);
        redis.off('end', onEnd);
      };

      redis.once('ready', onReady);
      redis.once('end', onEnd);
    });
  }

  return readyPromise;
}

export async function warmupRedis(): Promise<void> {
  const redis = await ensureRedisReady();
  if (!redis) return;

  const start = performance.now();
  await redis.ping();
  logger.info({ durationMs: Math.round(performance.now() - start) }, 'Redis connection warmed up');
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    readyPromise = null;
  }
}
