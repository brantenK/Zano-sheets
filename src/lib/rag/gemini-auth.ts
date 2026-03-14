import { loadSavedConfig } from "../provider-config";
import { loadWebConfig } from "../web/config";

export const GEMINI_API_KEY_STORAGE_KEY = "zano_gemini_api_key_v1";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export interface GeminiRuntimeConfig {
  apiKey: string;
  model: string;
  source: "provider" | "web";
}

function normalizeGeminiModel(model: string | undefined): string {
  if (!model) return DEFAULT_GEMINI_MODEL;
  return model.toLowerCase().includes("gemini") ? model : DEFAULT_GEMINI_MODEL;
}

export async function getGeminiRuntimeConfig(): Promise<
  GeminiRuntimeConfig | undefined
> {
  const providerConfig = await loadSavedConfig();
  if (providerConfig?.provider === "google" && providerConfig.apiKey) {
    return {
      apiKey: providerConfig.apiKey,
      model: normalizeGeminiModel(providerConfig.model),
      source: "provider",
    };
  }

  const webConfig = loadWebConfig();
  const apiKey = webConfig.apiKeys.gemini?.trim();
  if (!apiKey) return undefined;

  return {
    apiKey,
    model: DEFAULT_GEMINI_MODEL,
    source: "web",
  };
}

export async function getGeminiApiKey(): Promise<string | undefined> {
  return (await getGeminiRuntimeConfig())?.apiKey;
}
