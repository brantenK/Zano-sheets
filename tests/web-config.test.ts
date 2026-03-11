import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWebConfig, saveWebConfig } from "../src/lib/web/config";

const store: Record<string, string> = {};
const sessionStore: Record<string, string> = {};

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
  key: (i: number) => Object.keys(store)[i] ?? null,
  length: 0,
});

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
  key: (i: number) => Object.keys(sessionStore)[i] ?? null,
  length: 0,
});

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  for (const k of Object.keys(sessionStore)) delete sessionStore[k];
});

describe("web config storage", () => {
  it("stores API keys in session storage when mode is session", () => {
    store["zanosheets-credential-storage"] = "session";

    saveWebConfig({
      searchProvider: "brave",
      fetchProvider: "basic",
      apiKeys: { brave: "brave-key" },
    });

    const keys = JSON.parse(sessionStore["zanosheets-web-keys-v1"] ?? "{}");
    expect(keys.apiKeys.brave).toBe("brave-key");
    expect(store["zanosheets-web-keys-v1"]).toBeUndefined();
  });

  it("loads preferences from local storage and keys from credential storage", () => {
    store["zanosheets-web-config-v1"] = JSON.stringify({
      searchProvider: "serper",
      fetchProvider: "exa",
    });
    store["zanosheets-credential-storage"] = "session";
    sessionStore["zanosheets-web-keys-v1"] = JSON.stringify({
      apiKeys: { serper: "serper-key" },
    });

    const loaded = loadWebConfig();
    expect(loaded.searchProvider).toBe("serper");
    expect(loaded.fetchProvider).toBe("exa");
    expect(loaded.apiKeys.serper).toBe("serper-key");
  });
});
