import { Type } from "@sinclair/typebox";
import { loadSavedConfig } from "../provider-config";
import { loadWebConfig } from "../web/config";
import { searchWeb } from "../web/search";
import { defineTool, toolError, toolText } from "./types";

function getProxyUrl(): string | undefined {
  const config = loadSavedConfig();
  return config?.useProxy && config?.proxyUrl ? config.proxyUrl : undefined;
}

export const webSearchTool = defineTool({
  name: "web-search",
  label: "Web Search",
  description:
    "Search the web directly using the configured web search provider. Prefer this for normal web lookups instead of trying to invoke a shell subcommand.",
  parameters: Type.Object({
    query: Type.String({
      description: "Search query.",
    }),
    max: Type.Optional(
      Type.Integer({
        minimum: 1,
        maximum: 50,
        description: "Maximum number of results to return.",
      }),
    ),
    region: Type.Optional(
      Type.String({
        description: "Region code like us-en or de-de.",
      }),
    ),
    time: Type.Optional(
      Type.Union([
        Type.Literal("d"),
        Type.Literal("w"),
        Type.Literal("m"),
        Type.Literal("y"),
      ]),
    ),
    page: Type.Optional(
      Type.Integer({
        minimum: 1,
        description: "1-based page number.",
      }),
    ),
    json: Type.Optional(
      Type.Boolean({
        description: "Return the results as JSON instead of formatted text.",
      }),
    ),
  }),
  execute: async (_toolCallId, params) => {
    try {
      const webConfig = loadWebConfig();
      const results = await searchWeb(
        params.query,
        {
          maxResults: params.max,
          region: params.region,
          timelimit: params.time,
          page: params.page,
        },
        {
          proxyUrl: getProxyUrl(),
          apiKeys: webConfig.apiKeys,
        },
        webConfig.searchProvider,
      );

      if (results.length === 0) {
        return toolText("No results found.");
      }

      if (params.json) {
        return toolText(JSON.stringify(results, null, 2));
      }

      const lines = results.map(
        (result, index) =>
          `${index + 1}. ${result.title}\n   ${result.href}\n   ${result.body}`,
      );
      return toolText(lines.join("\n\n"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toolError(message);
    }
  },
});
