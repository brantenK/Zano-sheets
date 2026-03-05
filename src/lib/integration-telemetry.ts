export type IntegrationTelemetryReason =
  | "oauth_refresh_retry"
  | "transient_retry"
  | "provider_final_error"
  | "send_message_error";

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
