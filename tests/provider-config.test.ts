import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadApiKey,
  loadSavedConfig,
  saveApiKey,
  saveConfig,
} from "../src/lib/provider-config";

// Minimal in-memory localStorage mock -- no jsdom required
const store: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
  clear: () => {
    for (const k of Object.keys(store)) delete store[k];
  },
});

const sessionStore: Record<string, string> = {};
vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => sessionStore[k] ?? null,
  setItem: (k: string, v: string) => {
    sessionStore[k] = v;
  },
  removeItem: (k: string) => {
    delete sessionStore[k];
  },
  clear: () => {
    for (const k of Object.keys(sessionStore)) delete sessionStore[k];
  },
});

beforeEach(() => {
  // Clear store between tests
  for (const k of Object.keys(store)) delete store[k];
  for (const k of Object.keys(sessionStore)) delete sessionStore[k];
});

describe("loadApiKey / saveApiKey", () => {
  it("returns empty string when nothing is stored", () => {
    expect(loadApiKey("openrouter")).toBe("");
  });

  it("returns the saved key for the matching provider", () => {
    saveApiKey("openrouter", "sk-or-test-123");
    expect(loadApiKey("openrouter")).toBe("sk-or-test-123");
  });

  it("stores keys independently per provider", () => {
    saveApiKey("openrouter", "or-key");
    saveApiKey("openai", "oai-key");
    expect(loadApiKey("openrouter")).toBe("or-key");
    expect(loadApiKey("openai")).toBe("oai-key");
    expect(loadApiKey("anthropic")).toBe("");
  });

  it("overwrites an existing key for the same provider", () => {
    saveApiKey("openrouter", "old-key");
    saveApiKey("openrouter", "new-key");
    expect(loadApiKey("openrouter")).toBe("new-key");
  });

  it("does not affect other providers when one key is updated", () => {
    saveApiKey("openai", "oai-key");
    saveApiKey("openrouter", "or-key-v1");
    saveApiKey("openrouter", "or-key-v2");
    expect(loadApiKey("openai")).toBe("oai-key");
  });
});

describe("loadSavedConfig", () => {
  it("returns null when nothing is stored", () => {
    expect(loadSavedConfig()).toBeNull();
  });

  it("defaults proxy mode to off when the saved value is missing", () => {
    store["zanosheets-config-v2"] = JSON.stringify({
      provider: "openai",
      model: "gpt-4o",
      proxyUrl: "",
      thinking: "none",
      followMode: true,
      authMethod: "apikey",
    });

    const loaded = loadSavedConfig();
    expect(loaded?.useProxy).toBe(false);
  });

  it("returns null for invalid JSON in storage", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    store["zanosheets-config-v2"] = "{invalid json}";
    expect(loadSavedConfig()).toBeNull();
    consoleError.mockRestore();
    consoleWarn.mockRestore();
  });
});

describe("saveConfig / loadSavedConfig round-trip", () => {
  const baseConfig = {
    provider: "openrouter",
    apiKey: "sk-or-test",
    model: "gpt-4o",
    useProxy: false,
    proxyUrl: "",
    thinking: "none" as const,
    followMode: true,
    authMethod: "apikey" as const,
  };

  it("round-trips provider, model, and settings", () => {
    saveConfig(baseConfig);
    const loaded = loadSavedConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.provider).toBe("openrouter");
    expect(loaded?.model).toBe("gpt-4o");
    expect(loaded?.useProxy).toBe(false);
    expect(loaded?.thinking).toBe("none");
    expect(loaded?.followMode).toBe(true);
    expect(loaded?.authMethod).toBe("apikey");
  });

  it("loads the apiKey from the per-provider store, not raw config", () => {
    // saveConfig no longer writes the key; callers must use saveApiKey explicitly
    saveApiKey(baseConfig.provider, baseConfig.apiKey);
    saveConfig(baseConfig);
    const loaded = loadSavedConfig();
    expect(loaded?.apiKey).toBe("sk-or-test");
  });

  it("does not store the api key in the main config blob", () => {
    saveConfig(baseConfig);
    const raw = JSON.parse(store["zanosheets-config-v2"] ?? "{}");
    expect(raw.apiKey).toBe("");
  });

  it("returns empty apiKey when no key has been saved for the provider", () => {
    // Save config without going through saveApiKey
    store["zanosheets-config-v2"] = JSON.stringify({
      provider: "groq",
      model: "llama3",
      apiKey: "",
      useProxy: false,
      proxyUrl: "",
      thinking: "none",
      followMode: true,
      authMethod: "apikey",
    });
    const loaded = loadSavedConfig();
    expect(loaded?.apiKey ?? "").toBe("");
  });
});
