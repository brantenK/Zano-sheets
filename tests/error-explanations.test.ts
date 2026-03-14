/**
 * Tests for error explanations module.
 */

import { describe, expect, it } from "vitest";
import {
  formatToolResult,
  getErrorExplanation,
} from "../src/lib/error-explanations";

describe("getErrorExplanation", () => {
  it("should handle 401 authentication errors", () => {
    const error = { status: 401, message: "Unauthorized" };
    const explanation = getErrorExplanation(error);

    expect(explanation.title).toBe("Authentication failed");
    expect(explanation.canRetry).toBe(true);
    expect(explanation.needsConfig).toBe(true);
    expect(explanation.actions).toHaveLength(2);
    expect(explanation.actions[0].type).toBe("settings");
    expect(explanation.actions[1].type).toBe("retry");
  });

  it("should handle 403 authorization errors", () => {
    const error = { status: 403, message: "Forbidden" };
    const explanation = getErrorExplanation(error);

    expect(explanation.title).toBe("Access denied");
    expect(explanation.canRetry).toBe(false);
    expect(explanation.needsConfig).toBe(true);
  });

  it("should handle 429 rate limit errors", () => {
    const error = { status: 429, message: "Rate limit exceeded" };
    const explanation = getErrorExplanation(error);

    expect(explanation.title).toBe("Too many requests");
    expect(explanation.canRetry).toBe(true);
    expect(explanation.needsConfig).toBe(false);
  });

  it("should handle 5xx server errors", () => {
    const error = { status: 502, message: "Bad gateway" };
    const explanation = getErrorExplanation(error);

    expect(explanation.title).toBe("Provider temporarily unavailable");
    expect(explanation.canRetry).toBe(true);
    expect(explanation.needsConfig).toBe(false);
  });

  it("should handle timeout errors", () => {
    const error = { message: "Request timed out after 30 seconds" };
    const explanation = getErrorExplanation(error);

    expect(explanation.title).toBe("Request timed out");
    expect(explanation.canRetry).toBe(true);
  });

  it("should handle network errors", () => {
    const error = { message: "Failed to fetch" };
    const explanation = getErrorExplanation(error);

    expect(explanation.title).toBe("Connection problem");
    expect(explanation.canRetry).toBe(true);
  });

  it("should handle workbook context errors", () => {
    const error = {
      message: "Could not read workbook context; continuing without workbook metadata.",
    };
    const explanation = getErrorExplanation(error);

    expect(explanation.title).toBe("Excel connection issue");
    expect(explanation.canRetry).toBe(true);
  });

  it("should handle 5-minute streaming timeout", () => {
    const error = { message: "Request timed out after 5 minutes" };
    const explanation = getErrorExplanation(error);

    expect(explanation.title).toBe("Request too long");
    expect(explanation.canRetry).toBe(true);
  });

  it("should handle unknown errors", () => {
    const error = { message: "Something weird happened" };
    const explanation = getErrorExplanation(error);

    expect(explanation.title).toBe("Something went wrong");
    expect(explanation.canRetry).toBe(true);
    expect(explanation.actions).toHaveLength(2);
  });

  it("should preserve technical details", () => {
    const error = { status: 401, message: "Invalid API key: abc123" };
    const explanation = getErrorExplanation(error);

    expect(explanation.technicalDetails).toBe("invalid api key: abc123");
  });
});

describe("formatToolResult", () => {
  it("should format successful tool results", () => {
    const result = JSON.stringify({
      success: true,
      message: "Cells updated successfully",
    });
    const formatted = formatToolResult(result, "success");

    expect(formatted.summary).toBe("Cells updated successfully");
    expect(formatted.isError).toBe(false);
    expect(formatted.details).toBe(result);
  });

  it("should format dirty ranges in results", () => {
    const result = JSON.stringify({
      dirtyRanges: [
        { sheetId: 1, range: "A1:B2" },
        { sheetId: 1, range: "C3:D4" },
      ],
    });
    const formatted = formatToolResult(result, "success");

    expect(formatted.summary).toBe("Modified 2 cell ranges");
    expect(formatted.isError).toBe(false);
  });

  it("should format error results", () => {
    const result = "Failed to execute tool: permission denied";
    const formatted = formatToolResult(result, "error");

    expect(formatted.isError).toBe(true);
    expect(formatted.summary).toBeTruthy();
    expect(formatted.details).toBe(result);
  });

  it("should handle non-JSON results", () => {
    const result = "Operation completed";
    const formatted = formatToolResult(result, "success");

    expect(formatted.summary).toBe("Result received");
    expect(formatted.isError).toBe(false);
    expect(formatted.details).toBe(result);
  });

  it("should handle empty dirty ranges", () => {
    const result = JSON.stringify({
      dirtyRanges: [],
    });
    const formatted = formatToolResult(result, "success");

    expect(formatted.summary).toBe("Modified 0 cell ranges");
    expect(formatted.isError).toBe(false);
  });
});
