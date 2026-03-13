import { type Api, type Model } from "@mariozechner/pi-ai";
import { buildCustomModel, type ProviderConfig } from "../provider-config";
import { getCachedModelsForProvider } from "./provider-catalog";
import { getModelSafe, providerToApi } from "./adapter";

export interface ResolvedAgentModel {
  baseModel: Model<Api> | null;
  error?: string;
}

/**
 * Resolves a provider config to a pi-ai Model instance.
 *
 * Uses type-safe adapter methods instead of unsafe casts to ensure
 * proper type checking and runtime validation.
 */
export function resolveAgentModel(config: ProviderConfig): ResolvedAgentModel {
  if (config.provider === "custom") {
    const customModel = buildCustomModel(config);
    if (!customModel) {
      return {
        baseModel: null,
        error:
          "Custom endpoint configuration is invalid. Review API type, base URL, and model settings.",
      };
    }
    return { baseModel: customModel };
  }

  // Check cached models first (includes manually-added models like extra
  // OpenRouter entries that aren't in the pi-ai built-in registry).
  const cached = getCachedModelsForProvider(config.provider);
  const cachedMatch = cached.find((m) => m.id === config.model);
  if (cachedMatch) {
    return { baseModel: cachedMatch };
  }

  // Use type-safe adapter instead of unsafe casts
  const baseModel = getModelSafe(config.provider, config.model);

  if (!baseModel) {
    return {
      baseModel: null,
      error: `Model '${config.model}' is not available for provider '${config.provider}'. Re-select the model in Settings.`,
    };
  }

  return { baseModel };
}
