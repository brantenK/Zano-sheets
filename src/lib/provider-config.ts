import type { Api, Model } from "@mariozechner/pi-ai";
import {
  getCachedModelsForProvider,
  getCachedProviders,
} from "./chat/provider-catalog";
import {
  getCredentialStorage,
  getLocalStorage,
  getSessionStorage,
} from "./credential-storage";
import { loadOAuthCredentials } from "./oauth";
import {
  decryptValue,
  encryptValue,
  isEncrypted,
} from "./storage/crypto-utils";

export type ThinkingLevel = "none" | "low" | "medium" | "high";
export type BashMode = "on-demand" | "auto";

export interface ProviderConfig {
  provider: string;
  apiKey: string;
  model: string;
  useProxy: boolean;
  proxyUrl: string;
  thinking: ThinkingLevel;
  followMode: boolean;
  bashMode: BashMode;
  apiType?: string;
  customBaseUrl?: string;
  authMethod?: "apikey" | "oauth";
}

export interface ProviderConfigHealth {
  blocking: string[];
  warnings: string[];
}

function modelLooksMismatched(provider: string, model: string): string | null {
  const m = model.toLowerCase();
  if (provider === "openai" && m.includes("claude")) {
    return "Model looks Anthropic-like, but provider is OpenAI.";
  }
  if (provider === "anthropic" && (m.includes("gpt") || m.includes("o1"))) {
    return "Model looks OpenAI-like, but provider is Anthropic.";
  }
  if (provider === "openrouter" && !model.includes("/")) {
    return "OpenRouter model IDs usually include a vendor prefix (e.g. openai/gpt-4o).";
  }
  return null;
}

function apiKeyLooksMismatched(
  provider: string,
  apiKey: string,
): string | null {
  const key = apiKey.trim();
  if (!key) return null;

  // Common Google API key format
  if (provider === "openai" && key.startsWith("AIza")) {
    return "This looks like a Google API key (AIza...), not an OpenAI API key.";
  }

  // Common OpenAI API key formats
  if (
    provider === "google" &&
    (key.startsWith("sk-") || key.startsWith("sk-proj-"))
  ) {
    return "This looks like an OpenAI API key (sk-...), not a Google API key.";
  }

  return null;
}

export function evaluateProviderConfig(
  config: ProviderConfig,
): ProviderConfigHealth {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (!config.provider) {
    blocking.push("Select a provider.");
    return { blocking, warnings };
  }
  if (!config.model) {
    blocking.push("Select a model.");
  }

  if (config.provider === "custom") {
    if (!config.apiType) {
      blocking.push("Select an API type for Custom Endpoint.");
    }
    if (config.apiType !== "deepseek" && !config.customBaseUrl) {
      blocking.push("Enter a base URL for Custom Endpoint.");
    }
  } else {
    const providers = getCachedProviders();
    if (providers.length > 0) {
      const providerSet = new Set(providers);
      if (!providerSet.has(config.provider)) {
        blocking.push(
          `Provider '${config.provider}' is not available in this build.`,
        );
      }
    }

    if (config.model) {
      const models = getCachedModelsForProvider(config.provider);
      if (models.length > 0) {
        const modelIds = new Set(models.map((m) => m.id));
        if (!modelIds.has(config.model)) {
          blocking.push(
            `Model '${config.model}' is not in '${config.provider}' catalog. Re-select model in Settings.`,
          );
        }
      }
    }
  }

  if (config.authMethod !== "oauth" && !config.apiKey) {
    blocking.push("API key is missing.");
  }

  const apiKeyMismatch = apiKeyLooksMismatched(config.provider, config.apiKey);
  if (apiKeyMismatch) {
    blocking.push(apiKeyMismatch);
  }

  const mismatch = modelLooksMismatched(config.provider, config.model);
  if (mismatch) {
    warnings.push(mismatch);
  }

  if (config.useProxy && !config.proxyUrl) {
    warnings.push(
      "CORS proxy is enabled but proxy URL is empty. Requests will use provider base URL directly.",
    );
  }

  return { blocking, warnings };
}

export async function isProviderConfigReady(
  config: ProviderConfig,
): Promise<boolean> {
  if (!config.provider || !config.model) return false;

  if (config.provider === "custom") {
    if (!config.apiType) return false;
    if (config.apiType !== "deepseek" && !config.customBaseUrl) return false;
  }

  if (config.authMethod === "oauth") {
    if (config.apiKey) return true;
    const creds = await loadOAuthCredentials(config.provider);
    return Boolean(creds);
  }

  return Boolean(config.apiKey);
}

// v2 key names abandon the old corrupted stores entirely
const STORAGE_KEY = "zanosheets-config-v2";
const API_KEYS_STORAGE_KEY = "zanosheets-keys-v2";
const API_KEY_PROVIDER_PREFIX = "zanosheets-key-v2::";

function providerKeyStorageKey(provider: string): string {
  return `${API_KEY_PROVIDER_PREFIX}${provider}`;
}

function parseApiKeysStore(raw: string | null): Record<string, string> {
  if (!raw) return {};

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") {
      normalized[key] = value;
    }
  }
  return normalized;
}

function clearApiKeysInStorage(storage: Storage) {
  storage.removeItem(API_KEYS_STORAGE_KEY);
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (key.startsWith(API_KEY_PROVIDER_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
}

// Store API keys per provider
export async function loadApiKey(provider: string): Promise<string> {
  if (!provider) return "";
  const storage = getCredentialStorage();
  try {
    const providerScopedKey = storage.getItem(providerKeyStorageKey(provider));
    if (typeof providerScopedKey === "string") {
      // Try to decrypt; if it fails or returns null, treat as plaintext (migration)
      if (isEncrypted(providerScopedKey)) {
        const decrypted = await decryptValue(providerScopedKey);
        if (decrypted !== null) {
          return decrypted;
        }
        // Decryption failed - treat as plaintext and re-encrypt
        console.warn(
          "[ProviderConfig] loadApiKey: Decryption failed, treating as plaintext",
        );
        return providerScopedKey;
      }
      // Plaintext value - return as-is (will be re-encrypted on save)
      return providerScopedKey;
    }

    const storedData = storage.getItem(API_KEYS_STORAGE_KEY);
    if (!storedData) return "";

    // Detect corruption
    try {
      const store = parseApiKeysStore(storedData);
      const key = store[provider] || "";
      if (key) {
        try {
          // When migrating old plaintext keys, encrypt them immediately
          const encrypted = await encryptValue(key);
          storage.setItem(providerKeyStorageKey(provider), encrypted);
        } catch {
          /* ignore migration write failures */
        }
      }
      return key;
    } catch (parseErr) {
      console.error(
        "[ProviderConfig] loadApiKey: credential storage data is corrupted!",
        parseErr,
      );
      // Auto-recover by clearing corrupted data
      console.warn(
        "[ProviderConfig] loadApiKey: Clearing corrupted credential storage data",
      );
      storage.removeItem(API_KEYS_STORAGE_KEY);
      return "";
    }
  } catch (err) {
    console.error("[ProviderConfig] loadApiKey: ERROR:", err);
    return "";
  }
}

export async function saveApiKey(
  provider: string,
  apiKey: string,
): Promise<void> {
  if (!provider) return;
  const storage = getCredentialStorage();
  try {
    // Encrypt the API key before storing
    const encrypted = await encryptValue(apiKey);
    storage.setItem(providerKeyStorageKey(provider), encrypted);

    // Also update the legacy combined store (encrypted)
    const currentStore = storage.getItem(API_KEYS_STORAGE_KEY);
    const store = parseApiKeysStore(currentStore);
    store[provider] = encrypted;
    storage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error("[ProviderConfig] saveApiKey: ERROR:", err);
  }
}

export function clearStoredApiKeys(storage?: Storage) {
  try {
    const target = storage ?? getCredentialStorage();
    clearApiKeysInStorage(target);
  } catch (err) {
    console.error("[ProviderConfig] clearStoredApiKeys: ERROR:", err);
  }
}

export async function loadSavedConfig(): Promise<ProviderConfig | null> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    // Detect corruption
    let parsed: Partial<ProviderConfig>;
    try {
      parsed = JSON.parse(saved) as Partial<ProviderConfig>;
    } catch (parseErr) {
      console.error(
        "[ProviderConfig] loadSavedConfig: Config data is corrupted!",
        parseErr,
      );
      console.warn(
        "[ProviderConfig] loadSavedConfig: Clearing corrupted config data",
      );
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const config: ProviderConfig = {
      provider: parsed.provider ?? "",
      apiKey: "",
      model: parsed.model ?? "",
      useProxy: parsed.useProxy ?? false,
      proxyUrl: parsed.proxyUrl ?? "",
      thinking: parsed.thinking ?? "none",
      followMode: parsed.followMode ?? true,
      bashMode: parsed.bashMode ?? "on-demand",
      apiType: parsed.apiType ?? "",
      customBaseUrl: parsed.customBaseUrl ?? "",
      authMethod: parsed.authMethod ?? "apikey",
    };

    // Load the API key for this specific provider
    if (config.authMethod === "apikey") {
      config.apiKey = await loadApiKey(config.provider);
    }
    if (config.authMethod === "oauth") {
      const creds = await loadOAuthCredentials(config.provider);
      if (creds) {
        config.apiKey = creds.access;
      }
    }
    return config;
  } catch {}
  return null;
}

export function clearAllApiKeys() {
  try {
    const local = getLocalStorage();
    if (local) {
      local.removeItem(STORAGE_KEY);
      clearApiKeysInStorage(local);
    }

    const session = getSessionStorage();
    if (session) {
      clearApiKeysInStorage(session);
    }
  } catch (err) {
    console.error("[ProviderConfig] clearAllApiKeys: ERROR:", err);
  }
}

export function saveConfig(config: ProviderConfig) {
  // IMPORTANT: Do NOT save the API key here.  Key persistence is handled
  // exclusively by explicit saveApiKey() calls (debounce, blur, unmount flush,
  // clear handler).  Writing the key from saveConfig caused ghost-key bugs
  // because every non-key settings change (proxy, thinking, model, etc.)
  // re-wrote a potentially stale key value back to storage.
  // Don't store the API key in the main config blob
  const configToSave = { ...config, apiKey: "" };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
}

export const THINKING_LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export const API_TYPES = [
  {
    id: "openai-completions",
    name: "OpenAI Completions",
    hint: "Most compatible with Ollama, vLLM, LMStudio, etc.",
  },
  {
    id: "openai-responses",
    name: "OpenAI Responses",
    hint: "Newer OpenAI API format",
  },
  { id: "anthropic-messages", name: "Anthropic Messages", hint: "Claude API" },
  {
    id: "google-generative-ai",
    name: "Google Generative AI",
    hint: "Gemini API",
  },
  {
    id: "azure-openai-responses",
    name: "Azure OpenAI Responses",
    hint: "Azure-hosted OpenAI",
  },
  {
    id: "openai-codex-responses",
    name: "OpenAI Codex Responses",
    hint: "ChatGPT subscription models",
  },
  {
    id: "google-vertex",
    name: "Google Vertex AI",
    hint: "Vertex AI endpoint",
  },
  {
    id: "deepseek",
    name: "DeepSeek API",
    hint: "DeepSeek V3/R1 models - https://platform.deepseek.com",
  },
];

export function buildCustomModel(config: ProviderConfig): Model<Api> | null {
  if (!config.apiType || !config.model) return null;

  // DeepSeek pre-configured provider
  if (config.apiType === "deepseek") {
    return {
      id: config.model,
      name: `DeepSeek: ${config.model}`,
      api: "openai-completions",
      provider: "deepseek" as unknown as Model<Api>["provider"],
      baseUrl: "https://api.deepseek.com/v1",
      reasoning:
        config.model.includes("r1") || config.model.includes("reasoner"),
      input: ["text"] as ("text" | "image")[],
      cost: {
        input: 0.27, // $0.27/million tokens (cached: $0.07)
        output: 1.1, // $1.10/million tokens
        cacheRead: 0.07,
        cacheWrite: 0,
      },
      contextWindow: 128000,
      maxTokens: 64000,
    };
  }

  if (!config.customBaseUrl) return null;
  return {
    id: config.model,
    name: config.model,
    api: config.apiType as Api,
    provider: "custom" as unknown as Model<Api>["provider"],
    baseUrl: config.customBaseUrl,
    reasoning: true,
    input: ["text", "image"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 32000,
  };
}

export function applyProxyToModel(
  model: Model<Api>,
  config: ProviderConfig,
): Model<Api> {
  if (!config.useProxy || !config.proxyUrl || !model.baseUrl) return model;
  return {
    ...model,
    baseUrl: `${config.proxyUrl}/?url=${encodeURIComponent(model.baseUrl)}`,
  };
}
