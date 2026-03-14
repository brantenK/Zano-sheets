/**
 * Shared error handling utilities for provider/agent errors.
 *
 * Extracted from chat-context.tsx and deep-agent.ts to eliminate duplication.
 */

export function getErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  if (
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  return undefined;
}

export function getErrorMessage(err: unknown): string {
  if (err === null || err === undefined) return "Unknown error";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export function isRetryableProviderError(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (status && [408, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = getErrorMessage(err).toLowerCase();
  return (
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("temporarily unavailable")
  );
}

export function parseRetryAfterFromError(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  // Some provider SDKs attach headers or retryAfter to the error object
  const candidates = ["retryAfter", "retry_after", "retryAfterMs"];
  for (const key of candidates) {
    if (key in err) {
      const val = (err as Record<string, unknown>)[key];
      if (typeof val === "number" && val > 0) {
        // retryAfterMs is in ms, retryAfter in seconds
        return key === "retryAfterMs" ? val / 1000 : val;
      }
    }
  }
  // Check for headers property (common in SDK errors)
  if (
    "headers" in err &&
    typeof (err as Record<string, unknown>).headers === "object"
  ) {
    const headers = (err as { headers: Record<string, string> }).headers;
    const retryAfterHeader =
      headers?.["retry-after"] ?? headers?.["Retry-After"];
    if (retryAfterHeader) {
      const seconds = Number.parseInt(retryAfterHeader, 10);
      if (!Number.isNaN(seconds) && seconds > 0 && seconds <= 120) {
        return seconds;
      }
    }
  }
  return null;
}

/**
 * Redact sensitive information from error messages.
 */
function redactSensitiveInfo(message: string): string {
  // Redact API keys (sk-ant-, sk-proj-, etc.)
  return message.replace(/sk-[a-z0-9_-]{10,}/gi, "[REDACTED API KEY]");
}

export function formatProviderError(err: unknown): string {
  const status = getErrorStatus(err);
  if (status === 401) {
    return "Authentication failed (401). Check your API key or reconnect OAuth.";
  }
  if (status === 403) {
    return "Access denied (403). Verify provider permissions, model access, and billing.";
  }
  if (status === 429) {
    return "Rate limited (429). The provider is throttling requests. Please wait 30-60 seconds and try again, or switch to a different model.";
  }
  if (status && status >= 500) {
    return `Provider temporarily unavailable (${status}). Please retry shortly.`;
  }

  const message = getErrorMessage(err);
  const lower = message.toLowerCase();
  if (lower.includes("cors") || lower.includes("proxy")) {
    return "Request blocked by CORS/proxy configuration. Check proxy settings in Settings.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Network request failed. Check internet connectivity and proxy settings, then retry.";
  }

  // Redact any sensitive information from the message
  const sanitized = redactSensitiveInfo(
    message || "An error occurred while contacting the model provider.",
  );
  return sanitized;
}
