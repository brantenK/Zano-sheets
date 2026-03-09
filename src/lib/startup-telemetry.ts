/**
 * Startup telemetry for measuring taskpane performance.
 *
 * This module provides utilities for measuring and recording
 * startup-related performance metrics.
 */

import {
  type PerfMetric,
  recordPerfMetric,
  startPerfSpan,
} from "./perf-telemetry";

/**
 * Startup phase markers.
 */
export type StartupPhase =
  | "taskpane_first_paint"
  | "taskpane_interactive"
  | "settings_open"
  | "first_prompt_send"
  | "first_streamed_token"
  | "bash_workflow_start"
  | "file_workflow_start"
  | "session_restore"
  | "vfs_restore";

/**
 * Startup telemetry state.
 */
interface StartupTelemetryState {
  startTime: number | null;
  firstPaintTime: number | null;
  interactiveTime: number | null;
  phases: Map<StartupPhase, number>;
  completed: boolean;
}

const state: StartupTelemetryState = {
  startTime: null,
  firstPaintTime: null,
  interactiveTime: null,
  phases: new Map(),
  completed: false,
};

/**
 * Get the performance metric name for a startup phase.
 */
function phaseToMetric(phase: StartupPhase): PerfMetric {
  const mapping: Record<StartupPhase, PerfMetric> = {
    taskpane_first_paint: "taskpane_first_paint_ms",
    taskpane_interactive: "taskpane_interactive_ms",
    settings_open: "settings_open_ms",
    first_prompt_send: "first_prompt_send_ms",
    first_streamed_token: "first_streamed_token_ms",
    bash_workflow_start: "bash_workflow_start_ms",
    file_workflow_start: "file_workflow_start_ms",
    session_restore: "session_restore_ms",
    vfs_restore: "vfs_restore_ms",
  };
  return mapping[phase];
}

/**
 * Initialize startup telemetry.
 * Call this as early as possible in the taskpane initialization.
 */
export function initStartupTelemetry(): void {
  if (state.startTime !== null) return; // Already initialized

  // Try to use navigation timing if available
  if (performance.getEntriesByType?.("navigation")[0]) {
    const navEntry = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    state.startTime = navEntry.fetchStart;
  } else {
    // Fallback to current time
    state.startTime = performance.now();
  }
}

/**
 * Mark the first paint time.
 * Call this when the taskpane first renders.
 */
export function markFirstPaint(): void {
  if (state.firstPaintTime !== null) return; // Already marked

  initStartupTelemetry();
  const now = performance.now();
  state.firstPaintTime = now;

  if (state.startTime !== null) {
    const duration = now - state.startTime;
    recordPerfMetric("taskpane_first_paint_ms", duration);
    state.phases.set("taskpane_first_paint", duration);
  }
}

/**
 * Mark the interactive time.
 * Call this when the taskpane becomes interactive (buttons work, input focusable).
 */
export function markInteractive(): void {
  if (state.interactiveTime !== null) return; // Already marked

  initStartupTelemetry();
  const now = performance.now();
  state.interactiveTime = now;

  if (state.startTime !== null) {
    const duration = now - state.startTime;
    recordPerfMetric("taskpane_interactive_ms", duration);
    state.phases.set("taskpane_interactive", duration);
  }
}

/**
 * Mark a startup phase.
 */
export function markStartupPhase(phase: StartupPhase): void {
  initStartupTelemetry();
  const now = performance.now();

  let duration = 0;
  if (state.startTime !== null) {
    duration = now - state.startTime;
  }

  const metric = phaseToMetric(phase);
  recordPerfMetric(metric, duration);
  state.phases.set(phase, duration);
}

/**
 * Start a span for measuring a phase duration.
 * Returns a span that must be ended manually.
 */
export function startStartupPhase(phase: StartupPhase): { end: () => void } {
  initStartupTelemetry();
  const metric = phaseToMetric(phase);
  return startPerfSpan(metric);
}

/**
 * Mark settings panel open.
 */
export function markSettingsOpen(): void {
  markStartupPhase("settings_open");
}

/**
 * Mark first prompt send.
 */
export function markFirstPromptSend(): void {
  markStartupPhase("first_prompt_send");
}

/**
 * Mark first streamed token received.
 */
export function markFirstStreamedToken(): void {
  markStartupPhase("first_streamed_token");
}

/**
 * Mark bash workflow start.
 */
export function markBashWorkflowStart(): void {
  markStartupPhase("bash_workflow_start");
}

/**
 * Mark file workflow start.
 */
export function markFileWorkflowStart(): void {
  markStartupPhase("file_workflow_start");
}

/**
 * Mark session restore complete.
 */
export function markSessionRestore(): void {
  markStartupPhase("session_restore");
}

/**
 * Mark VFS restore complete.
 */
export function markVfsRestore(): void {
  markStartupPhase("vfs_restore");
}

/**
 * Mark startup as complete.
 * Call this when all initial startup work is done.
 */
export function markStartupComplete(): void {
  state.completed = true;
}

/**
 * Get the current startup telemetry summary.
 */
export function getStartupTelemetrySummary(): {
  startTime: number | null;
  firstPaintTime: number | null;
  interactiveTime: number | null;
  phases: Record<StartupPhase, number | null>;
  completed: boolean;
} {
  return {
    startTime: state.startTime,
    firstPaintTime: state.firstPaintTime,
    interactiveTime: state.interactiveTime,
    phases: Object.fromEntries(state.phases) as Record<StartupPhase, number>,
    completed: state.completed,
  };
}

/**
 * Export startup telemetry for diagnostics.
 */
export function exportStartupTelemetry(): string {
  const summary = getStartupTelemetrySummary();
  return JSON.stringify(summary, null, 2);
}

/**
 * Check if startup telemetry has been initialized.
 */
export function isStartupTelemetryInitialized(): boolean {
  return state.startTime !== null;
}

/**
 * Check if a specific phase has been recorded.
 */
export function hasStartupPhase(phase: StartupPhase): boolean {
  return state.phases.has(phase);
}

/**
 * Get the duration of a specific phase.
 */
export function getStartupPhaseDuration(phase: StartupPhase): number | null {
  return state.phases.get(phase) ?? null;
}

/**
 * Reset startup telemetry.
 * Use this for testing or when starting a fresh session.
 */
export function resetStartupTelemetry(): void {
  state.startTime = null;
  state.firstPaintTime = null;
  state.interactiveTime = null;
  state.phases.clear();
  state.completed = false;
}

/**
 * Helper: Measure a function's execution time and record as a startup phase.
 */
export async function measureStartupPhase<T>(
  phase: StartupPhase,
  fn: () => Promise<T>,
): Promise<T> {
  const span = startStartupPhase(phase);
  try {
    return await fn();
  } finally {
    span.end();
  }
}

/**
 * Helper: Measure a synchronous function's execution time.
 */
export function measureStartupPhaseSync<T>(
  phase: StartupPhase,
  fn: () => T,
): T {
  const span = startStartupPhase(phase);
  try {
    return fn();
  } finally {
    span.end();
  }
}
