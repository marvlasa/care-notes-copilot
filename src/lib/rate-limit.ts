import { RateLimiterRedis } from "rate-limiter-flexible";
import { getRedis } from "./redis";
import { env } from "@/config/env";

let rateLimiter: RateLimiterRedis | null = null;

export function getRateLimiter(): RateLimiterRedis {
  if (!rateLimiter) {
    rateLimiter = new RateLimiterRedis({
      storeClient: getRedis(),
      keyPrefix: "rl",
      points: env.RATE_LIMIT_MAX_REQUESTS,
      duration: Math.floor(env.RATE_LIMIT_WINDOW_MS / 1000),
      blockDuration: 0, // Don't block, just return 429
    });
  }
  return rateLimiter;
}

/**
 * Check rate limit for a given key (user ID, IP, etc.)
 */
export async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  try {
    const limiter = getRateLimiter();
    const result = await limiter.consume(key, 1);
    
    return {
      allowed: true,
      remaining: result.remainingPoints,
      resetAt: new Date(Date.now() + result.msBeforeNext),
    };
  } catch (error: any) {
    if (error.remainingPoints !== undefined) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + error.msBeforeNext),
      };
    }
    
    // Redis error - allow request but log
    console.error("[RateLimit] Error:", error);
    return {
      allowed: true,
      remaining: -1,
      resetAt: new Date(Date.now() + env.RATE_LIMIT_WINDOW_MS),
    };
  }
}

/**
 * Response helper for rate limit exceeded
 */
export function rateLimitExceededResponse(resetAt: Date): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      resetAt: resetAt.toISOString(),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": env.RATE_LIMIT_MAX_REQUESTS.toString(),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetAt.toISOString(),
        "Retry-After": Math.ceil(
          (resetAt.getTime() - Date.now()) / 1000
        ).toString(),
      },
    }
  );
}

