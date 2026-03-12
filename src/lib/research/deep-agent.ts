import type { Api, AssistantMessage, Model } from "@mariozechner/pi-ai";
import { resolveAgentModel } from "../chat/model-resolution";
import { streamSimple } from "../chat/provider-stream";
import {
  loadOAuthCredentials,
  refreshOAuthToken,
  saveOAuthCredentials,
} from "../oauth";
import {
  applyProxyToModel,
  evaluateProviderConfig,
  loadSavedConfig,
  type ThinkingLevel,
} from "../provider-config";
import { loadWebConfig } from "../web/config";
import { fetchWeb } from "../web/fetch";
import { searchWeb } from "../web/search";
import type { SearchResult, WebContext } from "../web/types";

const MAX_RESULTS = 6;
const MAX_CHARS_PER_SOURCE = 10_000;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_PROVIDER_RETRIES = 3;

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function dedupeByDomain(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const output: SearchResult[] = [];
  for (const r of results) {
    const host = hostnameOf(r.href) ?? r.href;
    if (seen.has(host)) continue;
    seen.add(host);
    output.push(r);
    if (output.length >= MAX_RESULTS) break;
  }
  return output;
}

function uniqueProviders(providerIds: string[]): string[] {
  return [...new Set(providerIds.filter(Boolean))];
}

function buildSearchProviderOrder(
  preferredProvider: string,
  context: WebContext,
): string[] {
  const configuredFallbacks: string[] = [];

  if (context.apiKeys?.brave) configuredFallbacks.push("brave");
  if (context.apiKeys?.serper) configuredFallbacks.push("serper");
  if (context.apiKeys?.exa) configuredFallbacks.push("exa");

  configuredFallbacks.push("ddgs");

  return uniqueProviders([preferredProvider || "ddgs", ...configuredFallbacks]);
}

function thinkingToReasoning(
  level: ThinkingLevel,
): "low" | "medium" | "high" | undefined {
  if (level === "none") return undefined;
  return level;
}

function getErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  if (
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  return undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function isRetryableProviderError(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (status && [408, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = getErrorMessage(err).toLowerCase();
  return (
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("temporarily unavailable")
  );
}

function formatProviderError(err: unknown): string {
  const status = getErrorStatus(err);
  if (status === 401) {
    return "Authentication failed (401). Check your API key or reconnect OAuth.";
  }
  if (status === 403) {
    return "Access denied (403). Verify provider permissions, model access, and billing.";
  }
  if (status === 429) {
    return "Rate limited (429). Please retry in a moment.";
  }
  if (status && status >= 500) {
    return `Provider temporarily unavailable (${status}). Please retry shortly.`;
  }

  const message = getErrorMessage(err);
  const lower = message.toLowerCase();
  if (lower.includes("cors") || lower.includes("proxy")) {
    return "Request blocked by CORS/proxy configuration. Check proxy settings in Settings.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Network request failed. Check internet connectivity and proxy settings, then retry.";
  }

  return message || "An error occurred while contacting the model provider.";
}

async function getActiveApiKey(
  config: NonNullable<ReturnType<typeof loadSavedConfig>>,
  options?: { forceRefresh?: boolean },
): Promise<string> {
  const forceRefresh = options?.forceRefresh ?? false;
  if (config.authMethod !== "oauth") {
    return config.apiKey;
  }

  const creds = loadOAuthCredentials(config.provider);
  if (!creds) {
    throw new Error(
      "OAuth credentials are missing. Reconnect the provider in Settings.",
    );
  }

  if (!forceRefresh && Date.now() < creds.expires) {
    return creds.access;
  }

  const refreshed = await refreshOAuthToken(
    config.provider,
    creds.refresh,
    config.proxyUrl,
    config.useProxy,
  );
  saveOAuthCredentials(config.provider, refreshed);
  return refreshed.access;
}

async function synthesizeResearch(
  prompt: string,
  config: NonNullable<ReturnType<typeof loadSavedConfig>>,
): Promise<string> {
  const resolvedModel = resolveAgentModel(config);
  if (!resolvedModel.baseModel) {
    throw new Error(
      resolvedModel.error || "Unable to resolve the configured model.",
    );
  }

  const model = applyProxyToModel(
    resolvedModel.baseModel,
    config,
  ) as Model<Api>;
  let apiKey = await getActiveApiKey(config);
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_PROVIDER_RETRIES; attempt++) {
    try {
      const stream = await streamSimple(
        model,
        {
          messages: [
            {
              role: "user",
              content: prompt,
              timestamp: Date.now(),
            },
          ],
        },
        {
          apiKey,
          reasoning: thinkingToReasoning(config.thinking),
        },
      );
      const message = (await stream.result()) as AssistantMessage;
      const text = message.content
        .filter(
          (
            part,
          ): part is Extract<
            AssistantMessage["content"][number],
            { type: "text" }
          > => part.type === "text",
        )
        .map((part) => part.text)
        .join("\n")
        .trim();

      if (!text) {
        throw new Error("The model returned an empty synthesis response.");
      }

      return text;
    } catch (err) {
      lastError = err;

      const isUnauthorized =
        getErrorStatus(err) === 401 ||
        getErrorMessage(err).toLowerCase().includes("unauthorized") ||
        getErrorMessage(err).toLowerCase().includes("invalid api key");

      if (
        isUnauthorized &&
        config.authMethod === "oauth" &&
        attempt < MAX_PROVIDER_RETRIES
      ) {
        apiKey = await getActiveApiKey(config, { forceRefresh: true });
        continue;
      }

      if (isRetryableProviderError(err) && attempt < MAX_PROVIDER_RETRIES) {
        const baseDelayMs = 2 ** attempt * 1000;
        const jitterMs = Math.floor(Math.random() * 300);
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs + jitterMs),
        );
        continue;
      }

      throw new Error(formatProviderError(err));
    }
  }

  throw new Error(formatProviderError(lastError));
}

async function fetchWithTimeout(
  url: string,
  context: WebContext,
  providerId?: string,
) {
  return await Promise.race([
    fetchWeb(url, context as never, providerId),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Timed out fetching page")),
        FETCH_TIMEOUT_MS,
      ),
    ),
  ]);
}

export async function executeDeepResearch(
  query: string,
  onProgress: (msg: string) => void,
): Promise<string> {
  const config = loadSavedConfig();
  if (!config || !config.apiKey) {
    throw new Error(
      "No LLM API configuration found. Please setup OpenRouter, Gemini, or OpenAI in settings.",
    );
  }

  const configHealth = evaluateProviderConfig(config);
  if (configHealth.blocking.length > 0) {
    throw new Error(configHealth.blocking[0]);
  }

  onProgress(`Starting research for: "${query}"...`);

  const webConfig = loadWebConfig();
  const searchContext: WebContext = {
    proxyUrl: config.useProxy ? config.proxyUrl : undefined,
    apiKeys: webConfig.apiKeys,
  };

  const fetchProviderId = webConfig.fetchProvider;
  const searchProviders = buildSearchProviderOrder(
    webConfig.searchProvider,
    searchContext,
  );

  const runSearch = async (providerId: string): Promise<SearchResult[]> => {
    const label =
      providerId === "ddgs"
        ? "DuckDuckGo"
        : providerId.charAt(0).toUpperCase() + providerId.slice(1);
    onProgress(`Searching the web via ${label}...`);
    return searchWeb(
      query,
      { maxResults: MAX_RESULTS, page: 1 },
      searchContext,
      providerId,
    );
  };

  let results: SearchResult[] = [];
  let lastSearchError: unknown = null;
  for (const providerId of searchProviders) {
    try {
      results = await runSearch(providerId);
      if (results.length > 0) {
        break;
      }
      onProgress(
        `No results returned by ${providerId}. Trying next provider...`,
      );
    } catch (err) {
      lastSearchError = err;
      onProgress(
        `${providerId} search failed: ${
          err instanceof Error ? err.message : String(err)
        }. Trying next provider...`,
      );
    }
  }

  if (results.length === 0 && lastSearchError) {
    throw new Error(
      `Web search failed across configured providers: ${
        lastSearchError instanceof Error
          ? lastSearchError.message
          : String(lastSearchError)
      }`,
    );
  }

  const uniqueResults = dedupeByDomain(results).slice(0, MAX_RESULTS);

  if (uniqueResults.length === 0) {
    return "No reliable search results found. Please broaden your query.";
  }

  // 3. Fetch link contents
  let combinedContent = "";
  let readableSourceCount = 0;
  for (const res of uniqueResults) {
    onProgress(`Reading source: ${res.href}...`);
    try {
      const page = await fetchWithTimeout(
        res.href,
        searchContext,
        fetchProviderId,
      );
      if (page.kind !== "text") {
        onProgress(`Skipping (non-text content): ${res.href}`);
        continue;
      }
      const trimmedText =
        page.text.length > MAX_CHARS_PER_SOURCE
          ? `${page.text.slice(0, MAX_CHARS_PER_SOURCE)}...`
          : page.text;
      if (!trimmedText.trim()) {
        onProgress(`Skipping source (empty extracted text): ${res.href}`);
        continue;
      }
      const title = page.title || res.title || res.href;
      combinedContent += `\n\n--- Source: ${title} (${res.href}) ---\n${trimmedText}\n`;
      readableSourceCount += 1;
    } catch (e) {
      onProgress(
        `Skipping source (${res.href}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  if (readableSourceCount === 0) {
    throw new Error(
      "Deep research could not extract readable content from any search result. Try a different fetch provider, proxy, or broader query.",
    );
  }

  // 4. Synthesize via Configured LLM Provider
  onProgress(`Synthesizing research data into structured assumptions...`);

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
  const synthesisPrompt = `IMPORTANT: Today's date is ${today}.
When answering questions about dates or time, use ${today} as the current date.

You are a Deep Research Agent. Based on the following extracted web pages, synthesize a comprehensive answer to the user's query. Output a professional, highly structured summary (like a markdown table or cleanly bulleted Assumptions grid). Include citations linking to the URLs provided.\n\nQuery: ${query}\n\nWeb Data: ${combinedContent}`;
  const textResponse = await synthesizeResearch(synthesisPrompt, config);

  onProgress(`Research complete.`);
  return textResponse || "Research process yielded no answer.";
}
