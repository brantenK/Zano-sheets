import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCredentialStorage,
  getCredentialStorageMode,
  getLocalStorage,
  getSessionStorage,
  setCredentialStorageMode,
} from "../src/lib/credential-storage";

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

describe("credential storage", () => {
  it("defaults to device mode", () => {
    expect(getCredentialStorageMode()).toBe("device");
  });

  it("switches to session mode and returns session storage", () => {
    setCredentialStorageMode("session");
    expect(getCredentialStorageMode()).toBe("session");
    expect(getCredentialStorage()).toBe(getSessionStorage());
  });

  it("returns local storage in device mode", () => {
    setCredentialStorageMode("device");
    expect(getCredentialStorageMode()).toBe("device");
    expect(getCredentialStorage()).toBe(getLocalStorage());
  });
});
