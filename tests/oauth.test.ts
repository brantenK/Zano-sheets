import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadOAuthCredentials,
  saveOAuthCredentials,
} from "../src/lib/oauth";

const store: Record<string, string> = {};
const sessionStore: Record<string, string> = {};

vi.stubGlobal("localStorage", {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
});

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => sessionStore[key] ?? null,
  setItem: (key: string, value: string) => {
    sessionStore[key] = value;
  },
  removeItem: (key: string) => {
    delete sessionStore[key];
  },
  clear: () => {
    for (const key of Object.keys(sessionStore)) {
      delete sessionStore[key];
    }
  },
});

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  for (const key of Object.keys(sessionStore)) {
    delete sessionStore[key];
  }
});

describe("OAuth credential storage", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("loads valid saved credentials", () => {
    const result = saveOAuthCredentials("anthropic", {
      access: "access-token",
      refresh: "refresh-token",
      expires: 123456,
    });

    expect(result.ok).toBe(true);
    expect(loadOAuthCredentials("anthropic")).toEqual({
      access: "access-token",
      refresh: "refresh-token",
      expires: 123456,
    });
  });

  it("rejects invalid credentials during save", () => {
    const result = saveOAuthCredentials("anthropic", {
      access: "access-token",
      refresh: "",
      expires: 123456,
    });

    expect(result).toEqual({
      ok: false,
      error: "Failed to save OAuth credentials in browser storage.",
    });
    expect(loadOAuthCredentials("anthropic")).toBeNull();
  });

  it("ignores malformed credentials already present in storage", () => {
    store["zanosheets-oauth-credentials"] = JSON.stringify({
      anthropic: {
        access: "access-token",
        expires: "not-a-number",
      },
    });

    expect(loadOAuthCredentials("anthropic")).toBeNull();
  });
});
