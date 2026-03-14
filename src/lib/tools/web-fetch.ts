import { Type } from "@sinclair/typebox";
import { loadSavedConfig } from "../provider-config";
import { loadWebConfig } from "../web/config";
import { fetchWeb } from "../web/fetch";
import { defineTool, toolError, toolText } from "./types";

const DEFAULT_MAX_CHARS = 12000;
const FETCH_TIMEOUT_MS = 15000;

async function getProxyUrl(): Promise<string | undefined> {
  const config = await loadSavedConfig();
  return config?.useProxy && config?.proxyUrl ? config.proxyUrl : undefined;
}

function requireProxyOrThrow(proxyUrl: string | undefined) {
  if (!proxyUrl) {
    throw new Error(
      "Web fetch requires a CORS proxy in Excel. Configure one in Settings (CORS Proxy) or disable web tools.",
    );
  }
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
  execute: async (_toolCallId, params, signal) => {
    let controller: AbortController | null = null;
    let onAbort: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let fetchPromise: ReturnType<typeof fetchWeb> | null = null;
    try {
      const webConfig = loadWebConfig();
      const proxyUrl = await getProxyUrl();
      requireProxyOrThrow(proxyUrl);
      controller = new AbortController();
      onAbort = () => controller?.abort();
      signal?.addEventListener("abort", onAbort);

      fetchPromise = fetchWeb(
        params.url,
        {
          proxyUrl,
          apiKeys: webConfig.apiKeys,
          signal: controller.signal,
        },
        webConfig.fetchProvider,
      );
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller?.abort();
          reject(
            new Error(
              `Web fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s. The server may be slow or unresponsive.`,
            ),
          );
        }, FETCH_TIMEOUT_MS);
      });

      const result = await Promise.race([fetchPromise, timeoutPromise]);

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
        ...Object.entries(result.metadata || {}).map(
          ([key, value]) => `${key}: ${value}`,
        ),
      ]
        .filter(Boolean)
        .join("\n");

      return toolText(header ? `${header}\n\n${text}` : text);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return toolError("Web fetch aborted.");
      }
      const message = error instanceof Error ? error.message : String(error);
      return toolError(message);
    } finally {
      if (fetchPromise) {
        fetchPromise.catch(() => {});
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      if (onAbort) {
        signal?.removeEventListener("abort", onAbort);
      }
    }
  },
});
