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

const DEFAULT_WEB_CONFIG: WebConfig = {
  searchProvider: "ddgs",
  fetchProvider: "basic",
  apiKeys: {},
};

function parseWebConfig(raw: string): WebConfig {
  const parsed = JSON.parse(raw) as Partial<WebConfig>;
  return {
    searchProvider: parsed.searchProvider || DEFAULT_WEB_CONFIG.searchProvider,
    fetchProvider: parsed.fetchProvider || DEFAULT_WEB_CONFIG.fetchProvider,
    apiKeys: {
      ...DEFAULT_WEB_CONFIG.apiKeys,
      ...(parsed.apiKeys || {}),
    },
  };
}

export function loadWebConfig(): WebConfig {
  try {
    const currentRaw = localStorage.getItem(STORAGE_KEY);
    if (currentRaw) return parseWebConfig(currentRaw);

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) return { ...DEFAULT_WEB_CONFIG };

    const migrated = parseWebConfig(legacyRaw);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return migrated;
  } catch {
    return { ...DEFAULT_WEB_CONFIG };
  }
}

export function saveWebConfig(config: Partial<WebConfig>) {
  try {
    const current = loadWebConfig();
    const next: WebConfig = {
      searchProvider: config.searchProvider || current.searchProvider,
      fetchProvider: config.fetchProvider || current.fetchProvider,
      apiKeys: {
        ...current.apiKeys,
        ...(config.apiKeys || {}),
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
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
