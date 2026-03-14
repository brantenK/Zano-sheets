/**
 * Rate Limiter for API requests.
 *
 * Implements token bucket and sliding window rate limiting to prevent
 * API exhaustion and respect provider rate limits.
 */

export interface RateLimitConfig {
  /** Maximum requests per time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Tokens to add per refill (for token bucket) */
  refillRate?: number;
  /** Refill interval in milliseconds (for token bucket) */
  refillIntervalMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number; // milliseconds until next allowed request
  remainingRequests?: number;
}

/**
 * Token Bucket Rate Limiter.
 *
 * Allows bursts up to bucket capacity, then refills at a steady rate.
 */
export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private capacity: number,
    private refillRate: number,
    private refillIntervalMs: number = 1000,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  /**
   * Try to consume a token.
   */
  tryConsume(tokens: number = 1): RateLimitResult {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return {
        allowed: true,
        remainingRequests: Math.floor(this.tokens),
      };
    }

    // Calculate when enough tokens will be available
    const tokensNeeded = tokens - this.tokens;
    const refillCount = Math.ceil(tokensNeeded / this.refillRate);
    const retryAfter = refillCount * this.refillIntervalMs;

    return {
      allowed: false,
      retryAfter,
      remainingRequests: Math.floor(this.tokens),
    };
  }

  /**
   * Refill tokens based on elapsed time.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= this.refillIntervalMs) {
      const intervals = Math.floor(elapsed / this.refillIntervalMs);
      const tokensToAdd = intervals * this.refillRate;

      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Get current token count.
   */
  getTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }
}

/**
 * Sliding Window Rate Limiter.
 *
 * Tracks exact request timestamps within a sliding window.
 */
export class SlidingWindowRateLimiter {
  private requests: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  /**
   * Try to make a request.
   */
  tryRequest(): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Remove old requests outside the window
    this.requests = this.requests.filter((t) => t > windowStart);

    if (this.requests.length < this.maxRequests) {
      this.requests.push(now);
      return {
        allowed: true,
        remainingRequests: this.maxRequests - this.requests.length,
      };
    }

    // Find when the oldest request will expire
    const oldestRequest = this.requests[0];
    const retryAfter = oldestRequest + this.windowMs - now;

    return {
      allowed: false,
      retryAfter: Math.max(0, retryAfter),
      remainingRequests: 0,
    };
  }

  /**
   * Get current request count in window.
   */
  getRequestCount(): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    return this.requests.filter((t) => t > windowStart).length;
  }

  /**
   * Reset to initial state.
   */
  reset(): void {
    this.requests = [];
  }
}

/**
 * Rate limiter registry by provider.
 *
 * Different providers have different rate limits, so we maintain
 * separate limiters for each.
 */
class RateLimiterRegistry {
  private limiters = new Map<string, SlidingWindowRateLimiter>();

  /**
   * Default rate limits by provider (requests per minute).
   * Conservative defaults to avoid hitting provider limits.
   */
  private readonly defaultLimits: Record<string, RateLimitConfig> = {
    anthropic: { maxRequests: 50, windowMs: 60000 }, // 50/min
    openai: { maxRequests: 100, windowMs: 60000 }, // 100/min (GPT-4)
    "google-generative-ai": { maxRequests: 60, windowMs: 60000 }, // 60/min
    "azure-openai": { maxRequests: 100, windowMs: 60000 }, // 100/min
    bedrock: { maxRequests: 100, windowMs: 60000 }, // 100/min
  };

  /**
   * Get or create a rate limiter for a provider.
   */
  get(provider: string): SlidingWindowRateLimiter {
    if (!this.limiters.has(provider)) {
      const config = this.defaultLimits[provider] || {
        maxRequests: 60,
        windowMs: 60000,
      };
      this.limiters.set(
        provider,
        new SlidingWindowRateLimiter(config.maxRequests, config.windowMs),
      );
    }
    const limiter = this.limiters.get(provider);
    if (!limiter) {
      throw new Error(
        `Failed to initialize rate limiter for provider '${provider}'.`,
      );
    }
    return limiter;
  }

  /**
   * Set a custom rate limit for a provider.
   */
  setLimit(provider: string, config: RateLimitConfig): void {
    this.limiters.set(
      provider,
      new SlidingWindowRateLimiter(config.maxRequests, config.windowMs),
    );
  }

  /**
   * Check if a request is allowed for a provider.
   */
  checkLimit(provider: string): RateLimitResult {
    return this.get(provider).tryRequest();
  }

  /**
   * Reset a specific limiter or all limiters.
   */
  reset(provider?: string): void {
    if (provider) {
      this.get(provider).reset();
    } else {
      this.limiters.forEach((l) => {
        l.reset();
      });
      this.limiters.clear();
    }
  }

  /**
   * Get all current request counts.
   */
  getAllCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    this.limiters.forEach((limiter, provider) => {
      counts[provider] = limiter.getRequestCount();
    });
    return counts;
  }
}

export const rateLimiterRegistry = new RateLimiterRegistry();

/**
 * Convenience function to check rate limit before making a request.
 */
export async function withRateLimit<T>(
  provider: string,
  fn: () => Promise<T>,
): Promise<T> {
  const result = rateLimiterRegistry.checkLimit(provider);

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil((result.retryAfter || 0) / 1000);
    throw new Error(
      `Rate limit exceeded for ${provider}. Please retry after ${retryAfterSeconds} seconds.`,
    );
  }

  return fn();
}
