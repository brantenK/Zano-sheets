/**
 * Timeout warning component.
 *
 * Shows a warning when a request is taking longer than expected.
 * Appears at 4 minutes (1 minute before the 5-minute timeout).
 * Provides options to cancel or continue waiting.
 */

import { AlertTriangle, X } from "lucide-react";
import type { CSSProperties } from "react";

interface TimeoutWarningProps {
  /** Time remaining until timeout (in seconds) */
  timeRemaining: number;
  /** Callback when user clicks cancel */
  onCancel: () => void;
  /** Callback when user clicks continue waiting */
  onContinue?: () => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * Format time in a human-readable way.
 */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? "s" : ""}`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0
    ? `${mins}m ${secs}s`
    : `${mins} minute${mins !== 1 ? "s" : ""}`;
}

/**
 * Timeout warning component.
 *
 * Shows when approaching the 5-minute timeout limit.
 * Helps users understand what's happening and provides options.
 */
export function TimeoutWarning({
  timeRemaining,
  onCancel,
  onContinue,
  className = "",
}: TimeoutWarningProps) {
  return (
    <div
      className={`p-3 bg-(--chat-warning)/10 border border-(--chat-warning) rounded-lg ${className}`}
      style={{ fontFamily: "var(--chat-font-mono)" } as CSSProperties}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={16}
          className="text-(--chat-warning) shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-(--chat-warning)">
            Taking longer than usual
          </p>
          <p className="text-xs text-(--chat-text-secondary) mt-1">
            Complex requests can take several minutes. This will timeout in{" "}
            <span className="font-medium text-(--chat-warning)">
              {formatTime(timeRemaining)}
            </span>
            .
          </p>
          <p className="text-xs text-(--chat-text-muted) mt-1">
            For best results, try shorter prompts or break complex tasks into
            smaller steps.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs underline text-(--chat-warning) hover:text-(--chat-text-primary) transition-colors"
            >
              Cancel and try again
            </button>
            {onContinue && (
              <>
                <span className="text-(--chat-text-muted)">•</span>
                <button
                  type="button"
                  onClick={onContinue}
                  className="text-xs underline text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
                >
                  Keep waiting
                </button>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-0.5 text-(--chat-text-muted) hover:text-(--chat-warning) transition-colors"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
