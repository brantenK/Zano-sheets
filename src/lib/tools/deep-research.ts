import { Type } from "@sinclair/typebox";
import { executeDeepResearch } from "../research/deep-agent";
import {
  defineTool,
  type ToolResult,
  type ToolUpdateCallback,
  toolError,
  toolText,
} from "./types";

function emitProgress(
  onUpdate: ToolUpdateCallback | undefined,
  message: string,
) {
  onUpdate?.(toolText(message));
}

export const deepResearchTool = defineTool({
  name: "deep_research",
  label: "Deep Research Agent",
  description:
    "Deploy an autonomous multi-step sub-agent that searches the web, reads multiple live URLs, and synthesizes massive amounts of data into a structured assumption table or markdown report. Ideal for complex research prompts.",
  parameters: Type.Object({
    query: Type.String({
      description:
        "A comprehensive query detailing exactly what to research (e.g., 'Find the projected 5-year CAGR of humanoid robotics sector and the top 3 hardware players').",
    }),
  }),
  execute: async (
    _toolCallId,
    params,
    _signal,
    onUpdate,
  ): Promise<ToolResult> => {
    try {
      const result = await executeDeepResearch(params.query, (msg) => {
        emitProgress(onUpdate, msg);
      });
      return toolText(result);
    } catch (e) {
      return toolError(
        `Deep Research failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  },
});
