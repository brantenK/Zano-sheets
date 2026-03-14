/**
 * Circuit Breaker implementation for streaming operations.
 *
 * A circuit breaker prevents cascading failures by:
 * 1. Opening the circuit when failure threshold is reached
 * 2. Rejecting requests while open
 * 3. Allowing a test request after timeout (half-open state)
 * 4. Closing the circuit if test succeeds
 *
 * This prevents overwhelming a failing service and allows it to recover.
 */

import type {
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
} from "./stream-types";
import { CircuitBreakerState } from "./stream-types";

// Re-export CircuitBreakerState for convenience
export { CircuitBreakerState };

const DEFAULT_CONFIG = {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 60000, // 1 minute
  monitoringPeriodMs: 300000, // 5 minutes
} as const;

/**
 * Circuit Breaker class for managing service state.
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;

  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private metrics: CircuitBreakerMetrics = {
    failures: 0,
    successes: 0,
  };
  private failureHistory: number[] = [];
  private nextAttemptTime: number = 0;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function through the circuit breaker.
   * Returns null if circuit is open (request rejected).
   */
  async execute<T>(fn: () => Promise<T>): Promise<T | null> {
    if (this.isOpen()) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
      } else {
        console.warn("[CircuitBreaker] Circuit is OPEN, rejecting request");
        return null;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Check if circuit is currently open.
   */
  isOpen(): boolean {
    if (this.state === CircuitBreakerState.OPEN) {
      return true;
    }
    return false;
  }

  /**
   * Check if we should attempt to reset the circuit.
   */
  private shouldAttemptReset(): boolean {
    return Date.now() >= this.nextAttemptTime;
  }

  /**
   * Handle successful execution.
   */
  private onSuccess(): void {
    this.metrics.successes++;
    this.metrics.lastSuccessTime = Date.now();

    // Clean old failure history
    this.cleanFailureHistory();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.metrics.successes >= this.config.successThreshold) {
        this.close();
      }
    }
  }

  /**
   * Handle failed execution.
   */
  private onFailure(): void {
    this.metrics.failures++;
    this.metrics.lastFailureTime = Date.now();
    this.failureHistory.push(Date.now());

    // Clean old failure history
    this.cleanFailureHistory();

    const recentFailures = this.countRecentFailures();
    if (recentFailures >= this.config.failureThreshold) {
      this.open();
    }
  }

  /**
   * Count failures within the monitoring period.
   */
  private countRecentFailures(): number {
    const now = Date.now();
    const monitoringStart = now - this.config.monitoringPeriodMs;
    return this.failureHistory.filter((t) => t >= monitoringStart).length;
  }

  /**
   * Remove failure history outside monitoring period.
   */
  private cleanFailureHistory(): void {
    const now = Date.now();
    const monitoringStart = now - this.config.monitoringPeriodMs;
    this.failureHistory = this.failureHistory.filter(
      (t) => t >= monitoringStart,
    );
  }

  /**
   * Open the circuit (stop accepting requests).
   */
  private open(): void {
    this.state = CircuitBreakerState.OPEN;
    this.metrics.openedAt = Date.now();
    this.nextAttemptTime = Date.now() + this.config.timeoutMs;
    console.error(
      `[CircuitBreaker] Circuit OPENED after ${this.metrics.failures} failures. Next attempt at ${new Date(this.nextAttemptTime).toISOString()}`,
    );
  }

  /**
   * Close the circuit (accept requests normally).
   */
  private close(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.metrics.failures = 0;
    this.metrics.successes = 0;
    this.metrics.openedAt = undefined;
    console.log(
      "[CircuitBreaker] Circuit CLOSED - accepting requests normally",
    );
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get current metrics.
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset the circuit breaker to initial state.
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.metrics = {
      failures: 0,
      successes: 0,
    };
    this.failureHistory = [];
    this.nextAttemptTime = 0;
    console.log("[CircuitBreaker] Reset to initial state");
  }
}

/**
 * Create a circuit breaker for a specific provider.
 */
export function createProviderCircuitBreaker(
  provider: string,
  config?: Partial<CircuitBreakerConfig>,
): CircuitBreaker {
  const breaker = new CircuitBreaker(config);

  // Log state changes
  const originalExecute = breaker.execute.bind(breaker);
  breaker.execute = async <T>(fn: () => Promise<T>) => {
    console.debug(`[CircuitBreaker:${provider}] State: ${breaker.getState()}`);
    return originalExecute(fn);
  };

  return breaker;
}

/**
 * Global circuit breaker registry by provider.
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(provider: string): CircuitBreaker {
    if (!this.breakers.has(provider)) {
      this.breakers.set(provider, createProviderCircuitBreaker(provider));
    }
    const breaker = this.breakers.get(provider);
    if (!breaker) {
      throw new Error(
        `Failed to initialize circuit breaker for provider '${provider}'.`,
      );
    }
    return breaker;
  }

  reset(provider?: string): void {
    if (provider) {
      this.get(provider).reset();
    } else {
      this.breakers.forEach((b) => {
        b.reset();
      });
      this.breakers.clear();
    }
  }

  getAllStates(): Record<string, CircuitBreakerState> {
    const states: Record<string, CircuitBreakerState> = {};
    this.breakers.forEach((breaker, provider) => {
      states[provider] = breaker.getState();
    });
    return states;
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();
