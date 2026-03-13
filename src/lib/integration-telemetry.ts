export type IntegrationTelemetryReason =
  | "oauth_refresh_retry"
  | "transient_retry"
  | "provider_final_error"
  | "send_message_error"
  | "stream_stall_timeout"
  | "stream_completion_fallback"
  | "tool_loop_limit"
  | "tool_loop_identical_errors";

export interface ErrorRecord {
  context: string;
  message: string;
  stack?: string;
  timestamp: number;
}

export interface IntegrationTelemetry {
  updatedAt: number;
  counters: Record<IntegrationTelemetryReason, number>;
  statusCounts: Record<string, number>;
}

const TELEMETRY_KEY = "zanosheets-integration-telemetry-v1";

const DEFAULT_TELEMETRY: IntegrationTelemetry = {
  updatedAt: 0,
  counters: {
    oauth_refresh_retry: 0,
    transient_retry: 0,
    provider_final_error: 0,
    send_message_error: 0,
    stream_stall_timeout: 0,
    stream_completion_fallback: 0,
    tool_loop_limit: 0,
    tool_loop_identical_errors: 0,
  },
  statusCounts: {},
};

function safeParseTelemetry(raw: string | null): IntegrationTelemetry {
  if (!raw) return { ...DEFAULT_TELEMETRY, statusCounts: {} };

  try {
    const parsed = JSON.parse(raw) as Partial<IntegrationTelemetry>;
    return {
      updatedAt: parsed.updatedAt ?? 0,
      counters: {
        ...DEFAULT_TELEMETRY.counters,
        ...(parsed.counters ?? {}),
      },
      statusCounts: {
        ...(parsed.statusCounts ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_TELEMETRY, statusCounts: {} };
  }
}

export function loadIntegrationTelemetry(): IntegrationTelemetry {
  try {
    return safeParseTelemetry(localStorage.getItem(TELEMETRY_KEY));
  } catch {
    return { ...DEFAULT_TELEMETRY, statusCounts: {} };
  }
}

export function recordIntegrationTelemetry(
  reason: IntegrationTelemetryReason,
  status?: number,
) {
  try {
    const telemetry = loadIntegrationTelemetry();
    telemetry.updatedAt = Date.now();
    telemetry.counters[reason] = (telemetry.counters[reason] ?? 0) + 1;

    if (typeof status === "number") {
      const key = String(status);
      telemetry.statusCounts[key] = (telemetry.statusCounts[key] ?? 0) + 1;
    }

    localStorage.setItem(TELEMETRY_KEY, JSON.stringify(telemetry));
  } catch {
    // no-op
  }
}

export function clearIntegrationTelemetry() {
  try {
    localStorage.removeItem(TELEMETRY_KEY);
  } catch {
    // no-op
  }
}

const ERROR_TELEMETRY_KEY = "zanosheets-error-telemetry-v1";
const MAX_ERRORS = 50;

/**
 * Record an error to the error telemetry store.
 */
export function recordError(error: ErrorRecord): void {
  try {
    const raw = localStorage.getItem(ERROR_TELEMETRY_KEY);
    let errors: ErrorRecord[] = [];

    if (raw) {
      try {
        errors = JSON.parse(raw);
        if (!Array.isArray(errors)) {
          errors = [];
        }
      } catch {
        errors = [];
      }
    }

    errors.push(error);

    // Keep only the most recent errors
    if (errors.length > MAX_ERRORS) {
      errors = errors.slice(-MAX_ERRORS);
    }

    localStorage.setItem(ERROR_TELEMETRY_KEY, JSON.stringify(errors));
  } catch {
    // no-op
  }
}

/**
 * Load all recorded errors.
 */
export function loadErrors(): ErrorRecord[] {
  try {
    const raw = localStorage.getItem(ERROR_TELEMETRY_KEY);
    if (!raw) return [];
    const errors = JSON.parse(raw);
    return Array.isArray(errors) ? errors : [];
  } catch {
    return [];
  }
}

/**
 * Clear all recorded errors.
 */
export function clearErrors(): void {
  try {
    localStorage.removeItem(ERROR_TELEMETRY_KEY);
  } catch {
    // no-op
  }
}
