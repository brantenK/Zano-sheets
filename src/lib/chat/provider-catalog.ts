import type { Api, Model } from "@mariozechner/pi-ai";

let providersCache: string[] | null = null;
const modelsCache = new Map<string, Model<Api>[]>();

/**
 * Extra OpenRouter models not yet in the pi-ai library.
 * These are appended to the OpenRouter model list at load time.
 */
const EXTRA_OPENROUTER_MODELS: Model<Api>[] = [
  {
    id: "openrouter/hunter-alpha",
    name: "Hunter Alpha (OpenRouter)",
    api: "openai-completions" as Api,
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 1048576,
    maxTokens: 65536,
  } as Model<Api>,
  {
    id: "openrouter/healer-alpha",
    name: "Healer Alpha (OpenRouter)",
    api: "openai-completions" as Api,
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 262144,
    maxTokens: 65536,
  } as Model<Api>,
];

export function getCachedProviders(): string[] {
  return providersCache ?? [];
}

export function getCachedModelsForProvider(provider: string): Model<Api>[] {
  return modelsCache.get(provider) ?? [];
}

export async function preloadProviderCatalog(): Promise<string[]> {
  if (providersCache) {
    return providersCache;
  }

  const { getProviders } = await import("@mariozechner/pi-ai/dist/models.js");
  providersCache = getProviders().map((provider) => String(provider));
  return providersCache;
}

export async function loadModelsForProvider(
  provider: string,
): Promise<Model<Api>[]> {
  const cached = modelsCache.get(provider);
  if (cached) {
    return cached;
  }

  const { getModels } = await import("@mariozechner/pi-ai/dist/models.js");

  try {
    const models = getModels(provider as never) as Model<Api>[];

    // Append extra models not yet in the pi-ai library
    if (provider === "openrouter") {
      for (const extra of EXTRA_OPENROUTER_MODELS) {
        if (!models.some((m) => m.id === extra.id)) {
          models.push(extra);
        }
      }
    }

    modelsCache.set(provider, models);
    return models;
  } catch {
    modelsCache.set(provider, []);
    return [];
  }
}
