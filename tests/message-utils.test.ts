import { describe, expect, it } from "vitest";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import {
  agentMessagesToChatMessages,
  deriveStats,
  extractPartsFromAssistantMessage,
  generateId,
  stripEnrichment,
} from "../src/lib/message-utils";

describe("stripEnrichment", () => {
  it("returns a plain string unchanged", () => {
    expect(stripEnrichment("hello world")).toBe("hello world");
  });

  it("strips <attachments> block from the start", () => {
    const input =
      "<attachments>\nsome attachment content\n</attachments>\n\nActual message";
    expect(stripEnrichment(input)).toBe("Actual message");
  });

  it("strips <wb_context> block from the start", () => {
    const input =
      "<wb_context>\nworkbook context\n</wb_context>\n\nActual message";
    expect(stripEnrichment(input)).toBe("Actual message");
  });

  it("does not strip blocks that appear mid-string", () => {
    const input =
      "Some text\n<attachments>\ncontent\n</attachments>\n\nMore text";
    expect(stripEnrichment(input)).toBe(input);
  });

  it("joins text blocks from an array and strips XML", () => {
    const input = [
      { type: "text", text: "<attachments>\ndata\n</attachments>\n\nHello" },
      { type: "text", text: " world" },
    ];
    expect(stripEnrichment(input)).toBe("Hello\n world");
  });

  it("handles array with non-text blocks by ignoring them", () => {
    const input = [
      { type: "image" },
      { type: "text", text: "visible" },
    ];
    expect(stripEnrichment(input)).toBe("visible");
  });

  it("returns empty string for empty array", () => {
    expect(stripEnrichment([])).toBe("");
  });
});

describe("generateId", () => {
  it("returns a non-empty string", () => {
    expect(typeof generateId()).toBe("string");
    expect(generateId().length).toBeGreaterThan(0);
  });

  it("generates unique IDs on successive calls", () => {
    const ids = new Set(Array.from({ length: 20 }, generateId));
    expect(ids.size).toBe(20);
  });
});

describe("deriveStats", () => {
  it("returns all-zero stats for an empty array", () => {
    expect(deriveStats([])).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalCost: 0,
      lastInputTokens: 0,
    });
  });

  it("sums tokens and cost from assistant messages", () => {
    const messages: AgentMessage[] = [
      {
        role: "assistant",
        content: [],
        timestamp: 0,
        usage: {
          input: 100,
          output: 50,
          cacheRead: 10,
          cacheWrite: 5,
          cost: { input: 0.01, output: 0.05, cache: 0, total: 0.06 },
        },
      } as AssistantMessage,
      {
        role: "assistant",
        content: [],
        timestamp: 1,
        usage: {
          input: 200,
          output: 80,
          cacheRead: 20,
          cacheWrite: 0,
          cost: { input: 0.02, output: 0.08, cache: 0, total: 0.10 },
        },
      } as AssistantMessage,
    ];

    const stats = deriveStats(messages);
    expect(stats.inputTokens).toBe(300);
    expect(stats.outputTokens).toBe(130);
    expect(stats.cacheRead).toBe(30);
    expect(stats.cacheWrite).toBe(5);
    expect(stats.totalCost).toBeCloseTo(0.16);
    // lastInputTokens = last message's input + cacheRead + cacheWrite
    expect(stats.lastInputTokens).toBe(200 + 20 + 0);
  });

  it("ignores non-assistant messages", () => {
    const messages: AgentMessage[] = [
      { role: "user", content: [{ type: "text", text: "hi" }], timestamp: 0 },
    ];
    expect(deriveStats(messages)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalCost: 0,
      lastInputTokens: 0,
    });
  });
});

describe("extractPartsFromAssistantMessage", () => {
  it("returns existingParts unchanged for non-assistant messages", () => {
    const msg: AgentMessage = {
      role: "user",
      content: [{ type: "text", text: "hi" }],
      timestamp: 0,
    };
    const existing = [{ type: "text" as const, text: "kept" }];
    expect(extractPartsFromAssistantMessage(msg, existing)).toBe(existing);
  });
});

describe("agentMessagesToChatMessages", () => {
  it("returns an empty array for empty input", () => {
    expect(agentMessagesToChatMessages([])).toEqual([]);
  });
});
