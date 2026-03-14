import { Type } from "@sinclair/typebox";
import { loadSavedConfig } from "../provider-config";
import { loadWebConfig } from "../web/config";
import { searchWeb } from "../web/search";
import { defineTool, toolError, toolText } from "./types";

const SEARCH_TIMEOUT_MS = 15000;
const MAX_RESULT_CHARS = 30000;

function buildSearchProviderOrder(
  preferredProvider: string | undefined,
  apiKeys: Record<string, string | undefined>,
): string[] {
  const providers = [preferredProvider || "ddgs"];
  if (apiKeys.brave) providers.push("brave");
  if (apiKeys.serper) providers.push("serper");
  if (apiKeys.exa) providers.push("exa");
  providers.push("ddgs");

  return [...new Set(providers.filter(Boolean))];
}

async function getProxyUrl(): Promise<string | undefined> {
  const config = await loadSavedConfig();
  return config?.useProxy && config?.proxyUrl ? config.proxyUrl : undefined;
}

function requireProxyOrThrow(proxyUrl: string | undefined) {
  if (!proxyUrl) {
    throw new Error(
      "Web search requires a CORS proxy in Excel. Configure one in Settings (CORS Proxy) or disable web tools.",
    );
  }
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
  execute: async (_toolCallId, params, signal) => {
    try {
      const webConfig = loadWebConfig();
      const proxyUrl = await getProxyUrl();
      requireProxyOrThrow(proxyUrl);
      const providerOrder = buildSearchProviderOrder(
        webConfig.searchProvider,
        webConfig.apiKeys,
      );
      const options = {
        maxResults: params.max,
        region: params.region,
        timelimit: params.time,
        page: params.page,
      };
      const context = {
        proxyUrl,
        apiKeys: webConfig.apiKeys,
      };

      let lastError: Error | null = null;
      let results: Awaited<ReturnType<typeof searchWeb>> | null = null;
      let resolvedProvider = providerOrder[0] ?? webConfig.searchProvider;

      for (const providerId of providerOrder) {
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        signal?.addEventListener("abort", onAbort);
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const searchPromise = searchWeb(
          params.query,
          options,
          { ...context, signal: controller.signal },
          providerId,
        );
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            controller.abort();
            reject(
              new Error(
                `Web search timed out after ${SEARCH_TIMEOUT_MS / 1000}s. The search provider may be slow or unresponsive.`,
              ),
            );
          }, SEARCH_TIMEOUT_MS);
        });

        try {
          const providerResults = await Promise.race([
            searchPromise,
            timeoutPromise,
          ]);
          if (
            providerResults.length > 0 ||
            providerId === providerOrder.at(-1)
          ) {
            results = providerResults;
            resolvedProvider = providerId;
            break;
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            if (signal?.aborted) {
              throw new Error("Web search aborted.");
            }
          }
          lastError = error instanceof Error ? error : new Error(String(error));
        } finally {
          searchPromise.catch(() => {});
          if (timeoutId !== null) {
            clearTimeout(timeoutId);
          }
          signal?.removeEventListener("abort", onAbort);
        }
      }

      if (!results) {
        throw lastError ?? new Error("Web search failed.");
      }

      if (results.length === 0) {
        return toolText("No results found.");
      }

      const providerNote =
        resolvedProvider !== webConfig.searchProvider
          ? `Used ${resolvedProvider} after ${webConfig.searchProvider} was unavailable.\n\n`
          : "";

      if (params.json) {
        const jsonText = JSON.stringify(results, null, 2);
        return toolText(
          jsonText.length > MAX_RESULT_CHARS
            ? `${providerNote}${jsonText.slice(0, MAX_RESULT_CHARS)}\n\n[Results truncated at ${MAX_RESULT_CHARS} characters.]`
            : `${providerNote}${jsonText}`,
        );
      }

      const lines = results.map(
        (result, index) =>
          `${index + 1}. ${result.title}\n   ${result.href}\n   ${result.body}`,
      );
      let text = `${providerNote}${lines.join("\n\n")}`;
      if (text.length > MAX_RESULT_CHARS) {
        text = `${text.slice(0, MAX_RESULT_CHARS)}\n\n[Results truncated at ${MAX_RESULT_CHARS} characters.]`;
      }
      return toolText(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return toolError(message);
    }
  },
});
