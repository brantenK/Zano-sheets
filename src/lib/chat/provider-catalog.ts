import type { Api, Model } from "@mariozechner/pi-ai";

let providersCache: string[] | null = null;
const modelsCache = new Map<string, Model<Api>[]>();

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
    modelsCache.set(provider, models);
    return models;
  } catch {
    modelsCache.set(provider, []);
    return [];
  }
}
