/**
 * Centralized error handling utilities.
 * Provides consistent error logging across the application.
 */

import { recordError } from "./integration-telemetry";

/**
 * Safely handle an error by logging it and optionally executing fallback behavior.
 * Use this instead of empty catch blocks.
 */
export function handleError(
  error: unknown,
  context: string,
  options: { logToConsole?: boolean; logToTelemetry?: boolean } = {},
): void {
  const { logToConsole = true, logToTelemetry = true } = options;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  if (logToConsole) {
    console.error(`[${context}] Error:`, errorMessage, errorStack);
  }

  // Log to telemetry if available
  if (logToTelemetry) {
    try {
      if (recordError) {
        recordError({
          context,
          message: errorMessage,
          stack: errorStack,
          timestamp: Date.now(),
        });
      }
    } catch {
      // Integration telemetry not available, silently skip
    }
  }
}

/**
 * Create a safe wrapper for operations that might fail.
 * Returns a tuple of [error, result] where error is null if successful.
 */
export async function tryCatch<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<[Error | null, T | null]> {
  try {
    const result = await operation();
    return [null, result];
  } catch (error) {
    handleError(error, context);
    return [error instanceof Error ? error : new Error(String(error)), null];
  }
}

/**
 * Synchronous version of tryCatch
 */
export function tryCatchSync<T>(
  operation: () => T,
  context: string,
): [Error | null, T | null] {
  try {
    const result = operation();
    return [null, result];
  } catch (error) {
    handleError(error, context);
    return [error instanceof Error ? error : new Error(String(error)), null];
  }
}
