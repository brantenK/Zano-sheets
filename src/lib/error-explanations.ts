/**
 * User-friendly error explanations with suggested actions.
 *
 * Maps technical errors to helpful guidance for users.
 */

import { getErrorMessage, getErrorStatus } from "./error-utils";

export interface ErrorExplanation {
  /** User-friendly title for the error */
  title: string;
  /** Clear explanation of what went wrong */
  explanation: string;
  /** Suggested actions the user can take */
  actions: ErrorAction[];
  /** Whether this error can be retried */
  canRetry: boolean;
  /** Whether this error requires configuration changes */
  needsConfig: boolean;
  /** Technical details (optional, for progressive disclosure) */
  technicalDetails?: string;
}

export interface ErrorAction {
  /** Label for the action button */
  label: string;
  /** Type of action */
  type: "retry" | "settings" | "help" | "custom";
  /** Custom action handler (for type: "custom") */
  handler?: () => void;
}

/**
 * Get user-friendly error explanation with suggested actions.
 */
export function getErrorExplanation(error: unknown): ErrorExplanation {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toLowerCase();

  // Authentication errors
  if (status === 401) {
    return {
      title: "Authentication failed",
      explanation:
        "Your API key or OAuth token is invalid or has expired. The AI provider cannot verify your identity.",
      actions: [
        {
          label: "Fix in settings",
          type: "settings",
        },
        {
          label: "Try again",
          type: "retry",
        },
      ],
      canRetry: true,
      needsConfig: true,
      technicalDetails: message,
    };
  }

  // Authorization/permission errors
  if (status === 403) {
    return {
      title: "Access denied",
      explanation:
        "You don't have permission to use this AI model or your account has billing issues. Check your provider dashboard for details.",
      actions: [
        {
          label: "Check provider dashboard",
          type: "help",
        },
        {
          label: "Try different model",
          type: "settings",
        },
      ],
      canRetry: false,
      needsConfig: true,
      technicalDetails: message,
    };
  }

  // Rate limit errors
  if (status === 429) {
    return {
      title: "Too many requests",
      explanation:
        "You've hit the rate limit for this AI provider. Please wait 30-60 seconds before trying again, or switch to a different model.",
      actions: [
        {
          label: "Try again",
          type: "retry",
        },
        {
          label: "Switch model",
          type: "settings",
        },
      ],
      canRetry: true,
      needsConfig: false,
      technicalDetails: message,
    };
  }

  // 5-minute streaming timeout
  if (message.includes("5 minutes") || message.includes("streaming timeout")) {
    return {
      title: "Request too long",
      explanation:
        "Your request is taking too long to process. Try breaking it into smaller steps or using shorter prompts.",
      actions: [
        {
          label: "Try again",
          type: "retry",
        },
        {
          label: "Break into smaller steps",
          type: "custom",
        },
      ],
      canRetry: true,
      needsConfig: false,
      technicalDetails: message,
    };
  }

  // Network/timeout errors
  if (
    status === 408 ||
    status === 504 ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return {
      title: "Request timed out",
      explanation:
        "The request took too long to complete. This can happen with complex requests or slow networks. Try simplifying your request.",
      actions: [
        {
          label: "Try again",
          type: "retry",
        },
        {
          label: "Simplify request",
          type: "custom",
        },
      ],
      canRetry: true,
      needsConfig: false,
      technicalDetails: message,
    };
  }

  // Network errors
  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("econnrefused")
  ) {
    return {
      title: "Connection problem",
      explanation:
        "Could not reach the AI provider. Check your internet connection and proxy settings.",
      actions: [
        {
          label: "Try again",
          type: "retry",
        },
        {
          label: "Check proxy settings",
          type: "settings",
        },
      ],
      canRetry: true,
      needsConfig: false,
      technicalDetails: message,
    };
  }

  // CORS/proxy errors
  if (message.includes("cors") || message.includes("proxy")) {
    return {
      title: "Request blocked",
      explanation:
        "The request was blocked by CORS or proxy configuration. Check your proxy settings in the configuration panel.",
      actions: [
        {
          label: "Fix in settings",
          type: "settings",
        },
        {
          label: "Try again",
          type: "retry",
        },
      ],
      canRetry: true,
      needsConfig: true,
      technicalDetails: message,
    };
  }

  // Provider errors (5xx)
  if (status && status >= 500) {
    return {
      title: "Provider temporarily unavailable",
      explanation: `The AI provider is experiencing issues (error ${status}). This is usually resolved quickly. Please try again in a moment.`,
      actions: [
        {
          label: "Try again",
          type: "retry",
        },
        {
          label: "Check provider status",
          type: "help",
        },
      ],
      canRetry: true,
      needsConfig: false,
      technicalDetails: message,
    };
  }

  // Workbook context errors
  if (
    message.includes("workbook context") ||
    message.includes("workbook metadata")
  ) {
    return {
      title: "Excel connection issue",
      explanation:
        "Could not read your Excel workbook data. The AI will continue, but may not have full context about your sheets.",
      actions: [
        {
          label: "Continue without context",
          type: "retry",
        },
        {
          label: "Restart add-in",
          type: "custom",
        },
      ],
      canRetry: true,
      needsConfig: false,
      technicalDetails: message,
    };
  }

  // Tool execution errors
  if (message.includes("tool") || message.includes("execution")) {
    return {
      title: "Task execution failed",
      explanation:
        "The AI tried to perform an action in Excel but encountered an error. This might be due to protected cells, invalid ranges, or Excel limitations.",
      actions: [
        {
          label: "Try again",
          type: "retry",
        },
        {
          label: "Check cell protection",
          type: "custom",
        },
      ],
      canRetry: true,
      needsConfig: false,
      technicalDetails: message,
    };
  }

  // File upload errors
  if (message.includes("upload") || message.includes("file")) {
    return {
      title: "File upload failed",
      explanation:
        "Could not process the uploaded file. Check that the file is a supported type (PDF, images, text, etc.) and is not corrupted.",
      actions: [
        {
          label: "Try again",
          type: "retry",
        },
        {
          label: "Remove file",
          type: "custom",
        },
      ],
      canRetry: true,
      needsConfig: false,
      technicalDetails: message,
    };
  }

  // Generic unknown error
  return {
    title: "Something went wrong",
    explanation:
      "An unexpected error occurred. Please try again. If the problem persists, contact support.",
    actions: [
      {
        label: "Try again",
        type: "retry",
      },
      {
        label: "Get help",
        type: "help",
      },
    ],
    canRetry: true,
    needsConfig: false,
    technicalDetails: message,
  };
}

/**
 * Format tool call result for user-friendly display.
 */
export function formatToolResult(
  result: string,
  status: "error" | "success",
): {
  summary: string;
  details: string;
  isError: boolean;
} {
  if (status === "error") {
    // Return the error result as-is for display
    return {
      summary: result,
      details: result,
      isError: true,
    };
  }

  // For successful results, provide a summary
  try {
    const parsed = JSON.parse(result);

    // Check for dirty ranges (modified cells)
    if (parsed.dirtyRanges && Array.isArray(parsed.dirtyRanges)) {
      const count = parsed.dirtyRanges.length;
      return {
        summary: `Modified ${count} cell ${count === 1 ? "range" : "ranges"}`,
        details: result,
        isError: false,
      };
    }

    // Check for success messages
    if (parsed.success || parsed.message) {
      return {
        summary: parsed.message || "Completed successfully",
        details: result,
        isError: false,
      };
    }

    // Generic success
    return {
      summary: "Task completed",
      details: result,
      isError: false,
    };
  } catch {
    // Not JSON, return as-is
    return {
      summary: "Result received",
      details: result,
      isError: false,
    };
  }
}
