export type PerfMetric =
  | "taskpane_first_paint_ms"
  | "taskpane_interactive_ms"
  | "settings_open_ms"
  | "first_prompt_send_ms"
  | "first_streamed_token_ms"
  | "bash_workflow_start_ms"
  | "file_workflow_start_ms"
  | "bash_command_ms"
  | "pdf_to_text_ms"
  | "pdf_to_images_ms"
  | "docx_to_text_ms"
  | "xlsx_to_csv_ms"
  | "agent_prompt_ms"
  | "workbook_metadata_ms"
  | "get_cell_ranges_ms"
  | "set_cell_range_ms"
  | "tool_update_batch_size"
  | "session_restore_ms"
  | "vfs_restore_ms"
  | "stream_completion_ms";

export interface PerfMetricStats {
  count: number;
  total: number;
  max: number;
  min: number;
  last: number;
  samples: number[];
}

export interface PerfTelemetry {
  updatedAt: number;
  metrics: Record<PerfMetric, PerfMetricStats>;
}

const PERF_TELEMETRY_KEY = "zanosheets-perf-telemetry-v1";
const MAX_SAMPLES = 120;

function emptyStats(): PerfMetricStats {
  return { count: 0, total: 0, max: 0, min: Infinity, last: 0, samples: [] };
}

function cloneDefaults(): PerfTelemetry {
  return {
    updatedAt: 0,
    metrics: {
      taskpane_first_paint_ms: emptyStats(),
      taskpane_interactive_ms: emptyStats(),
      settings_open_ms: emptyStats(),
      first_prompt_send_ms: emptyStats(),
      first_streamed_token_ms: emptyStats(),
      bash_workflow_start_ms: emptyStats(),
      file_workflow_start_ms: emptyStats(),
      bash_command_ms: emptyStats(),
      pdf_to_text_ms: emptyStats(),
      pdf_to_images_ms: emptyStats(),
      docx_to_text_ms: emptyStats(),
      xlsx_to_csv_ms: emptyStats(),
      agent_prompt_ms: emptyStats(),
      workbook_metadata_ms: emptyStats(),
      get_cell_ranges_ms: emptyStats(),
      set_cell_range_ms: emptyStats(),
      tool_update_batch_size: emptyStats(),
      session_restore_ms: emptyStats(),
      vfs_restore_ms: emptyStats(),
      stream_completion_ms: emptyStats(),
    },
  };
}

export function loadPerfTelemetry(): PerfTelemetry {
  try {
    const raw = localStorage.getItem(PERF_TELEMETRY_KEY);
    if (!raw) return cloneDefaults();

    const parsed = JSON.parse(raw) as Partial<PerfTelemetry>;
    const out = cloneDefaults();
    out.updatedAt = parsed.updatedAt ?? 0;

    if (parsed.metrics) {
      for (const key of Object.keys(out.metrics) as PerfMetric[]) {
        const src = parsed.metrics[key];
        if (!src) continue;
        out.metrics[key] = {
          count: typeof src.count === "number" ? src.count : 0,
          total: typeof src.total === "number" ? src.total : 0,
          max: typeof src.max === "number" ? src.max : 0,
          min:
            typeof src.min === "number" && src.min !== Infinity ? src.min : 0,
          last: typeof src.last === "number" ? src.last : 0,
          samples: Array.isArray(src.samples)
            ? src.samples
                .filter((n) => typeof n === "number")
                .slice(-MAX_SAMPLES)
            : [],
        };
      }
    }

    return out;
  } catch {
    return cloneDefaults();
  }
}

function savePerfTelemetry(telemetry: PerfTelemetry): void {
  try {
    localStorage.setItem(PERF_TELEMETRY_KEY, JSON.stringify(telemetry));
  } catch {
    // no-op
  }
}

export function recordPerfMetric(metric: PerfMetric, value: number): void {
  if (!Number.isFinite(value) || value < 0) return;

  const telemetry = loadPerfTelemetry();
  const stats = telemetry.metrics[metric] ?? emptyStats();
  const normalized = Number(value.toFixed(2));

  stats.count += 1;
  stats.total += normalized;
  stats.max = Math.max(stats.max, normalized);
  stats.min =
    stats.min === Infinity ? normalized : Math.min(stats.min, normalized);
  stats.last = normalized;
  stats.samples.push(normalized);
  if (stats.samples.length > MAX_SAMPLES) {
    stats.samples = stats.samples.slice(-MAX_SAMPLES);
  }

  telemetry.metrics[metric] = stats;
  telemetry.updatedAt = Date.now();
  savePerfTelemetry(telemetry);
}

export function clearPerfTelemetry(): void {
  try {
    localStorage.removeItem(PERF_TELEMETRY_KEY);
  } catch {
    // no-op
  }
}

export function summarizePerfMetric(stats: PerfMetricStats): {
  avg: number;
  p95: number;
  min: number;
  max: number;
} {
  if (stats.count === 0 || stats.samples.length === 0) {
    return { avg: 0, p95: 0, min: 0, max: 0 };
  }

  const avg = stats.total / stats.count;
  const sorted = [...stats.samples].sort((a, b) => a - b);
  const idx = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  const p95 = sorted[idx] ?? 0;
  return {
    avg: Number(avg.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    min: Number(stats.min.toFixed(2)),
    max: Number(stats.max.toFixed(2)),
  };
}

/**
 * Performance span for timing operations.
 *
 * Usage:
 * ```ts
 * const span = startPerfSpan("workbook_metadata_ms");
 * await doWork();
 * span.end();
 * ```
 */
export function startPerfSpan(metric: PerfMetric): PerfSpan {
  const startTime = performance.now();
  let ended = false;

  return {
    end: () => {
      if (ended) return;
      ended = true;
      const duration = performance.now() - startTime;
      recordPerfMetric(metric, duration);
    },
    cancel: () => {
      ended = true;
    },
  };
}

export interface PerfSpan {
  end: () => void;
  cancel: () => void;
}

/**
 * Get all performance telemetry as a summary for diagnostics.
 */
export function getPerfSummary(): {
  updatedAt: number;
  metrics: Record<
    PerfMetric,
    {
      count: number;
      avg: number;
      p95: number;
      min: number;
      max: number;
      last: number;
    }
  >;
} {
  const telemetry = loadPerfTelemetry();
  const summary: {
    updatedAt: number;
    metrics: Record<
      PerfMetric,
      {
        count: number;
        avg: number;
        p95: number;
        min: number;
        max: number;
        last: number;
      }
    >;
  } = {
    updatedAt: telemetry.updatedAt,
    metrics: {} as Record<
      PerfMetric,
      {
        count: number;
        avg: number;
        p95: number;
        min: number;
        max: number;
        last: number;
      }
    >,
  };

  for (const key of Object.keys(telemetry.metrics) as PerfMetric[]) {
    const stats = telemetry.metrics[key];
    const { avg, p95, min, max } = summarizePerfMetric(stats);
    summary.metrics[key] = {
      count: stats.count,
      avg,
      p95,
      min,
      max,
      last: stats.last,
    };
  }

  return summary;
}

/**
 * Export telemetry data for debugging.
 */
export function exportPerfTelemetry(): string {
  const telemetry = loadPerfTelemetry();
  return JSON.stringify(telemetry, null, 2);
}

/**
 * Check if a metric meets a performance threshold.
 */
export function checkPerfThreshold(
  metric: PerfMetric,
  thresholdMs: number,
): { passed: boolean; current: number; threshold: number } {
  const telemetry = loadPerfTelemetry();
  const stats = telemetry.metrics[metric];
  const current = stats?.last ?? 0;
  return {
    passed: current > 0 && current <= thresholdMs,
    current,
    threshold: thresholdMs,
  };
}
