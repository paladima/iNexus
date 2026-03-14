/**
 * In-memory rate limiter for tRPC procedures (#17)
 * Uses sliding window counters per userId.
 * Suitable for single-instance deployments; for multi-instance, use Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const keysToDelete: string[] = [];
  buckets.forEach((entry, key) => {
    if (entry.resetAt < now) keysToDelete.push(key);
  });
  keysToDelete.forEach((k) => buckets.delete(k));
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

/** Default rate limit configs for different operation types */
export const RATE_LIMITS = {
  discover: { maxRequests: 10, windowMs: 60_000 } as RateLimitConfig,       // 10 searches/min
  draftGeneration: { maxRequests: 20, windowMs: 60_000 } as RateLimitConfig, // 20 drafts/min
  voiceUpload: { maxRequests: 5, windowMs: 60_000 } as RateLimitConfig,      // 5 uploads/min
  bulkAction: { maxRequests: 5, windowMs: 60_000 } as RateLimitConfig,       // 5 bulk ops/min
  command: { maxRequests: 30, windowMs: 60_000 } as RateLimitConfig,         // 30 commands/min
  default: { maxRequests: 60, windowMs: 60_000 } as RateLimitConfig,         // 60 req/min
} as const;

/**
 * Check rate limit for a given userId + operation.
 * Returns { allowed, remaining, resetIn } — does NOT throw.
 */
export function checkRateLimit(
  userId: number,
  operation: string,
  config: RateLimitConfig = RATE_LIMITS.default
): { allowed: boolean; remaining: number; resetInMs: number } {
  const key = `${userId}:${operation}`;
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetInMs: config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetInMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetInMs: entry.resetAt - now };
}

/**
 * Enforce rate limit — throws TRPCError if exceeded.
 * Use in tRPC procedures: `enforceRateLimit(ctx.user.id, "discover", RATE_LIMITS.discover)`
 */
export function enforceRateLimit(
  userId: number,
  operation: string,
  config: RateLimitConfig = RATE_LIMITS.default
): void {
  const { allowed, resetInMs } = checkRateLimit(userId, operation, config);
  if (!allowed) {
    const { TRPCError } = require("@trpc/server");
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded for ${operation}. Try again in ${Math.ceil(resetInMs / 1000)}s.`,
    });
  }
}

/** Reset rate limit for testing */
export function resetRateLimit(userId: number, operation: string): void {
  buckets.delete(`${userId}:${operation}`);
}

/** Clear all rate limits (for testing) */
export function clearAllRateLimits(): void {
  buckets.clear();
}
