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
  it("returns empty string when nothing is stored", async () => {
    expect(await loadApiKey("openrouter")).toBe("");
  });

  it("returns the saved key for the matching provider", async () => {
    await saveApiKey("openrouter", "sk-or-test-123");
    expect(await loadApiKey("openrouter")).toBe("sk-or-test-123");
  });

  it("stores keys independently per provider", async () => {
    await saveApiKey("openrouter", "or-key");
    await saveApiKey("openai", "oai-key");
    expect(await loadApiKey("openrouter")).toBe("or-key");
    expect(await loadApiKey("openai")).toBe("oai-key");
    expect(await loadApiKey("anthropic")).toBe("");
  });

  it("overwrites an existing key for the same provider", async () => {
    await saveApiKey("openrouter", "old-key");
    await saveApiKey("openrouter", "new-key");
    expect(await loadApiKey("openrouter")).toBe("new-key");
  });

  it("does not affect other providers when one key is updated", async () => {
    await saveApiKey("openai", "oai-key");
    await saveApiKey("openrouter", "or-key-v1");
    await saveApiKey("openrouter", "or-key-v2");
    expect(await loadApiKey("openai")).toBe("oai-key");
  });
});

describe("loadSavedConfig", () => {
  it("returns null when nothing is stored", async () => {
    await expect(loadSavedConfig()).resolves.toBeNull();
  });

  it("defaults proxy mode to off when the saved value is missing", async () => {
    store["zanosheets-config-v2"] = JSON.stringify({
      provider: "openai",
      model: "gpt-4o",
      proxyUrl: "",
      thinking: "none",
      followMode: true,
      authMethod: "apikey",
    });

    const loaded = await loadSavedConfig();
    expect(loaded?.useProxy).toBe(false);
  });

  it("returns null for invalid JSON in storage", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});
    store["zanosheets-config-v2"] = "{invalid json}";
    await expect(loadSavedConfig()).resolves.toBeNull();
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

  it("round-trips provider, model, and settings", async () => {
    saveConfig(baseConfig);
    const loaded = await loadSavedConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.provider).toBe("openrouter");
    expect(loaded?.model).toBe("gpt-4o");
    expect(loaded?.useProxy).toBe(false);
    expect(loaded?.thinking).toBe("none");
    expect(loaded?.followMode).toBe(true);
    expect(loaded?.authMethod).toBe("apikey");
  });

  it("loads the apiKey from the per-provider store, not raw config", async () => {
    // saveConfig no longer writes the key; callers must use saveApiKey explicitly
    await saveApiKey(baseConfig.provider, baseConfig.apiKey);
    saveConfig(baseConfig);
    const loaded = await loadSavedConfig();
    expect(loaded?.apiKey).toBe("sk-or-test");
  });

  it("does not store the api key in the main config blob", () => {
    saveConfig(baseConfig);
    const raw = JSON.parse(store["zanosheets-config-v2"] ?? "{}");
    expect(raw.apiKey).toBe("");
  });

  it("returns empty apiKey when no key has been saved for the provider", async () => {
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
    const loaded = await loadSavedConfig();
    expect(loaded?.apiKey ?? "").toBe("");
  });
});
