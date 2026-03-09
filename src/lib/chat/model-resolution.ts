import type { Api, Model } from "@mariozechner/pi-ai";
import { getModel } from "@mariozechner/pi-ai/dist/models.js";
import { buildCustomModel, type ProviderConfig } from "../provider-config";

export interface ResolvedAgentModel {
  baseModel: Model<Api> | null;
  error?: string;
}

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

  try {
    const baseModel = getModel(
      config.provider as unknown as never,
      config.model as unknown as never,
    ) as Model<Api>;
    return { baseModel };
  } catch {
    return {
      baseModel: null,
      error: `Model '${config.model}' is not available for provider '${config.provider}'. Re-select the model in Settings.`,
    };
  }
}
