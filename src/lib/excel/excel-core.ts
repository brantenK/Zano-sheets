/* global Excel */

import { columnIndexToLetter } from "./excel-utils";
import { getStableSheetId, preloadSheetIds } from "./sheet-id-map";

// Re-export from dependencies
export { getStableSheetId, preloadSheetIds };
export { columnIndexToLetter };

/**
 * Basic type for cell data (value + optional formula)
 */
export interface CellData {
  value: string | number | boolean | null;
  formula?: string;
}

/**
 * Low-level retry wrapper for Excel.run() operations.
 * Used internally by high-level functions.
 */
export async function runWithRetry<T>(
  batch: (context: Excel.RequestContext) => Promise<T>,
  retries = 3,
  delayMs = 300,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await Excel.run(batch);
    } catch (error) {
      attempt++;
      if (attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Helper to sync Excel context with automatic retry on 'Host is Busy' errors.
 * Individual syncs inside batches use this for resilience.
 */
export async function resilientSync(
  context: Excel.RequestContext,
): Promise<void> {
  const maxRetries = 5;
  const delayMs = 500;
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await context.sync();
      return;
    } catch (error: unknown) {
      lastError = error;
      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : "";
      const isBusy =
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === "HostIsBusy") ||
        errorMessage.includes("host is busy");

      if (isBusy) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * High-level wrapper for Excel operations.
 * Individual syncs inside the batch use resilientSync() for retry-on-busy.
 */
export async function runBatch<T>(
  batch: (context: Excel.RequestContext) => Promise<T>,
): Promise<T> {
  return Excel.run(batch);
}
