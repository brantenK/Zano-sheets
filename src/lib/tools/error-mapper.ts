/**
 * Friendly error messages for common Excel operations
 * Maps technical errors to user-friendly explanations
 */

export interface ErrorContext {
  toolName: string;
  params?: Record<string, unknown>;
  originalError?: string;
}

/**
 * Get a user-friendly error message for common Excel errors
 */
export function getFriendlyError(
  error: Error | string | unknown,
  context: ErrorContext,
): string {
  const errorMessage =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : String(error);

  // Sheet not found errors
  if (
    errorMessage.includes("Worksheet with ID") &&
    errorMessage.includes("not found")
  ) {
    const sheetMatch = errorMessage.match(/ID (\d+)/);
    const sheetId = sheetMatch ? sheetMatch[1] : "that";
    return (
      `The sheet you're trying to access (ID: ${sheetId}) doesn't exist. ` +
      `Please check that the sheet is still in your workbook.`
    );
  }

  // Missing required parameters
  if (errorMessage.includes("is required")) {
    const paramMatch = errorMessage.match(/(\w+) is required/);
    const param = paramMatch
      ? paramMatch[1].toLowerCase()
      : "required information";
    return `Missing ${param}. Please provide the ${param} and try again.`;
  }

  // Chart/table creation errors
  if (
    errorMessage.includes("requires source") ||
    errorMessage.includes("requires range")
  ) {
    return (
      `To create a chart or pivot table, you need to select data first. ` +
      `Please specify the data range (e.g., "Sheet1!A1:D10").`
    );
  }

  // Update/delete requires ID
  if (
    errorMessage.includes("update requires id") ||
    errorMessage.includes("delete requires id")
  ) {
    return (
      `To update or delete this item, you need to provide its ID. ` +
      `Use the "get all objects" tool first to find the correct ID.`
    );
  }

  // Formula errors
  if (errorMessage.includes("formula")) {
    return (
      `There's an issue with the formula. ` +
      `Check for circular references, missing dependencies, or syntax errors.`
    );
  }

  // Range errors
  if (
    errorMessage.includes("range") ||
    errorMessage.includes("Invalid address")
  ) {
    return (
      `The cell or range you specified isn't valid. ` +
      `Please check the format (e.g., "A1" or "A1:B10").`
    );
  }

  // File/IO errors
  if (errorMessage.includes("file") || errorMessage.includes("upload")) {
    return (
      `There was a problem with the file. ` +
      `Make sure the file is supported and try uploading it again.`
    );
  }

  // API/Network errors
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch") ||
    errorMessage.includes("CORS")
  ) {
    return `Network connection issue. Please check your internet connection and try again.`;
  }

  // Rate limiting
  if (
    errorMessage.includes("429") ||
    errorMessage.includes("rate limit") ||
    errorMessage.includes("too many requests")
  ) {
    return `You've reached the API rate limit. Please wait a moment and try again.`;
  }

  // Authentication errors
  if (
    errorMessage.includes("401") ||
    errorMessage.includes("unauthorized") ||
    errorMessage.includes("authentication")
  ) {
    return `API key issue. Please check your API key in Settings and make sure it's valid.`;
  }

  // Quota/limit errors
  if (
    errorMessage.includes("quota") ||
    errorMessage.includes("limit exceeded")
  ) {
    return `API quota exceeded. Please check your usage or upgrade your API plan.`;
  }

  // Catch-all for unknown errors with context
  if (context.toolName) {
    return (
      `Something went wrong while trying to ${context.toolName.replace(/_/g, " ")}. ` +
      `Error: ${errorMessage}`
    );
  }

  // Last resort
  return `An error occurred: ${errorMessage}`;
}

/**
 * Wrap a tool error with friendly message
 */
export function wrapError(
  error: Error | string | unknown,
  context: ErrorContext,
): string {
  return getFriendlyError(error, context);
}
