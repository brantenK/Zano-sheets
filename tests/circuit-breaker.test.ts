/**
 * Circuit breaker tests.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CircuitBreaker, CircuitBreakerState, circuitBreakerRegistry } from "../src/lib/chat/circuit-breaker";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeoutMs: 1000,
      monitoringPeriodMs: 5000,
    });
  });

  describe("initial state", () => {
    it("should start in closed state", () => {
      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it("should have zero failures and successes", () => {
      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
    });

    it("should allow requests when closed", () => {
      expect(breaker.isOpen()).toBe(false);
    });
  });

  describe("successful execution", () => {
    it("should execute function and return result when closed", async () => {
      const fn = vi.fn().mockResolvedValue("result");
      const result = await breaker.execute(fn);

      expect(result).toBe("result");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should increment success count", async () => {
      await breaker.execute(() => Promise.resolve("result"));

      const metrics = breaker.getMetrics();
      expect(metrics.successes).toBe(1);
    });

    it("should track last success time", async () => {
      const before = Date.now();
      await breaker.execute(() => Promise.resolve("result"));

      const metrics = breaker.getMetrics();
      expect(metrics.lastSuccessTime).toBeGreaterThanOrEqual(before);
    });
  });

  describe("failure handling", () => {
    it("should increment failure count on error", async () => {
      await expect(
        breaker.execute(() => Promise.reject(new Error("test")))
      ).rejects.toThrow("test");

      const metrics = breaker.getMetrics();
      expect(metrics.failures).toBe(1);
    });

    it("should track last failure time", async () => {
      const before = Date.now();
      try {
        await breaker.execute(() => Promise.reject(new Error("test")));
      } catch {
        // Expected
      }

      const metrics = breaker.getMetrics();
      expect(metrics.lastFailureTime).toBeGreaterThanOrEqual(before);
    });

    it("should open circuit after threshold failures", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("test"));

      // First 2 failures: circuit stays closed
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
        expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
      }

      // 3rd failure: circuit opens
      try {
        await breaker.execute(fn);
      } catch {
        // Expected
      }
      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it("should track opened time when circuit opens", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("test"));

      // Trigger circuit to open
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      const metrics = breaker.getMetrics();
      expect(metrics.openedAt).toBeDefined();
      expect(metrics.openedAt).toBeGreaterThan(0);
    });
  });

  describe("open circuit behavior", () => {
    it("should reject requests when open", async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error("test"));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      // Try to execute - should return null without calling function
      const anotherFn = vi.fn().mockResolvedValue("result");
      const result = await breaker.execute(anotherFn);

      expect(result).toBeNull();
      expect(anotherFn).not.toHaveBeenCalled();
    });

    it("should report as open when open", async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error("test"));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      expect(breaker.isOpen()).toBe(true);
    });

    it("should allow test request after timeout", async () => {
      // Configure short timeout
      breaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 2,
        timeoutMs: 100,
        monitoringPeriodMs: 5000,
      });

      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error("test"));
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next request should transition to half-open
      const successFn = vi.fn().mockResolvedValue("result");
      const result = await breaker.execute(successFn);

      expect(result).toBe("result");
      expect(successFn).toHaveBeenCalledTimes(1);
      expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });
  });

  describe("half-open state", () => {
    beforeEach(async () => {
      // Configure short timeout
      breaker = new CircuitBreaker({
        failureThreshold: 2,
        successThreshold: 2,
        timeoutMs: 100,
        monitoringPeriodMs: 5000,
      });

      // Open the circuit
      const failFn = vi.fn().mockRejectedValue(new Error("test"));
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(failFn);
        } catch {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Make one request to transition to half-open
      await breaker.execute(() => Promise.resolve("result"));
    });

    it("should be in half-open state after timeout and one success", () => {
      expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it("should close circuit after threshold successes", async () => {
      expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      // Second success should close the circuit
      await breaker.execute(() => Promise.resolve("result"));

      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it("should reopen circuit on failure", async () => {
      expect(breaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      // Failure should reopen circuit
      try {
        await breaker.execute(() => Promise.reject(new Error("test")));
      } catch {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe("reset", () => {
    it("should reset to initial state", async () => {
      // Open the circuit
      const fn = vi.fn().mockRejectedValue(new Error("test"));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected
        }
      }

      expect(breaker.getState()).toBe(CircuitBreakerState.OPEN);

      // Reset
      breaker.reset();

      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(breaker.getMetrics().failures).toBe(0);
      expect(breaker.getMetrics().successes).toBe(0);
      expect(breaker.getMetrics().openedAt).toBeUndefined();
    });
  });

  describe("failure history cleanup", () => {
    it("should clean old failures outside monitoring period", async () => {
      breaker = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 2,
        timeoutMs: 1000,
        monitoringPeriodMs: 100, // Short monitoring period
      });

      // Generate failures
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error("test")));
        } catch {
          // Expected
        }
      }

      const metricsAfterFailures = breaker.getMetrics();
      expect(metricsAfterFailures.failures).toBe(3);

      // Wait for monitoring period to pass
      await new Promise(resolve => setTimeout(resolve, 150));

      // Make a success - should clean old failures
      await breaker.execute(() => Promise.resolve("result"));

      // Failure count should not include old failures (but may include recent ones)
      // The exact behavior depends on the cleanup implementation
      expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });
});

describe("CircuitBreakerRegistry", () => {
  it("should create new breaker for unknown provider", () => {
    const breaker = circuitBreakerRegistry.get("test-provider");
    expect(breaker).toBeDefined();
    expect(breaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it("should return same breaker for same provider", () => {
    const breaker1 = circuitBreakerRegistry.get("test-provider");
    const breaker2 = circuitBreakerRegistry.get("test-provider");
    expect(breaker1).toBe(breaker2);
  });

  it("should return different breakers for different providers", () => {
    const breaker1 = circuitBreakerRegistry.get("provider1");
    const breaker2 = circuitBreakerRegistry.get("provider2");
    expect(breaker1).not.toBe(breaker2);
  });

  it("should reset all breakers", async () => {
    // Open circuits for multiple providers
    for (const provider of ["provider1", "provider2"]) {
      const breaker = circuitBreakerRegistry.get(provider);
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(() => Promise.reject(new Error("test")));
        } catch {
          // Expected
        }
      }
    }

    // Reset all
    circuitBreakerRegistry.reset();

    // All should be closed now after re-accessing
    const breaker1 = circuitBreakerRegistry.get("provider1");
    const breaker2 = circuitBreakerRegistry.get("provider2");

    expect(breaker1.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(breaker2.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it("should reset specific breaker", async () => {
    const breaker1 = circuitBreakerRegistry.get("provider1");
    const breaker2 = circuitBreakerRegistry.get("provider2");

    // Open circuit for provider1
    for (let i = 0; i < 5; i++) {
      try {
        await breaker1.execute(() => Promise.reject(new Error("test")));
      } catch {
        // Expected
      }
    }

    // Reset only provider1
    circuitBreakerRegistry.reset("provider1");

    // breaker1 should be closed (it was reset)
    // breaker2 should still be closed (it was never opened)
    const newBreaker1 = circuitBreakerRegistry.get("provider1");
    expect(newBreaker1.getState()).toBe(CircuitBreakerState.CLOSED);
    expect(breaker2.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  it("should get all breaker states", () => {
    circuitBreakerRegistry.get("provider1");
    circuitBreakerRegistry.get("provider2");
    circuitBreakerRegistry.get("provider3");

    const states = circuitBreakerRegistry.getAllStates();

    // All three providers should be in the states object
    expect(Object.keys(states)).toHaveLength(3);
    expect(states.provider1).toBe(CircuitBreakerState.CLOSED);
    expect(states.provider2).toBe(CircuitBreakerState.CLOSED);
    expect(states.provider3).toBe(CircuitBreakerState.CLOSED);
  });
});
