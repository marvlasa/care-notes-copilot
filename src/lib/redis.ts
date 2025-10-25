import Redis from "ioredis";
import { env } from "@/config/env";

// Singleton Redis client
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err);
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected");
    });
  }

  return redis;
}

/**
 * Cache helper with automatic serialization
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`[Cache] Error getting ${key}:`, error);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds: number = 3600
): Promise<void> {
  try {
    const client = getRedis();
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error(`[Cache] Error setting ${key}:`, error);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    const client = getRedis();
    await client.del(key);
  } catch (error) {
    console.error(`[Cache] Error deleting ${key}:`, error);
  }
}

/**
 * Generate a stable cache key from text
 */
export function createCacheKey(prefix: string, text: string): string {
  const crypto = require("crypto");
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  return `${prefix}:${hash}`;
}

