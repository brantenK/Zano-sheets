import {
  getCredentialStorage,
  getCredentialStorageMode,
  getLocalStorage,
  getSessionStorage,
} from "../credential-storage";

export interface WebConfig {
  searchProvider: string;
  fetchProvider: string;
  apiKeys: {
    exa?: string;
    brave?: string;
    serper?: string;
    gemini?: string;
  };
}

export interface WebConfigStorageResult {
  ok: boolean;
  error?: string;
}

const STORAGE_KEY = "zanosheets-web-config-v1";
const LEGACY_STORAGE_KEY = "openexcel-web-config";
const WEB_KEYS_STORAGE_KEY = "zanosheets-web-keys-v1";

const DEFAULT_WEB_CONFIG: WebConfig = {
  searchProvider: "ddgs",
  fetchProvider: "basic",
  apiKeys: {},
};

type WebPreferences = Pick<WebConfig, "searchProvider" | "fetchProvider">;

function parseWebPreferences(raw: string): WebPreferences {
  const parsed = JSON.parse(raw) as Partial<WebConfig>;
  return {
    searchProvider: parsed.searchProvider || DEFAULT_WEB_CONFIG.searchProvider,
    fetchProvider: parsed.fetchProvider || DEFAULT_WEB_CONFIG.fetchProvider,
  };
}

function parseWebKeys(raw: string): WebConfig["apiKeys"] {
  const parsed = JSON.parse(raw) as Partial<WebConfig>;
  const apiKeys = parsed.apiKeys || {};
  const normalized: WebConfig["apiKeys"] = {};
  for (const [key, value] of Object.entries(apiKeys)) {
    if (typeof value === "string") {
      normalized[key as keyof WebConfig["apiKeys"]] = value;
    }
  }
  return { ...DEFAULT_WEB_CONFIG.apiKeys, ...normalized };
}

function loadWebPreferences(): WebPreferences {
  try {
    const local = getLocalStorage();
    const currentRaw = local?.getItem(STORAGE_KEY) ?? null;
    if (currentRaw) return parseWebPreferences(currentRaw);

    const legacyRaw = local?.getItem(LEGACY_STORAGE_KEY) ?? null;
    if (!legacyRaw) {
      return {
        searchProvider: DEFAULT_WEB_CONFIG.searchProvider,
        fetchProvider: DEFAULT_WEB_CONFIG.fetchProvider,
      };
    }

    const legacyParsed = JSON.parse(legacyRaw) as Partial<WebConfig>;
    const prefs = parseWebPreferences(legacyRaw);

    try {
      local?.setItem(STORAGE_KEY, JSON.stringify(prefs));
      local?.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }

    if (legacyParsed?.apiKeys && getCredentialStorageMode() === "device") {
      try {
        const storage = getCredentialStorage();
        storage.setItem(
          WEB_KEYS_STORAGE_KEY,
          JSON.stringify({ apiKeys: legacyParsed.apiKeys }),
        );
      } catch {
        /* ignore */
      }
    }

    return prefs;
  } catch {
    return {
      searchProvider: DEFAULT_WEB_CONFIG.searchProvider,
      fetchProvider: DEFAULT_WEB_CONFIG.fetchProvider,
    };
  }
}

function loadWebKeys(): WebConfig["apiKeys"] {
  try {
    const storage = getCredentialStorage();
    const raw = storage.getItem(WEB_KEYS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WEB_CONFIG.apiKeys };
    return parseWebKeys(raw);
  } catch {
    return { ...DEFAULT_WEB_CONFIG.apiKeys };
  }
}

function clearWebKeysInStorage(storage: Storage) {
  storage.removeItem(WEB_KEYS_STORAGE_KEY);
}

export function clearStoredWebKeys(storage?: Storage) {
  try {
    const target = storage ?? getCredentialStorage();
    clearWebKeysInStorage(target);
  } catch {
    // ignore
  }
}

export function loadWebConfig(): WebConfig {
  const prefs = loadWebPreferences();
  const keys = loadWebKeys();
  return { ...prefs, apiKeys: keys };
}

export function saveWebConfig(config: Partial<WebConfig>) {
  try {
    const current = loadWebConfig();
    const nextPrefs: WebPreferences = {
      searchProvider: config.searchProvider || current.searchProvider,
      fetchProvider: config.fetchProvider || current.fetchProvider,
    };
    const nextKeys: WebConfig["apiKeys"] = {
      ...current.apiKeys,
      ...(config.apiKeys || {}),
    };

    const local = getLocalStorage();
    local?.setItem(STORAGE_KEY, JSON.stringify(nextPrefs));

    const storage = getCredentialStorage();
    storage.setItem(
      WEB_KEYS_STORAGE_KEY,
      JSON.stringify({ apiKeys: nextKeys }),
    );
    return { ok: true } satisfies WebConfigStorageResult;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to save web settings in browser storage.",
    } satisfies WebConfigStorageResult;
  }
}

export function clearWebConfig() {
  try {
    const local = getLocalStorage();
    local?.removeItem(STORAGE_KEY);
    local?.removeItem(LEGACY_STORAGE_KEY);

    if (local) {
      clearWebKeysInStorage(local);
    }
    const session = getSessionStorage();
    if (session) {
      clearWebKeysInStorage(session);
    }

    return { ok: true } satisfies WebConfigStorageResult;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to clear saved web settings.",
    } satisfies WebConfigStorageResult;
  }
}
