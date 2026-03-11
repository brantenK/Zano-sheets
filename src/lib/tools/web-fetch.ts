import { Type } from "@sinclair/typebox";
import { loadSavedConfig } from "../provider-config";
import { loadWebConfig } from "../web/config";
import { fetchWeb } from "../web/fetch";
import { defineTool, toolError, toolText } from "./types";

const DEFAULT_MAX_CHARS = 12000;

function getProxyUrl(): string | undefined {
  const config = loadSavedConfig();
  return config?.useProxy && config?.proxyUrl ? config.proxyUrl : undefined;
}

export const webFetchTool = defineTool({
  name: "web-fetch",
  label: "Web Fetch",
  description:
    "Fetch a web page directly using the configured fetch provider and return readable content. Prefer this for normal page retrieval instead of shell subcommands unless you need piping or file output.",
  parameters: Type.Object({
    url: Type.String({
      description: "URL to fetch.",
    }),
    maxChars: Type.Optional(
      Type.Integer({
        minimum: 500,
        maximum: 50000,
        description: "Maximum text characters to return for text content.",
      }),
    ),
  }),
  execute: async (_toolCallId, params) => {
    try {
      const webConfig = loadWebConfig();
      const result = await fetchWeb(
        params.url,
        {
          proxyUrl: getProxyUrl(),
          apiKeys: webConfig.apiKeys,
        },
        webConfig.fetchProvider,
      );

      if (result.kind !== "text") {
        return toolText(
          `Fetched binary content (${result.contentType || "unknown type"}). Use the bash tool with the web-fetch command if you need to save the file into the sandbox.`,
        );
      }

      const maxChars = params.maxChars ?? DEFAULT_MAX_CHARS;
      const text =
        result.text.length > maxChars
          ? `${result.text.slice(0, maxChars)}\n\n[Content truncated at ${maxChars} characters.]`
          : result.text;

      const header = [
        result.title ? `Title: ${result.title}` : "",
        ...Object.entries(result.metadata || {}).map(([key, value]) => `${key}: ${value}`),
      ]
        .filter(Boolean)
        .join("\n");

      return toolText(header ? `${header}\n\n${text}` : text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toolError(message);
    }
  },
});