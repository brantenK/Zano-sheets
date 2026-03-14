/**
 * Enhanced error display component with user-friendly explanations and recovery actions.
 *
 * Features:
 * - User-friendly error messages
 * - Progressive disclosure of technical details
 * - Action buttons for recovery
 * - Tool call result formatting
 */

import { AlertCircle, ChevronDown, ChevronRight, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useCallback, useState } from "react";
import type { ErrorAction } from "../../lib/error-explanations";
import {
  formatToolResult,
  getErrorExplanation,
} from "../../lib/error-explanations";

export interface ErrorDisplayProps {
  /** The error to display */
  error: unknown;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Callback for opening settings */
  onOpenSettings?: () => void;
  /** Callback for custom action */
  onCustomAction?: (action: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export function ErrorDisplay({
  error,
  onRetry,
  onOpenSettings,
  onCustomAction,
  className = "",
}: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);
  const errorInfo = getErrorExplanation(error);

  const handleAction = useCallback(
    (action: ErrorAction) => {
      switch (action.type) {
        case "retry":
          onRetry?.();
          break;
        case "settings":
          onOpenSettings?.();
          break;
        case "custom":
          onCustomAction?.(action.label);
          break;
        case "help":
          // Open help documentation
          window.open(
            "https://github.com/brantenK/Zano-sheets#troubleshooting",
            "_blank",
          );
          break;
      }
    },
    [onRetry, onOpenSettings, onCustomAction],
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setShowDetails((prev) => !prev);
    }
  }, []);

  return (
    <div
      className={`p-3 border border-(--chat-error) rounded-lg bg-(--chat-error)/5 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          className="text-(--chat-error) shrink-0 mt-0.5"
          size={16}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-(--chat-error)">
            {errorInfo.title}
          </p>
          <p className="text-xs text-(--chat-text-secondary) mt-1">
            {errorInfo.explanation}
          </p>

          {/* Action buttons */}
          {errorInfo.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {errorInfo.actions.map((action: ErrorAction) => (
                <button
                  key={`${action.type}-${action.label}`}
                  type="button"
                  onClick={() => handleAction(action)}
                  className="text-xs underline text-(--chat-text-primary) hover:text-(--chat-accent) transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Technical details toggle */}
          {errorInfo.technicalDetails && (
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              onKeyDown={handleKeyDown}
              className="flex items-center gap-1 mt-2 text-xs text-(--chat-text-muted) hover:text-(--chat-text-secondary) transition-colors"
              aria-expanded={showDetails}
            >
              {showDetails ? (
                <ChevronDown size={12} aria-hidden="true" />
              ) : (
                <ChevronRight size={12} aria-hidden="true" />
              )}
              <span>Technical details</span>
            </button>
          )}

          {/* Technical details (progressive disclosure) */}
          {showDetails && errorInfo.technicalDetails && (
            <div className="mt-2 p-2 bg-(--chat-bg) border border-(--chat-border) rounded text-xs text-(--chat-error) font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              {errorInfo.technicalDetails}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ToolResultDisplayProps {
  /** Tool call result string */
  result: string;
  /** Tool call status */
  status: "error" | "success" | "running" | "pending";
  /** Tool name */
  toolName?: string;
  /** Additional CSS classes */
  className?: string;
}

export function ToolResultDisplay({
  result,
  status,
  toolName,
  className = "",
}: ToolResultDisplayProps) {
  const [showDetails, setShowDetails] = useState(false);
  const { summary, details, isError } = formatToolResult(
    result,
    status === "error" ? "error" : "success",
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setShowDetails((prev) => !prev);
    }
  }, []);

  // For running/pending status, don't show formatted result
  if (status === "running" || status === "pending") {
    return null;
  }

  return (
    <div
      className={`p-2 rounded border ${
        isError
          ? "border-(--chat-error) bg-(--chat-error)/5"
          : "border-(--chat-border) bg-(--chat-bg)"
      } ${className}`}
    >
      {/* Summary */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-medium ${
              isError ? "text-(--chat-error)" : "text-(--chat-text-primary)"
            }`}
          >
            {summary}
          </p>
          {!isError && (
            <p className="text-[10px] text-(--chat-text-muted) mt-0.5">
              {toolName || "Tool"} completed successfully
            </p>
          )}
        </div>

        {/* Show details button */}
        <button
          type="button"
          onClick={() => setShowDetails((prev) => !prev)}
          onKeyDown={handleKeyDown}
          className="flex items-center gap-1 text-[10px] text-(--chat-text-muted) hover:text-(--chat-text-secondary) transition-colors shrink-0"
          aria-expanded={showDetails}
          title={showDetails ? "Hide details" : "View details"}
        >
          {showDetails ? (
            <ChevronDown size={10} aria-hidden="true" />
          ) : (
            <ChevronRight size={10} aria-hidden="true" />
          )}
          <span>{showDetails ? "Hide" : "View"}</span>
        </button>
      </div>

      {/* Details (progressive disclosure) */}
      {showDetails && (
        <div className="mt-2 pt-2 border-t border-(--chat-border)">
          <div className="text-[10px] uppercase tracking-wider text-(--chat-text-muted) mb-1">
            {isError ? "Error details" : "Result"}
          </div>
          <pre
            className={`text-xs font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto ${
              isError ? "text-(--chat-error)" : "text-(--chat-text-secondary)"
            }`}
          >
            {details}
          </pre>
        </div>
      )}
    </div>
  );
}

export interface InlineErrorProps {
  /** The error message to display */
  message: string;
  /** Callback to dismiss the error */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Compact inline error display for chat input area.
 */
export function InlineError({
  message,
  onDismiss,
  className = "",
}: InlineErrorProps) {
  return (
    <div
      className={`flex items-start gap-2 px-2 py-1.5 bg-(--chat-error)/10 border border-(--chat-error)/20 rounded text-xs ${className}`}
      role="alert"
      aria-live="polite"
    >
      <AlertCircle
        className="text-(--chat-error) shrink-0 mt-0.5"
        size={12}
        aria-hidden="true"
      />
      <p className="flex-1 text-(--chat-error)">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-(--chat-error) hover:text-(--chat-bg) hover:bg-(--chat-error) transition-colors rounded"
          aria-label="Dismiss error"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
