import { Type } from "@sinclair/typebox";
import { executeDeepResearch } from "../research/deep-agent";
import { defineTool, type ToolResult, toolText } from "./types";

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
  execute: async (_toolCallId, params): Promise<ToolResult> => {
    try {
      const result = await executeDeepResearch(params.query, (msg) => {
        console.log(`[Deep Research Agent] ${msg}`);
      });
      return toolText(result);
    } catch (e) {
      return toolText(
        `Deep Research failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  },
});
