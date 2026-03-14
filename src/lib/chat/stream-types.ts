/**
 * Type definitions for streaming operations.
 *
 * This module provides proper type definitions for streaming interfaces
 * to replace `any` types throughout the codebase.
 */

import type { AgentEvent } from "@mariozechner/pi-agent-core";
import type { Api, AssistantMessage, Model } from "@mariozechner/pi-ai";

/**
 * Stream context passed to provider streaming functions.
 */
export interface StreamContext {
  systemPrompt: string;
  messages: unknown[];
}

/**
 * Options for streaming operations.
 */
export interface StreamOptions {
  apiKey?: string;
  maxTokens?: number;
  sessionId?: string;
  temperature?: number;
}

/**
 * Result type for streaming operations.
 */
export interface StreamResult {
  events: AsyncIterable<AgentEvent>;
  getFinalMessage: () => AssistantMessage;
}

/**
 * Error status codes from provider APIs.
 */
export type ProviderErrorStatus =
  | 400
  | 401
  | 403
  | 404
  | 429
  | 500
  | 502
  | 503
  | 504;

/**
 * Provider error information.
 */
export interface ProviderError {
  status?: ProviderErrorStatus;
  message: string;
  code?: string;
  retryable?: boolean;
}

/**
 * Retry configuration for streaming operations.
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterMs: number;
}

/**
 * Retry state tracking.
 */
export interface RetryState {
  attempt: number;
  lastError: unknown;
  delayMs: number;
}

/**
 * Circuit breaker state.
 */
export enum CircuitBreakerState {
  CLOSED = "closed", // Normal operation
  OPEN = "open", // Failing, reject requests
  HALF_OPEN = "half_open", // Testing if service recovered
}

/**
 * Circuit breaker configuration.
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // Failures before opening
  successThreshold: number; // Successes to close circuit
  timeoutMs: number; // How long to stay open before half-open
  monitoringPeriodMs: number; // Time window to count failures
}

/**
 * Circuit breaker metrics.
 */
export interface CircuitBreakerMetrics {
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  openedAt?: number;
}

/**
 * Model instance for streaming.
 */
export type StreamModel = Model<Api>;

/**
 * Type guard for provider errors.
 */
export function isProviderError(err: unknown): err is ProviderError {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  );
}

/**
 * Extracts error status from provider error.
 */
export function getErrorStatus(err: unknown): ProviderErrorStatus | undefined {
  if (typeof err === "object" && err !== null) {
    if (
      "status" in err &&
      typeof (err as { status: unknown }).status === "number"
    ) {
      return (err as { status: number }).status as ProviderErrorStatus;
    }
  }
  return undefined;
}

/**
 * Checks if an error is retryable based on status code.
 */
export function isRetryableStatus(
  status: ProviderErrorStatus | undefined,
): boolean {
  if (!status) return false;
  return [408, 429, 500, 502, 503, 504].includes(status);
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterMs: 500,
};

/**
 * Rate limit retry configuration (more retries).
 */
export const RATE_LIMIT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 3000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitterMs: 1000,
};

/**
 * Default circuit breaker configuration.
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeoutMs: 60000, // 1 minute
  monitoringPeriodMs: 300000, // 5 minutes
};
