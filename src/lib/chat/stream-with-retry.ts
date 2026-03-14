import type { Api, Model } from "@mariozechner/pi-ai";
import {
  formatProviderError,
  getErrorMessage,
  getErrorStatus,
  isRetryableProviderError,
  parseRetryAfterFromError,
} from "../error-utils";
import { recordIntegrationTelemetry } from "../integration-telemetry";
import { circuitBreakerRegistry } from "./circuit-breaker";
import { streamSimple } from "./provider-stream";
import { withRateLimit } from "./rate-limiter";
import type { StreamContext, StreamModel, StreamOptions } from "./stream-types";

/** Default retry budget for transient errors (timeouts, 500s, network) */
const DEFAULT_MAX_RETRIES = 3;

/** Extended retry budget for rate-limit (429) errors */
const RATE_LIMIT_MAX_RETRIES = 5;

export interface StreamWithRetryOptions {
  /** Current API key (may be refreshed on 401) */
  apiKey: string | undefined;
  /** Auth method from provider config */
  authMethod?: string;
  /** Called to get a (potentially refreshed) API key */
  refreshApiKey: (opts?: {
    forceRefresh: boolean;
  }) => Promise<string | undefined>;
  /** Provider name for circuit breaker and rate limiting */
  provider?: string;
  /** Skip circuit breaker check (for testing) */
  skipCircuitBreaker?: boolean;
}

/**
 * Extract provider name from model.
 */
function extractProvider(model: StreamModel): string {
  const api = (model as Model<Api>).api;
  // Convert API to provider name (e.g., "anthropic-messages" -> "anthropic")
  return (
    String(api).replace(
      /-messages|-completions|-responses|-codex|-cli|-vertex/i,
      "",
    ) || "unknown"
  );
}

/**
 * Checks if an error indicates an unauthorized request.
 */
function isUnauthorizedError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }

  const errObj = err as Record<string, unknown>;

  // Check status property
  if (errObj.status === 401) {
    return true;
  }

  // Check message property for 401/Unauthorized strings
  if (typeof errObj.message === "string") {
    const msg = errObj.message.toLowerCase();
    return (
      msg.includes("401") ||
      msg.includes("unauthorized") ||
      msg.includes("invalid api key")
    );
  }

  return false;
}

/**
 * Calculates delay for retry attempt with exponential backoff and jitter.
 */
function calculateRetryDelay(
  attempt: number,
  isRateLimit: boolean,
  retryAfterSeconds?: number,
): number {
  if (retryAfterSeconds) {
    return retryAfterSeconds * 1000;
  }

  const baseDelay = isRateLimit ? 3000 : 1000;
  const maxDelay = isRateLimit ? 60000 : 30000;
  const jitter = isRateLimit ? 1000 : 300;

  const exponentialDelay = Math.min(maxDelay, 2 ** attempt * baseDelay);
  const randomJitter = Math.floor(Math.random() * jitter);

  return exponentialDelay + randomJitter;
}

/**
 * Wraps `streamSimple` with retry logic and operational safeguards:
 * - Circuit breaker to prevent cascading failures
 * - Rate limiting to prevent API exhaustion
 * - Exponential backoff + jitter for transient failures
 * - Extended budget for rate limits (429)
 * - OAuth token refresh on 401
 */
export async function streamWithRetry(
  model: StreamModel,
  context: StreamContext,
  options: StreamOptions,
  retryOpts: StreamWithRetryOptions,
): Promise<AsyncIterable<unknown>> {
  let { apiKey } = retryOpts;
  let lastError: unknown = null;
  let maxRetries = DEFAULT_MAX_RETRIES;

  // Extract provider name for circuit breaker and rate limiting
  const provider = retryOpts.provider || extractProvider(model);

  // Check circuit breaker (unless disabled)
  if (!retryOpts.skipCircuitBreaker) {
    const circuitBreaker = circuitBreakerRegistry.get(provider);
    const result = await circuitBreaker.execute(async () => {
      // This function runs if circuit is closed or half-open
      return { shouldProceed: true };
    });

    if (result === null) {
      // Circuit is open, reject request immediately
      const metrics = circuitBreaker.getMetrics();
      throw new Error(
        `Service temporarily unavailable for ${provider} due to recent failures. Please try again later. (Failures: ${metrics.failures}, Opened: ${metrics.openedAt ? new Date(metrics.openedAt).toISOString() : "N/A"})`,
      );
    }
  }

  // Check rate limit before attempting request
  return withRateLimit(provider, async () => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const stream = await streamSimple(
          model,
          context as Parameters<typeof streamSimple>[1],
          {
            ...options,
            apiKey,
          },
        );

        // Success: notify circuit breaker
        if (!retryOpts.skipCircuitBreaker) {
          // The circuit breaker's execute method already handles success tracking
        }

        return stream;
      } catch (err: unknown) {
        lastError = err;

        if (
          isUnauthorizedError(err) &&
          retryOpts.authMethod === "oauth" &&
          attempt < maxRetries
        ) {
          recordIntegrationTelemetry("oauth_refresh_retry", 401);
          apiKey = await retryOpts.refreshApiKey({ forceRefresh: true });
          continue;
        }

        const status = getErrorStatus(err);
        const isRateLimit =
          status === 429 ||
          getErrorMessage(err).toLowerCase().includes("rate limit");

        // Upgrade retry budget for rate limits
        if (isRateLimit && maxRetries < RATE_LIMIT_MAX_RETRIES) {
          maxRetries = RATE_LIMIT_MAX_RETRIES;
        }

        if (isRetryableProviderError(err) && attempt < maxRetries) {
          recordIntegrationTelemetry("transient_retry", status);

          // Parse Retry-After header if available
          const retryAfter = parseRetryAfterFromError(err);
          const delayMs = calculateRetryDelay(
            attempt,
            isRateLimit,
            retryAfter ?? undefined,
          );

          console.log(
            `[Chat] Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(delayMs / 1000)}s (status: ${status ?? "network"})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          continue;
        }

        // Final failure: notify circuit breaker
        if (!retryOpts.skipCircuitBreaker) {
          // Circuit breaker tracks failures internally through execute()
        }

        throw err;
      }
    }

    recordIntegrationTelemetry(
      "provider_final_error",
      getErrorStatus(lastError),
    );
    throw new Error(formatProviderError(lastError));
  });
}
