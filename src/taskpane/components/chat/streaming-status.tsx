/**
 * Streaming status component.
 *
 * Provides clear feedback about AI streaming state with time expectations.
 * Different states: connecting, thinking, streaming, finishing.
 *
 * Helps users understand what's happening and what to expect.
 */

import { Clock, Loader2 } from "lucide-react";
import type { CSSProperties } from "react";

export type StreamingState =
  | "connecting"
  | "thinking"
  | "streaming"
  | "finishing";

interface StreamingStatusProps {
  /** Current streaming state */
  state: StreamingState;
  /** Time when streaming started (ms) */
  startTime: number;
  /** Number of tools being executed (if applicable) */
  toolCount?: number;
  /** Optional className for styling */
  className?: string;
}

/**
 * Animated dots component for visual feedback.
 */
function AnimatedDots() {
  return (
    <span className="inline-flex items-center gap-0.5 ml-1">
      <span className="w-1 h-1 bg-current rounded-full animate-[bounce_1s_infinite_0ms]" />
      <span className="w-1 h-1 bg-current rounded-full animate-[bounce_1s_infinite_150ms]" />
      <span className="w-1 h-1 bg-current rounded-full animate-[bounce_1s_infinite_300ms]" />
    </span>
  );
}

/**
 * Streaming status component with state-aware messaging.
 */
export function StreamingStatus({
  state,
  startTime,
  toolCount = 0,
  className = "",
}: StreamingStatusProps) {
  const elapsed = Date.now() - startTime;

  let message: string;
  let subtext: string | null = null;
  let showClock = false;

  switch (state) {
    case "connecting":
      message = "Connecting to AI...";
      subtext = "This usually takes 1-2 seconds";
      break;

    case "thinking":
      if (elapsed < 2000) {
        message = "AI is thinking...";
        subtext = "Usually takes 2-5 seconds";
      } else if (elapsed < 10000) {
        message = "AI is thinking...";
        subtext = "Still working...";
      } else if (elapsed < 30000) {
        message = "This is taking longer than usual...";
        subtext = "Complex queries may take 10-30 seconds";
      } else {
        message = "Still processing...";
        subtext = "You can wait or cancel";
        showClock = true;
      }
      break;

    case "streaming":
      message = "Receiving response...";
      if (toolCount > 0) {
        subtext = `Processing ${toolCount} tool result${toolCount !== 1 ? "s" : ""}`;
      }
      break;

    case "finishing":
      message = "Almost done...";
      subtext = "Finalizing response";
      break;
  }

  return (
    <div
      className={`flex items-center gap-2 text-(--chat-text-muted) text-sm ${className}`}
      style={{ fontFamily: "var(--chat-font-mono)" } as CSSProperties}
    >
      <Loader2 size={14} className="animate-spin" />
      <span className="flex items-center">
        {message}
        <AnimatedDots />
      </span>
      {showClock && <Clock size={12} className="ml-1" />}
      {subtext && (
        <span className="text-xs text-(--chat-text-muted) ml-2">{subtext}</span>
      )}
    </div>
  );
}
