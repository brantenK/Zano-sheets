/**
 * Tool progress indicator component.
 *
 * Shows which tools are running, step numbers, and estimated time remaining.
 * Provides visual feedback for multi-step operations.
 */

import { Clock, Wrench } from "lucide-react";
import type { MessagePart } from "../../../lib/message-utils";

interface ToolProgressProps {
  /** All tool parts in the current message */
  tools: Array<MessagePart & { type: "toolCall" }>;
  /** Index of currently running tool (-1 if none) */
  currentIndex: number;
  /** Time when tool execution started (optional) */
  startTime?: number;
  /** Optional className for styling */
  className?: string;
}

/**
 * Get estimated time per tool (in ms).
 * Different tools have different typical durations.
 */
function getEstimatedTimeForTool(toolName: string): number {
  // Fast tools (< 1s)
  if (
    toolName === "get-cell-range" ||
    toolName === "get-sheet-structure" ||
    toolName === "get-workbook-structure"
  ) {
    return 500;
  }

  // Medium tools (1-3s)
  if (
    toolName === "set-cell-range" ||
    toolName === "copy-to" ||
    toolName === "resize-range"
  ) {
    return 2000;
  }

  // Slow tools (3-10s)
  if (
    toolName === "bash" ||
    toolName === "search-web" ||
    toolName === "read-file"
  ) {
    return 5000;
  }

  // Default estimation
  return 3000;
}

/**
 * Get display name for a tool.
 */
function getToolDisplayName(toolName: string): string {
  // Remove common prefixes
  const name = toolName.replace(/^excel-/, "").replace(/^web-/, "");

  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Calculate estimated time remaining.
 */
function calculateTimeRemaining(
  tools: Array<MessagePart & { type: "toolCall" }>,
  currentIndex: number,
  startTime?: number,
): number {
  if (currentIndex < 0 || currentIndex >= tools.length) return 0;

  // Sum estimated time for remaining tools
  let remaining = 0;
  for (let i = currentIndex; i < tools.length; i++) {
    remaining += getEstimatedTimeForTool(tools[i].name);
  }

  // If we have start time, adjust for elapsed time of current tool
  if (startTime && currentIndex >= 0) {
    const elapsed = Date.now() - startTime;
    const currentToolEstimate = getEstimatedTimeForTool(
      tools[currentIndex].name,
    );

    // If we've exceeded the estimate for current tool, don't subtract
    if (elapsed < currentToolEstimate) {
      remaining -= currentToolEstimate - elapsed;
    }
  }

  return Math.max(0, remaining);
}

/**
 * Tool progress indicator component.
 */
export function ToolProgress({
  tools,
  currentIndex,
  startTime,
  className = "",
}: ToolProgressProps) {
  if (tools.length === 0) return null;

  const isRunning = currentIndex >= 0 && currentIndex < tools.length;
  const currentTool = isRunning ? tools[currentIndex] : null;
  const timeRemaining = calculateTimeRemaining(tools, currentIndex, startTime);

  // Format time as "Xm Ys" or "Xs" or " Xm"
  const formatTime = (ms: number): string => {
    if (ms < 1000) return "< 1s";
    if (ms < 60000) return `${Math.ceil(ms / 1000)}s`;
    const mins = Math.floor(ms / 60000);
    const secs = Math.ceil((ms % 60000) / 1000);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 bg-(--chat-bg-secondary) rounded border border-(--chat-border) ${className}`}
      style={{ fontFamily: "var(--chat-font-mono)" }}
    >
      <Wrench size={14} className="text-(--chat-accent)" />

      {isRunning ? (
        <>
          <span className="text-sm text-(--chat-text-primary)">
            Running step {currentIndex + 1} of {tools.length}
          </span>
          {currentTool && (
            <span className="text-xs text-(--chat-text-muted) ml-2">
              {getToolDisplayName(currentTool.name)}
            </span>
          )}
          {timeRemaining > 0 && (
            <span className="flex items-center gap-1 text-xs text-(--chat-text-muted) ml-auto">
              <Clock size={10} />~{formatTime(timeRemaining)} left
            </span>
          )}
        </>
      ) : (
        <span className="text-sm text-(--chat-text-muted)">
          {tools.length} tool{tools.length !== 1 ? "s" : ""} queued
        </span>
      )}

      {/* Progress dots */}
      <div className="flex gap-1 ml-2">
        {tools.map((tool, i) => (
          <div
            key={tool.id}
            className={`w-2 h-2 rounded-full transition-colors ${
              i < currentIndex
                ? "bg-(--chat-success)"
                : i === currentIndex
                  ? "bg-(--chat-accent) animate-pulse"
                  : "bg-(--chat-border)"
            }`}
            title={`Step ${i + 1}: ${getToolDisplayName(tool.name)}`}
          />
        ))}
      </div>
    </div>
  );
}
