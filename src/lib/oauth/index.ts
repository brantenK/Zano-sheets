export interface OAuthCredentials {
  refresh: string;
  access: string;
  expires: number;
}

export interface OAuthStorageWriteResult {
  ok: boolean;
  error?: string;
}

import {
  getCredentialStorage,
  getLocalStorage,
  getSessionStorage,
} from "../credential-storage";
import { handleError } from "../silent-error-handler";
import {
  decryptValue,
  encryptValue,
  isEncrypted,
} from "../storage/crypto-utils";

export type OAuthFlowState =
  | { step: "idle" }
  | { step: "awaiting-code"; verifier: string; oauthState?: string }
  | { step: "exchanging" }
  | { step: "connected" }
  | { step: "error"; message: string };

export const OAUTH_PROVIDERS: Record<
  string,
  { label: string; buttonText: string }
> = {
  anthropic: {
    label: "OAuth (Pro/Max)",
    buttonText: "Login with Claude Pro/Max",
  },
  "openai-codex": {
    label: "OAuth (Plus/Pro)",
    buttonText: "Login with ChatGPT Plus/Pro",
  },
};

// --- Credential Storage ---

const OAUTH_STORAGE_KEY = "zanosheets-oauth-credentials";
const LEGACY_OAUTH_STORAGE_KEY = "openexcel-oauth-credentials";

function parseOAuthStore(raw: string | null): Record<string, OAuthCredentials> {
  if (!raw) return {};
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as Record<string, OAuthCredentials>;
}

async function loadOAuthStore(): Promise<Record<string, OAuthCredentials>> {
  const storage = getCredentialStorage();
  const currentRaw = storage.getItem(OAUTH_STORAGE_KEY);
  if (currentRaw) {
    // Try to decrypt; if it's encrypted, decrypt it
    let decryptedRaw = currentRaw;
    if (isEncrypted(currentRaw)) {
      const decrypted = await decryptValue(currentRaw);
      if (decrypted !== null) {
        decryptedRaw = decrypted;
      } else {
        // Decryption failed - treat as plaintext (migration)
        console.warn(
          "[OAuth] loadOAuthStore: Decryption failed, treating as plaintext",
        );
      }
    }
    return parseOAuthStore(decryptedRaw);
  }

  const legacyRaw = storage.getItem(LEGACY_OAUTH_STORAGE_KEY);
  if (!legacyRaw) return {};

  const legacyStore = parseOAuthStore(legacyRaw);
  try {
    // Encrypt the legacy data before storing
    const encrypted = await encryptValue(JSON.stringify(legacyStore));
    storage.setItem(OAUTH_STORAGE_KEY, encrypted);
    storage.removeItem(LEGACY_OAUTH_STORAGE_KEY);
  } catch (err) {
    // Migration may fail if storage is full or unavailable; log but continue
    handleError(err, "OAuth legacy data migration failed", {
      logToTelemetry: false,
    });
  }
  return legacyStore;
}

function validateOAuthCredentials(
  creds: Partial<OAuthCredentials>,
  context: string,
): OAuthCredentials {
  if (!creds.access || typeof creds.access !== "string") {
    throw new Error(`${context}: missing access token`);
  }
  if (!creds.refresh || typeof creds.refresh !== "string") {
    throw new Error(`${context}: missing refresh token`);
  }
  if (typeof creds.expires !== "number" || !Number.isFinite(creds.expires)) {
    throw new Error(`${context}: invalid expiry timestamp`);
  }
  return {
    access: creds.access,
    refresh: creds.refresh,
    expires: creds.expires,
  };
}

export async function loadOAuthCredentials(
  provider: string,
): Promise<OAuthCredentials | null> {
  try {
    const store = await loadOAuthStore();
    const credentials = store[provider];
    if (!credentials) {
      return null;
    }

    return validateOAuthCredentials(credentials, "OAuth credential load");
  } catch (error) {
    handleError(error, "OAuth credential load", { logToTelemetry: true });
    return null;
  }
}

export async function saveOAuthCredentials(
  provider: string,
  creds: OAuthCredentials,
): Promise<OAuthStorageWriteResult> {
  try {
    const store = await loadOAuthStore();
    store[provider] = validateOAuthCredentials(creds, "OAuth credential save");
    const storage = getCredentialStorage();
    // Encrypt the store before saving
    const encrypted = await encryptValue(JSON.stringify(store));
    storage.setItem(OAUTH_STORAGE_KEY, encrypted);
    return { ok: true };
  } catch (error) {
    handleError(error, "OAuth credential save", { logToTelemetry: true });
    return {
      ok: false,
      error: "Failed to save OAuth credentials in browser storage.",
    };
  }
}

export async function removeOAuthCredentials(
  provider: string,
): Promise<OAuthStorageWriteResult> {
  try {
    const store = await loadOAuthStore();
    delete store[provider];
    const storage = getCredentialStorage();
    // Encrypt the store before saving
    const encrypted = await encryptValue(JSON.stringify(store));
    storage.setItem(OAUTH_STORAGE_KEY, encrypted);
    return { ok: true };
  } catch (error) {
    handleError(error, "OAuth credential remove", { logToTelemetry: true });
    return {
      ok: false,
      error: "Failed to remove OAuth credentials from browser storage.",
    };
  }
}

function clearOAuthStoreInStorage(storage: Storage) {
  storage.removeItem(OAUTH_STORAGE_KEY);
  storage.removeItem(LEGACY_OAUTH_STORAGE_KEY);
}

export function clearStoredOAuthCredentials(storage?: Storage) {
  try {
    const target = storage ?? getCredentialStorage();
    clearOAuthStoreInStorage(target);
  } catch (error) {
    handleError(error, "OAuth clear stored credentials");
  }
}

export function clearAllOAuthCredentials() {
  try {
    const local = getLocalStorage();
    if (local) {
      clearOAuthStoreInStorage(local);
    }

    const session = getSessionStorage();
    if (session) {
      clearOAuthStoreInStorage(session);
    }
  } catch (error) {
    handleError(error, "OAuth clear all credentials");
  }
}

// --- PKCE (Web Crypto, browser-safe) ---

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export async function generatePKCE(): Promise<{
  verifier: string;
  challenge: string;
}> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64urlEncode(verifierBytes);
  const data = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const challenge = base64urlEncode(new Uint8Array(hashBuffer));
  return { verifier, challenge };
}

function createRandomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Provider Constants ---
// These are public OAuth client IDs, not secrets

const ANTHROPIC_CLIENT_ID = "8d1c250a-e61b-44d9-88ed-5944d1962f5e";
const ANTHROPIC_AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const ANTHROPIC_TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const ANTHROPIC_REDIRECT_URI =
  "https://console.anthropic.com/oauth/code/callback";
const ANTHROPIC_SCOPES = "org:create_api_key user:profile user:inference";

const OPENAI_CODEX_CLIENT_ID = "app_E_MOaEEZ73f0CKaXp7whran";
const OPENAI_CODEX_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const OPENAI_CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
const OPENAI_CODEX_REDIRECT_URI = "http://localhost:1455/auth/callback";
const OPENAI_CODEX_SCOPE = "openid profile email offline_access";

// --- Authorization URL ---

export function buildAuthorizationUrl(
  provider: string,
  challenge: string,
  _verifier: string,
): { url: string; oauthState?: string } {
  if (provider === "openai-codex") {
    const oauthState = createRandomState();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: OPENAI_CODEX_CLIENT_ID,
      redirect_uri: OPENAI_CODEX_REDIRECT_URI,
      scope: OPENAI_CODEX_SCOPE,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: oauthState,
      id_token_add_organizations: "true",
      codex_cli_simplified_flow: "true",
      originator: "pi",
    });
    return { url: `${OPENAI_CODEX_AUTHORIZE_URL}?${params}`, oauthState };
  }
  // Anthropic - use random state for CSRF protection (separate from PKCE verifier)
  const oauthState = createRandomState();
  const params = new URLSearchParams({
    code: "true",
    client_id: ANTHROPIC_CLIENT_ID,
    response_type: "code",
    redirect_uri: ANTHROPIC_REDIRECT_URI,
    scope: ANTHROPIC_SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: oauthState,
  });
  return { url: `${ANTHROPIC_AUTHORIZE_URL}?${params}`, oauthState };
}

// --- Input Parsing ---

function parseAuthorizationInput(input: string): {
  code?: string;
  state?: string;
} {
  const value = input.trim();
  if (!value) return {};
  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
    };
  } catch {
    /* not a URL */
  }
  if (value.includes("#")) {
    const [code, state] = value.split("#", 2);
    return { code, state };
  }
  if (value.includes("code=")) {
    const params = new URLSearchParams(value);
    return {
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
    };
  }
  return { code: value };
}

// --- Proxy URL helper ---

function buildProxiedUrl(
  baseUrl: string,
  useProxy: boolean,
  proxyUrl: string,
): string {
  return useProxy && proxyUrl
    ? `${proxyUrl}/?url=${encodeURIComponent(baseUrl)}`
    : baseUrl;
}

// --- Token Refresh ---

async function refreshAnthropicOAuth(
  refreshToken: string,
  proxyUrl: string,
  useProxy: boolean,
): Promise<OAuthCredentials> {
  const url = buildProxiedUrl(ANTHROPIC_TOKEN_URL, useProxy, proxyUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: ANTHROPIC_CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok)
    throw new Error(`Anthropic token refresh failed: ${response.status}`);
  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return validateOAuthCredentials(
    {
      refresh: data.refresh_token,
      access: data.access_token,
      expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000,
    },
    "Anthropic token refresh",
  );
}

async function refreshOpenAICodexOAuth(
  refreshToken: string,
  proxyUrl: string,
  useProxy: boolean,
): Promise<OAuthCredentials> {
  const url = buildProxiedUrl(OPENAI_CODEX_TOKEN_URL, useProxy, proxyUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: OPENAI_CODEX_CLIENT_ID,
    }),
  });
  if (!response.ok)
    throw new Error(`OpenAI Codex token refresh failed: ${response.status}`);
  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (
    !data.access_token ||
    !data.refresh_token ||
    typeof data.expires_in !== "number"
  ) {
    throw new Error("OpenAI Codex token refresh: missing fields in response");
  }
  return validateOAuthCredentials(
    {
      refresh: data.refresh_token,
      access: data.access_token,
      expires: Date.now() + data.expires_in * 1000,
    },
    "OpenAI Codex token refresh",
  );
}

export async function refreshOAuthToken(
  provider: string,
  refreshToken: string,
  proxyUrl: string,
  useProxy: boolean,
): Promise<OAuthCredentials> {
  if (provider === "openai-codex") {
    return refreshOpenAICodexOAuth(refreshToken, proxyUrl, useProxy);
  }
  return refreshAnthropicOAuth(refreshToken, proxyUrl, useProxy);
}

/**
 * Check if OAuth credentials are expired or will expire soon (within 5 minutes).
 */
export function isTokenExpired(
  creds: OAuthCredentials,
  bufferMs: number = 5 * 60 * 1000,
): boolean {
  const now = Date.now();
  return creds.expires <= now + bufferMs;
}

/**
 * Get valid OAuth credentials, automatically refreshing if needed.
 * Returns null if credentials don't exist or if refresh fails.
 *
 * @param provider - The OAuth provider (e.g., "anthropic", "openai-codex")
 * @param proxyUrl - Optional CORS proxy URL
 * @param useProxy - Whether to use the CORS proxy
 * @returns Valid OAuth credentials, or null if unavailable
 */
export async function getValidOAuthCredentials(
  provider: string,
  proxyUrl: string = "",
  useProxy: boolean = false,
): Promise<OAuthCredentials | null> {
  const creds = await loadOAuthCredentials(provider);
  if (!creds) {
    return null;
  }

  // Check if token is expired or will expire soon
  if (isTokenExpired(creds)) {
    try {
      const refreshed = await refreshOAuthToken(
        provider,
        creds.refresh,
        proxyUrl,
        useProxy,
      );
      const saveResult = await saveOAuthCredentials(provider, refreshed);
      if (!saveResult.ok) {
        handleError(
          new Error(saveResult.error || "Failed to save refreshed token"),
          "OAuth token save after refresh",
        );
      }
      return refreshed;
    } catch (error) {
      handleError(error, "OAuth token refresh failed");
      // Return null to signal that credentials are invalid and user needs to re-auth
      return null;
    }
  }

  return creds;
}

// --- Token Exchange ---

export async function exchangeOAuthCode(params: {
  provider: string;
  rawInput: string;
  verifier: string;
  expectedState?: string;
  useProxy: boolean;
  proxyUrl: string;
}): Promise<OAuthCredentials> {
  const { provider, rawInput, verifier, expectedState, useProxy, proxyUrl } =
    params;
  const parsed = parseAuthorizationInput(rawInput);
  if (!parsed.code)
    throw new Error("Could not extract authorization code from input");
  if (expectedState && parsed.state && parsed.state !== expectedState) {
    throw new Error("State mismatch — possible CSRF. Please try again.");
  }

  if (provider === "openai-codex") {
    const url = buildProxiedUrl(OPENAI_CODEX_TOKEN_URL, useProxy, proxyUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: OPENAI_CODEX_CLIENT_ID,
        code: parsed.code,
        code_verifier: verifier,
        redirect_uri: OPENAI_CODEX_REDIRECT_URI,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Token exchange failed (${response.status}): ${text}`);
    }
    const data = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (
      !data.access_token ||
      !data.refresh_token ||
      typeof data.expires_in !== "number"
    ) {
      throw new Error("Token response missing required fields");
    }
    return validateOAuthCredentials(
      {
        refresh: data.refresh_token,
        access: data.access_token,
        expires: Date.now() + data.expires_in * 1000,
      },
      "OpenAI Codex token exchange",
    );
  }

  // Anthropic
  const url = buildProxiedUrl(ANTHROPIC_TOKEN_URL, useProxy, proxyUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: ANTHROPIC_CLIENT_ID,
      code: parsed.code,
      state: parsed.state,
      redirect_uri: ANTHROPIC_REDIRECT_URI,
      code_verifier: verifier,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return validateOAuthCredentials(
    {
      refresh: data.refresh_token,
      access: data.access_token,
      expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000,
    },
    "Anthropic token exchange",
  );
}
