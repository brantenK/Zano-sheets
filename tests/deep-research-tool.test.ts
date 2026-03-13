import { beforeEach, describe, expect, it, vi } from "vitest";

const { executeDeepResearchMock } = vi.hoisted(() => ({
  executeDeepResearchMock: vi.fn(),
}));

vi.mock("../src/lib/research/deep-agent", () => ({
  executeDeepResearch: executeDeepResearchMock,
}));

import { deepResearchTool } from "../src/lib/tools/deep-research";

describe("deepResearchTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams progress updates before returning the final answer", async () => {
    const updates: string[] = [];
    executeDeepResearchMock.mockImplementation(async (_query, onProgress) => {
      onProgress("Searching the web via Brave...");
      onProgress("Synthesizing research data into structured assumptions...");
      return "Final answer";
    });

    const result = await deepResearchTool.execute(
      "call-1",
      { query: "market outlook" },
      undefined,
      (partial) => {
        const text = partial.content[0];
        if (text?.type === "text") {
          updates.push(text.text);
        }
      },
    );

    expect(updates).toEqual([
      "Searching the web via Brave...",
      "Synthesizing research data into structured assumptions...",
    ]);
    expect(result.content[0]).toEqual({ type: "text", text: "Final answer" });
  });
});