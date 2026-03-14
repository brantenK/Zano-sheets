import { buildProxyRequestUrl } from "./fetch";
import type {
  SearchOptions,
  SearchProvider,
  SearchResult,
  WebContext,
} from "./types";

function parseHTML(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

function textOf(el: Element | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function getApiKey(
  context: WebContext,
  providerId: string,
): string | undefined {
  return context.apiKeys?.[providerId];
}

function withSignal(
  init: RequestInit | undefined,
  context: WebContext,
): RequestInit | undefined {
  if (!context.signal) return init;
  return { ...init, signal: context.signal };
}

function normalizeRegion(region?: string): {
  country: string;
  language: string;
  uiLanguage: string;
} {
  const [countryRaw, languageRaw] = (region || "us-en").split("-");
  const country = countryRaw?.toUpperCase() || "US";
  const language = languageRaw?.toLowerCase() || "en";
  return {
    country,
    language,
    uiLanguage: `${language}-${country}`,
  };
}

function toBraveFreshness(
  timelimit?: SearchOptions["timelimit"],
): string | null {
  switch (timelimit) {
    case "d":
      return "pd";
    case "w":
      return "pw";
    case "m":
      return "pm";
    case "y":
      return "py";
    default:
      return null;
  }
}

async function readResponseErrorDetail(response: Response): Promise<string> {
  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await response.clone().json()) as unknown;
      if (typeof json === "object" && json !== null) {
        const data = json as Record<string, unknown>;
        const candidates = [
          "message",
          "error",
          "detail",
          "details",
          "status",
        ] as const;
        for (const key of candidates) {
          const value = data[key];
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
        }
      }
    }

    const text = (await response.clone().text()).trim();
    return text ? text.slice(0, 200) : "";
  } catch {
    return "";
  }
}

async function fetchWithProxy(
  url: string,
  context: WebContext,
  init?: RequestInit,
  options?: { skipProxy?: boolean },
): Promise<Response> {
  // If skipProxy is true, fetch directly (for API calls with CORS support)
  if (options?.skipProxy) {
    return await fetch(url, withSignal(init, context));
  }

  // Use user-configured proxy, or fallback to consistent proxies if none configured
  const proxies = context.proxyUrl
    ? [context.proxyUrl]
    : ["https://api.allorigins.win/raw", "https://corsproxy.io"];

  let lastError: Error | undefined;

  for (const proxy of proxies) {
    try {
      const proxyUrlFinal = buildProxyRequestUrl(proxy, url);
      const response = await fetch(proxyUrlFinal, withSignal(init, context));

      // Retry on 403, 429 (rate limit), or 5xx server errors (only for non-user-configured proxies)
      if (
        response.status === 403 ||
        response.status === 429 ||
        (response.status >= 500 && response.status < 600)
      ) {
        // Capture response body text for diagnostics before cancelling
        let errorDetail = "";
        try {
          const text = await response.clone().text();
          if (text) errorDetail = ` - ${text.substring(0, 200)}`;
        } catch {
          /* ignore - body may already be consumed */
        }

        // Consume body to prevent memory leaks before continuing to next proxy
        response.body?.cancel();

        // If user configured a specific proxy and it failed, don't try fallbacks
        if (context.proxyUrl) {
          throw new Error(
            `Configured CORS proxy returned ${response.status}.${errorDetail} Please check your proxy configuration.`,
          );
        }
        lastError = new Error(
          `Proxy returned ${response.status}. Trying next proxy...${errorDetail}`,
        );
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If user configured a specific proxy and it failed, don't try fallbacks
      if (context.proxyUrl) {
        throw new Error(
          `Configured CORS proxy search failed: ${lastError.message}`,
        );
      }
      // Otherwise try next proxy
    }
  }

  throw new Error(
    "Search blocked by CORS. Please configure a custom CORS proxy in Settings for better reliability.",
  );
}

const ddgsProvider: SearchProvider = {
  id: "ddgs",
  async search(query, options, context) {
    const { region = "us-en", timelimit, maxResults = 10, page = 1 } = options;

    const body = new URLSearchParams({ q: query, l: region, b: "" });
    if (page > 1) body.set("s", String(10 + (page - 2) * 15));
    if (timelimit) body.set("df", timelimit);

    const target = "https://html.duckduckgo.com/html/";

    const resp = await fetchWithProxy(target, context, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);

    const doc = parseHTML(await resp.text());
    if (doc.querySelector(".anomaly-modal, #challenge-form")) {
      throw new Error(
        "DuckDuckGo is rate-limiting requests (bot challenge). Try again later or use a different CORS proxy.",
      );
    }

    const results: SearchResult[] = [];
    for (const item of doc.querySelectorAll(".result")) {
      const titleEl = item.querySelector(".result__a");
      const bodyEl = item.querySelector(".result__snippet");
      let href = titleEl?.getAttribute("href") ?? "";
      if (!href) continue;
      if (href.includes("duckduckgo.com/y.js")) continue;
      if (href.startsWith("//")) href = `https:${href}`;
      const redirect = href.match(/uddg=([^&]+)/);
      if (redirect) href = decodeURIComponent(redirect[1]);

      results.push({
        title: textOf(titleEl),
        href,
        body: textOf(bodyEl),
      });

      if (results.length >= maxResults) break;
    }

    return results;
  },
};

const braveProvider: SearchProvider = {
  id: "brave",
  requiresApiKey: true,
  async search(query, options, context) {
    const apiKey = getApiKey(context, "brave");
    if (!apiKey) {
      throw new Error(
        "Brave search requires an API key. Configure it in zanosheets-web-config-v1.apiKeys.brave.",
      );
    }

    const maxResults = options.maxResults ?? 10;
    const offset = ((options.page ?? 1) - 1) * maxResults;
    const { country, language, uiLanguage } = normalizeRegion(options.region);
    const freshness = toBraveFreshness(options.timelimit);
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("country", country);
    url.searchParams.set("search_lang", language);
    url.searchParams.set("ui_lang", uiLanguage);
    if (freshness) {
      url.searchParams.set("freshness", freshness);
    }

    if (!context.proxyUrl) {
      throw new Error(
        "Brave search requires a CORS proxy. Configure one in Settings or use Serper/Exa.",
      );
    }

    const resp = await fetchWithProxy(url.toString(), context, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!resp.ok) {
      const detail = await readResponseErrorDetail(resp);
      throw new Error(
        `Brave search failed: ${resp.status} ${resp.statusText}${detail ? ` - ${detail}` : ""}`,
      );
    }

    const data = (await resp.json()) as {
      web?: {
        results?: Array<{ title?: string; url?: string; description?: string }>;
      };
    };

    return (data.web?.results || []).map((r) => ({
      title: r.title || "",
      href: r.url || "",
      body: r.description || "",
    }));
  },
};

const serperProvider: SearchProvider = {
  id: "serper",
  requiresApiKey: true,
  async search(query, options, context) {
    const apiKey = getApiKey(context, "serper");
    if (!apiKey) {
      throw new Error(
        "Serper search requires an API key. Configure it in zanosheets-web-config-v1.apiKeys.serper.",
      );
    }

    const [countryRaw, languageRaw] = (options.region || "us-en").split("-");
    const country = countryRaw?.toLowerCase() || "us";
    const language = languageRaw?.toLowerCase() || "en";

    const body: {
      q: string;
      num?: number;
      page?: number;
      gl?: string;
      hl?: string;
      tbs?: string;
    } = {
      q: query,
      num: options.maxResults ?? 10,
      page: options.page ?? 1,
      gl: country,
      hl: language,
    };

    if (options.timelimit) body.tbs = `qdr:${options.timelimit}`;

    const endpoint = "https://google.serper.dev/search";

    const resp = await fetchWithProxy(
      endpoint,
      context,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify(body),
      },
      { skipProxy: true },
    ); // Serper API has CORS support, use direct fetch

    if (!resp.ok) {
      throw new Error(
        `Serper search failed: ${resp.status} ${resp.statusText}`,
      );
    }

    const data = (await resp.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };

    return (data.organic || []).map((r) => ({
      title: r.title || "",
      href: r.link || "",
      body: r.snippet || "",
    }));
  },
};

const exaProvider: SearchProvider = {
  id: "exa",
  requiresApiKey: true,
  async search(query, options, context) {
    const apiKey = getApiKey(context, "exa");
    if (!apiKey) {
      throw new Error(
        "Exa search requires an API key. Configure it in zanosheets-web-config-v1.apiKeys.exa.",
      );
    }

    const body = {
      query,
      numResults: options.maxResults ?? 10,
      type: "auto",
    };

    const targetUrl = "https://api.exa.ai/search";

    const resp = await fetchWithProxy(
      targetUrl,
      context,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      },
      { skipProxy: true },
    ); // Exa API has CORS support, use direct fetch

    if (!resp.ok) {
      throw new Error(`Exa search failed: ${resp.status} ${resp.statusText}`);
    }

    const data = (await resp.json()) as {
      results?: Array<{ title?: string; url?: string; text?: string }>;
    };

    return (data.results || []).map((r) => ({
      title: r.title || "",
      href: r.url || "",
      body: r.text || "",
    }));
  },
};

const PROVIDERS: Record<string, SearchProvider> = {
  ddgs: ddgsProvider,
  brave: braveProvider,
  serper: serperProvider,
  exa: exaProvider,
};

const PROVIDER_LABELS: Record<string, string> = {
  ddgs: "ddgs (free, easily rate limited)",
  brave: "brave (API key)",
  serper: "serper (API key)",
  exa: "exa (API key)",
};

export function listSearchProviders(): { id: string; label: string }[] {
  return Object.keys(PROVIDERS).map((id) => ({
    id,
    label: PROVIDER_LABELS[id] ?? id,
  }));
}

export function getSearchProvider(providerId?: string): SearchProvider {
  if (!providerId) return ddgsProvider;
  return PROVIDERS[providerId] || ddgsProvider;
}

export async function searchWeb(
  query: string,
  options: SearchOptions = {},
  context: WebContext = {},
  providerId?: string,
): Promise<SearchResult[]> {
  const provider = getSearchProvider(providerId);
  return provider.search(query, options, context);
}
