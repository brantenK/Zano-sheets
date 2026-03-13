/**
 * Rate limiter tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TokenBucketRateLimiter,
  SlidingWindowRateLimiter,
  rateLimiterRegistry,
  withRateLimit,
  type RateLimitConfig,
} from "../src/lib/chat/rate-limiter";

describe("TokenBucketRateLimiter", () => {
  let limiter: TokenBucketRateLimiter;

  beforeEach(() => {
    limiter = new TokenBucketRateLimiter(
      10, // capacity
      2,  // refill rate
      100 // refill interval
    );
  });

  describe("initial state", () => {
    it("should start with full capacity", () => {
      expect(limiter.getTokens()).toBe(10);
    });
  });

  describe("token consumption", () => {
    it("should allow consumption when tokens available", () => {
      const result = limiter.tryConsume(1);

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(9);
    });

    it("should consume multiple tokens", () => {
      const result = limiter.tryConsume(5);

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(5);
    });

    it("should reject when insufficient tokens", () => {
      // Consume all tokens
      limiter.tryConsume(10);

      const result = limiter.tryConsume(1);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.remainingRequests).toBe(0);
    });

    it("should handle multiple consumption", () => {
      limiter.tryConsume(3);
      limiter.tryConsume(2);

      expect(limiter.getTokens()).toBe(5);
    });
  });

  describe("token refill", () => {
    it("should refill tokens over time", async () => {
      // Consume all tokens
      limiter.tryConsume(10);
      expect(limiter.getTokens()).toBe(0);

      // Wait for refill interval
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have refilled some tokens
      const tokens = limiter.getTokens();
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThanOrEqual(2); // At most refill rate
    });

    it("should not exceed capacity", async () => {
      // Wait long time
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should be at most capacity
      expect(limiter.getTokens()).toBeLessThanOrEqual(10);
    });

    it("should refill proportionally to elapsed time", async () => {
      // Consume all tokens
      limiter.tryConsume(10);

      // Wait for one refill interval
      await new Promise(resolve => setTimeout(resolve, 110));

      // Should have refilled 2 tokens
      expect(limiter.getTokens()).toBe(2);
    });
  });

  describe("reset", () => {
    it("should reset to full capacity", () => {
      // Consume some tokens
      limiter.tryConsume(5);
      expect(limiter.getTokens()).toBe(5);

      // Reset
      limiter.reset();

      expect(limiter.getTokens()).toBe(10);
    });
  });
});

describe("SlidingWindowRateLimiter", () => {
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    limiter = new SlidingWindowRateLimiter(
      5,  // max requests
      1000 // window ms
    );
  });

  describe("initial state", () => {
    it("should start with zero requests", () => {
      expect(limiter.getRequestCount()).toBe(0);
    });
  });

  describe("request handling", () => {
    it("should allow request when under limit", () => {
      const result = limiter.tryRequest();

      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(4);
    });

    it("should track request count", () => {
      limiter.tryRequest();
      limiter.tryRequest();
      limiter.tryRequest();

      expect(limiter.getRequestCount()).toBe(3);
    });

    it("should reject when at limit", () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        limiter.tryRequest();
      }

      const result = limiter.tryRequest();

      expect(result.allowed).toBe(false);
      expect(result.remainingRequests).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it("should calculate retry after correctly", async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        limiter.tryRequest();
      }

      const result = limiter.tryRequest();
      expect(result.allowed).toBe(false);

      // Retry after should be when oldest request expires
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(1000);
    });
  });

  describe("sliding window", () => {
    it("should slide window and expire old requests", async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        limiter.tryRequest();
      }

      expect(limiter.tryRequest().allowed).toBe(false);

      // Wait for first request to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Should now allow new request
      const result = limiter.tryRequest();
      expect(result.allowed).toBe(true);
    });

    it("should keep count within window", async () => {
      // Make 3 requests
      for (let i = 0; i < 3; i++) {
        limiter.tryRequest();
      }

      // Wait half window
      await new Promise(resolve => setTimeout(resolve, 500));

      // Make 2 more requests
      for (let i = 0; i < 2; i++) {
        limiter.tryRequest();
      }

      // Count should still be 5 (old ones haven't expired yet)
      expect(limiter.getRequestCount()).toBe(5);

      // Wait for first 3 to expire
      await new Promise(resolve => setTimeout(resolve, 600));

      // Count should now be 2 (only the recent ones)
      expect(limiter.getRequestCount()).toBe(2);
    });
  });

  describe("reset", () => {
    it("should clear all requests", () => {
      // Make some requests
      for (let i = 0; i < 3; i++) {
        limiter.tryRequest();
      }

      expect(limiter.getRequestCount()).toBe(3);

      // Reset
      limiter.reset();

      expect(limiter.getRequestCount()).toBe(0);
      expect(limiter.tryRequest().allowed).toBe(true);
    });
  });
});

describe("RateLimiterRegistry", () => {
  beforeEach(() => {
    rateLimiterRegistry.reset();
  });

  describe("getting limiters", () => {
    it("should create new limiter for unknown provider", () => {
      const limiter = rateLimiterRegistry.get("test-provider");
      expect(limiter).toBeDefined();
    });

    it("should return same limiter for same provider", () => {
      const limiter1 = rateLimiterRegistry.get("provider1");
      const limiter2 = rateLimiterRegistry.get("provider1");
      expect(limiter1).toBe(limiter2);
    });

    it("should return different limiters for different providers", () => {
      const limiter1 = rateLimiterRegistry.get("provider1");
      const limiter2 = rateLimiterRegistry.get("provider2");
      expect(limiter1).not.toBe(limiter2);
    });

    it("should use default limits for known providers", () => {
      const anthropicLimiter = rateLimiterRegistry.get("anthropic");
      const openaiLimiter = rateLimiterRegistry.get("openai");

      expect(anthropicLimiter).toBeDefined();
      expect(openaiLimiter).toBeDefined();
      expect(anthropicLimiter).not.toBe(openaiLimiter);
    });
  });

  describe("checking limits", () => {
    it("should check limit for provider", () => {
      const result = rateLimiterRegistry.checkLimit("anthropic");
      expect(result.allowed).toBe(true);
    });

    it("should reject when limit exceeded", () => {
      // Configure very low limit
      rateLimiterRegistry.setLimit("test", {
        maxRequests: 2,
        windowMs: 10000,
      });

      // Make 2 requests
      rateLimiterRegistry.checkLimit("test");
      rateLimiterRegistry.checkLimit("test");

      // Third should be rejected
      const result = rateLimiterRegistry.checkLimit("test");
      expect(result.allowed).toBe(false);
    });
  });

  describe("setting custom limits", () => {
    it("should set custom limit for provider", () => {
      const config: RateLimitConfig = {
        maxRequests: 100,
        windowMs: 60000,
      };

      rateLimiterRegistry.setLimit("custom", config);

      const result = rateLimiterRegistry.checkLimit("custom");
      expect(result.allowed).toBe(true);
      expect(result.remainingRequests).toBe(99);
    });
  });

  describe("reset", () => {
    it("should reset specific provider", () => {
      // Make some requests
      rateLimiterRegistry.checkLimit("provider1");
      rateLimiterRegistry.checkLimit("provider1");

      // Reset
      rateLimiterRegistry.reset("provider1");

      // Should allow requests again
      expect(rateLimiterRegistry.checkLimit("provider1").allowed).toBe(true);
    });

    it("should reset all providers", () => {
      // Make requests
      rateLimiterRegistry.checkLimit("provider1");
      rateLimiterRegistry.checkLimit("provider2");

      // Reset all
      rateLimiterRegistry.reset();

      // Both should allow requests
      expect(rateLimiterRegistry.checkLimit("provider1").allowed).toBe(true);
      expect(rateLimiterRegistry.checkLimit("provider2").allowed).toBe(true);
    });
  });

  describe("getting counts", () => {
    it("should return counts for all providers", () => {
      rateLimiterRegistry.checkLimit("provider1");
      rateLimiterRegistry.checkLimit("provider1");
      rateLimiterRegistry.checkLimit("provider2");

      const counts = rateLimiterRegistry.getAllCounts();

      expect(counts.provider1).toBe(2);
      expect(counts.provider2).toBe(1);
    });

    it("should return empty object when no limiters", () => {
      rateLimiterRegistry.reset();
      const counts = rateLimiterRegistry.getAllCounts();
      expect(Object.keys(counts)).toHaveLength(0);
    });
  });
});

describe("withRateLimit", () => {
  beforeEach(() => {
    rateLimiterRegistry.reset();
  });

  it("should execute function when under limit", async () => {
    const fn = vi.fn().mockResolvedValue("result");

    const result = await withRateLimit("anthropic", fn);

    expect(result).toBe("result");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should reject when over limit", async () => {
    // Configure very low limit
    rateLimiterRegistry.setLimit("test", {
      maxRequests: 1,
      windowMs: 10000,
    });

    const fn = vi.fn().mockResolvedValue("result");

    // First call should succeed
    await withRateLimit("test", fn);

    // Second call should fail
    await expect(withRateLimit("test", fn)).rejects.toThrow("Rate limit exceeded");
    expect(fn).toHaveBeenCalledTimes(1); // Should not be called again
  });

  it("should include retry time in error message", async () => {
    // Configure very low limit
    rateLimiterRegistry.setLimit("test", {
      maxRequests: 1,
      windowMs: 10000,
    });

    const fn = vi.fn().mockResolvedValue("result");

    // First call
    await withRateLimit("test", fn);

    // Second call should fail with retry time
    try {
      await withRateLimit("test", fn);
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("Rate limit exceeded");
      expect((error as Error).message).toContain("test");
      expect((error as Error).message).toMatch(/\d+ seconds/);
    }
  });
});
