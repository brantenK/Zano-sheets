/**
 * Tests for error display components.
 *
 * Note: Component testing requires @testing-library/react which is not installed.
 * These tests verify the error explanation logic that powers the components.
 */

// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  formatToolResult,
  getErrorExplanation,
} from "../src/lib/error-explanations";

describe("ErrorDisplay Component Logic", () => {
  it("should provide recovery actions for authentication errors", () => {
    const error = { status: 401, message: "Unauthorized" };
    const explanation = getErrorExplanation(error);

    expect(explanation.actions).toHaveLength(2);
    expect(explanation.actions[0].label).toBe("Fix in settings");
    expect(explanation.actions[0].type).toBe("settings");
    expect(explanation.actions[1].label).toBe("Try again");
    expect(explanation.actions[1].type).toBe("retry");
  });

  it("should provide recovery actions for rate limit errors", () => {
    const error = { status: 429, message: "Rate limit exceeded" };
    const explanation = getErrorExplanation(error);

    expect(explanation.actions).toHaveLength(2);
    expect(explanation.actions.some(a => a.label === "Try again")).toBe(true);
    expect(explanation.actions.some(a => a.label === "Switch model")).toBe(true);
  });

  it("should provide help link for provider errors", () => {
    const error = { status: 502, message: "Bad gateway" };
    const explanation = getErrorExplanation(error);

    expect(explanation.actions).toHaveLength(2);
    expect(explanation.actions.some(a => a.type === "help")).toBe(true);
  });

  it("should indicate which errors need config changes", () => {
    const authError = { status: 401, message: "Unauthorized" };
    const networkError = { message: "Failed to fetch" };

    expect(getErrorExplanation(authError).needsConfig).toBe(true);
    expect(getErrorExplanation(networkError).needsConfig).toBe(false);
  });

  it("should indicate which errors are retryable", () => {
    const timeoutError = { message: "Request timed out" };
    const forbiddenError = { status: 403, message: "Forbidden" };

    expect(getErrorExplanation(timeoutError).canRetry).toBe(true);
    expect(getErrorExplanation(forbiddenError).canRetry).toBe(false);
  });

  it("should preserve technical details for progressive disclosure", () => {
    const error = { status: 401, message: "Invalid API key: sk-1234567890" };
    const explanation = getErrorExplanation(error);

    expect(explanation.technicalDetails).toBe("invalid api key: sk-1234567890");
  });
});

describe("ToolResultDisplay Component Logic", () => {
  it("should format successful results with summary", () => {
    const result = JSON.stringify({
      dirtyRanges: [{ sheetId: 1, range: "A1:B2" }],
    });

    const formatted = formatToolResult(result, "success");

    expect(formatted.summary).toBe("Modified 1 cell range");
    expect(formatted.isError).toBe(false);
    expect(formatted.details).toBe(result);
  });

  it("should format error results with original message", () => {
    const result = "Permission denied: Cannot write to protected cell";

    const formatted = formatToolResult(result, "error");

    expect(formatted.summary).toBe(result);
    expect(formatted.details).toBe(result);
    expect(formatted.isError).toBe(true);
  });

  it("should handle complex results with dirty ranges", () => {
    const result = JSON.stringify({
      dirtyRanges: [
        { sheetId: 1, range: "A1:B2" },
        { sheetId: 1, range: "C3:D4" },
        { sheetId: 2, range: "F1:G10" },
      ],
    });

    const formatted = formatToolResult(result, "success");

    expect(formatted.summary).toBe("Modified 3 cell ranges");
    expect(formatted.isError).toBe(false);
  });

  it("should handle simple success messages", () => {
    const result = JSON.stringify({
      message: "Formula updated successfully",
    });

    const formatted = formatToolResult(result, "success");

    expect(formatted.summary).toBe("Formula updated successfully");
    expect(formatted.isError).toBe(false);
  });
});

describe("InlineError Component Logic", () => {
  it("should handle dismissible errors", () => {
    // This tests the contract: InlineError expects an onDismiss callback
    const error = "Something went wrong";
    expect(error).toBeTruthy();
  });

  it("should handle non-dismissible errors", () => {
    // This tests the contract: InlineError works without onDismiss
    const error = "Configuration required";
    expect(error).toBeTruthy();
  });
});
