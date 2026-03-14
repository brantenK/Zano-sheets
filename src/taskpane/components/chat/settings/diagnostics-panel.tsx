import type { IntegrationTelemetry } from "../../../../lib/integration-telemetry";

type PerfSummary = {
  updatedAt: number;
  metrics: Record<
    string,
    {
      count: number;
      avg: number;
      p95: number;
      min: number;
      max: number;
      last: number;
    }
  >;
};

type StartupSummary = {
  startTime: number | null;
  firstPaintTime: number | null;
  interactiveTime: number | null;
  phases: Record<string, number | null>;
  completed: boolean;
};

interface DiagnosticsPanelProps {
  providerHealth: { blocking: string[]; warnings: string[] };
  integrationTelemetry: IntegrationTelemetry;
  perfSummary: PerfSummary;
  startupSummary: StartupSummary;
  oauthReconnectRequired: boolean;
  onResetIntegrationCounters: () => void;
  onResetPerfTelemetry: () => void;
}

const perfMetricRows: Array<[string, string]> = [
  ["stream_message", "Stream message"],
  ["save_value", "Save value"],
  ["run_tool", "Run tool"],
];

export function DiagnosticsPanel({
  providerHealth,
  integrationTelemetry,
  perfSummary,
  startupSummary,
  oauthReconnectRequired,
  onResetIntegrationCounters,
  onResetPerfTelemetry,
}: DiagnosticsPanelProps) {
  return (
    <>
      <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted) mb-2">
        integration diagnostics
      </div>
      <div className="text-xs text-(--chat-text-secondary) space-y-1">
        <div>Config blocking issues: {providerHealth.blocking.length}</div>
        <div>Config warnings: {providerHealth.warnings.length}</div>
        <div>
          OAuth refresh retries:{" "}
          {integrationTelemetry.counters.oauth_refresh_retry}
        </div>
        <div>OAuth credentials stored: [see credential storage settings]</div>
        <div>
          Transient retries: {integrationTelemetry.counters.transient_retry}
        </div>
        <div>
          Final provider errors:{" "}
          {integrationTelemetry.counters.provider_final_error}
        </div>
        <div>
          Send message errors:{" "}
          {integrationTelemetry.counters.send_message_error}
        </div>
        <div className="text-(--chat-text-muted)">
          Last updated:{" "}
          {integrationTelemetry.updatedAt
            ? new Date(integrationTelemetry.updatedAt).toLocaleString()
            : "never"}
        </div>
        <div className="text-(--chat-text-muted) break-all">
          Status counts: {JSON.stringify(integrationTelemetry.statusCounts)}
        </div>
        <div className="pt-2 text-(--chat-text-primary)">
          Performance telemetry
        </div>
        {perfMetricRows.map(([metricKey, label]) => {
          const stats =
            perfSummary.metrics[metricKey as keyof typeof perfSummary.metrics];
          if (!stats) return null;
          return (
            <div key={metricKey}>
              {label}: count {stats.count}, avg {stats.avg}ms, p95 {stats.p95}
              ms, last {stats.last}ms
            </div>
          );
        })}
        <div className="text-(--chat-text-muted)">
          Startup phases: {JSON.stringify(startupSummary.phases)}
        </div>
        {oauthReconnectRequired && (
          <div className="text-(--chat-warning)">
            Reconnect required: stored OAuth credentials are missing for the
            selected provider.
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onResetIntegrationCounters}
          className="px-3 py-1.5 text-xs border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors"
        >
          Reset integration counters
        </button>
        <button
          type="button"
          onClick={onResetPerfTelemetry}
          className="px-3 py-1.5 text-xs border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors"
        >
          Reset perf telemetry
        </button>
      </div>
    </>
  );
}
