import type { Api, Model } from "@mariozechner/pi-ai";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  LogOut,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadModelsForProvider,
  preloadProviderCatalog,
} from "../../../lib/chat/provider-catalog";
import {
  type CredentialStorageMode,
  getCredentialStorageMode,
  getLocalStorage,
  setCredentialStorageMode,
} from "../../../lib/credential-storage";
import {
  clearIntegrationTelemetry,
  loadIntegrationTelemetry,
} from "../../../lib/integration-telemetry";
import {
  buildAuthorizationUrl,
  clearAllOAuthCredentials,
  clearStoredOAuthCredentials,
  exchangeOAuthCode,
  generatePKCE,
  loadOAuthCredentials,
  OAUTH_PROVIDERS,
  type OAuthFlowState,
  removeOAuthCredentials,
  saveOAuthCredentials,
} from "../../../lib/oauth";
import {
  clearPerfTelemetry,
  exportPerfTelemetry,
  getPerfSummary,
} from "../../../lib/perf-telemetry";
import {
  API_TYPES,
  type BashMode,
  clearAllApiKeys,
  clearStoredApiKeys,
  evaluateProviderConfig,
  loadApiKey,
  type ProviderConfig,
  saveApiKey,
  saveConfig,
  THINKING_LEVELS,
  type ThinkingLevel,
} from "../../../lib/provider-config";
import {
  exportStartupTelemetry,
  getStartupTelemetrySummary,
  markSettingsOpen,
} from "../../../lib/startup-telemetry";
import {
  clearStoredWebKeys,
  clearWebConfig,
  loadWebConfig,
  saveWebConfig,
} from "../../../lib/web/config";
import { listFetchProviders } from "../../../lib/web/fetch";
import { listSearchProviders } from "../../../lib/web/search";
import { useToast } from "../toast/toast-context";
import { useChat } from "./chat-context";
import { SkillsManagementPanel } from "./settings/SkillsManagementPanel";

const TELEMETRY_OPT_IN_KEY = "zanosheets-telemetry-opt-in";
const TOOL_APPROVAL_KEY = "zanosheets-tool-approval";

export function SettingsPanel() {
  const {
    state,
    setProviderConfig,
    processKnowledgeBaseFiles,
    removeKnowledgeBaseFile,
  } = useChat();
  const { showToast } = useToast();
  const kbInputRef = useRef<HTMLInputElement>(null);

  const handleKbSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      await processKnowledgeBaseFiles(Array.from(files));
      if (kbInputRef.current) kbInputRef.current.value = "";
    },
    [processKnowledgeBaseFiles],
  );

  const handleRemoveKnowledgeBaseFile = useCallback(
    async (file: { name: string; displayName: string }) => {
      const ok = await removeKnowledgeBaseFile(file.name);
      if (ok) {
        showToast("success", `Removed ${file.displayName}`);
      } else {
        showToast("error", `Failed to remove ${file.displayName}`);
      }
    },
    [removeKnowledgeBaseFile, showToast],
  );

  // ALWAYS use provider from context - never local state
  // This prevents desync between what user selects and what gets saved
  const provider = state.providerConfig?.provider || "";
  const model = state.providerConfig?.model || "";
  const useProxyValue = state.providerConfig?.useProxy ?? true;
  const proxyUrlValue = state.providerConfig?.proxyUrl || "";
  const thinkingValue = state.providerConfig?.thinking || "none";
  const bashModeValue = state.providerConfig?.bashMode || "on-demand";
  const apiTypeValue = state.providerConfig?.apiType || "openai-completions";
  const customBaseUrlValue = state.providerConfig?.customBaseUrl || "";
  const authMethodValue = state.providerConfig?.authMethod || "apikey";
  const authMethod = authMethodValue;
  const apiType = apiTypeValue;
  const knowledgeBaseCount = state.knowledgeBaseUploads.length;
  const knowledgeBaseCountLabel =
    knowledgeBaseCount === 1 ? "1 file" : `${knowledgeBaseCount} files`;
  const knowledgeBaseLastUpdated = useMemo(() => {
    const timestamps = state.knowledgeBaseUploads
      .map((file) =>
        file.createTime ? Date.parse(file.createTime) : Number.NaN,
      )
      .filter((time) => !Number.isNaN(time));
    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
  }, [state.knowledgeBaseUploads]);

  const knowledgeBaseUpdatedLabel = useMemo(() => {
    if (!knowledgeBaseLastUpdated) return null;
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(knowledgeBaseLastUpdated);
  }, [knowledgeBaseLastUpdated]);

  // Local state only for UI controls (not provider identity)
  const [apiKey, setApiKey] = useState(() => ""); // Will be loaded by useEffect
  const [apiKeyChanged, setApiKeyChanged] = useState(false); // Track if key was modified
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [showKey, setShowKey] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [models, setModels] = useState<Model<Api>[]>([]);
  const apiKeyRef = useRef(apiKey);
  const apiKeyChangedRef = useRef(apiKeyChanged);
  const providerRef = useRef(provider);
  const authMethodRef = useRef(authMethodValue);
  const providerConfigRef = useRef(state.providerConfig);
  const updateAndSyncRef = useRef<
    ((u: Record<string, unknown>) => void) | null
  >(null);
  const setProviderConfigRef = useRef<((c: ProviderConfig) => void) | null>(
    null,
  );
  const [telemetryOptIn, setTelemetryOptIn] = useState(() => {
    try {
      return localStorage.getItem(TELEMETRY_OPT_IN_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [toolApprovalPrompt, setToolApprovalPrompt] = useState(() => {
    try {
      return localStorage.getItem(TOOL_APPROVAL_KEY) !== "auto";
    } catch {
      return true;
    }
  });

  const [credentialStorageMode, setCredentialStorageModeState] =
    useState<CredentialStorageMode>(() => getCredentialStorageMode());

  const toggleTelemetryOptIn = useCallback(() => {
    const next = !telemetryOptIn;
    setTelemetryOptIn(next);
    try {
      localStorage.setItem(TELEMETRY_OPT_IN_KEY, String(next));
    } catch {
      // ignore storage failures
    }
  }, [telemetryOptIn]);

  const toggleToolApprovalPrompt = useCallback(() => {
    const next = !toolApprovalPrompt;
    setToolApprovalPrompt(next);
    try {
      localStorage.setItem(TOOL_APPROVAL_KEY, next ? "prompt" : "auto");
    } catch {
      // ignore storage failures
    }
  }, [toolApprovalPrompt]);

  // Kill-switch: when true the unmount flush is suppressed because a full
  // reset just wiped storage; do not write anything back.
  const didResetRef = useRef(false);

  useEffect(() => {
    apiKeyRef.current = apiKey;
    apiKeyChangedRef.current = apiKeyChanged;
    providerRef.current = provider;
    authMethodRef.current = authMethodValue;
    providerConfigRef.current = state.providerConfig;
    setProviderConfigRef.current = setProviderConfig;
  }, [
    apiKey,
    apiKeyChanged,
    provider,
    authMethodValue,
    state.providerConfig,
    setProviderConfig,
  ]);

  // Flush pending API key edits on TRUE unmount only.
  // Uses [] deps so the cleanup never fires mid-lifecycle (which would run
  // with stale refs before the ref-sync effect updates them).
  useEffect(() => {
    return () => {
      // Kill-switch: a full reset just happened; do not write anything back.
      if (didResetRef.current) return;
      if (authMethodRef.current !== "apikey") return;
      if (!apiKeyChangedRef.current) return;

      const providerAtUnmount = providerRef.current;
      if (!providerAtUnmount) return;

      const keyAtUnmount = apiKeyRef.current;
      saveApiKey(providerAtUnmount, keyAtUnmount);

      const configAtUnmount = providerConfigRef.current;
      if (
        configAtUnmount &&
        configAtUnmount.provider === providerAtUnmount &&
        configAtUnmount.authMethod === "apikey"
      ) {
        const flushedConfig = { ...configAtUnmount, apiKey: keyAtUnmount };
        saveConfig(flushedConfig);
        setProviderConfigRef.current?.(flushedConfig);
      }
    };
  }, []);

  // Reload API key when provider changes (including on mount)
  useEffect(() => {
    if (authMethodValue === "apikey" && provider) {
      const keyForProvider = loadApiKey(provider);
      setApiKey(keyForProvider);
      setApiKeyChanged(false); // Reset changed status
      setSaveStatus(keyForProvider ? "saved" : "idle"); // Show saved if key exists
    }
  }, [provider, authMethodValue]);

  const [savedWeb] = useState(loadWebConfig);
  const [webSearchProvider, setWebSearchProvider] = useState(
    () => savedWeb.searchProvider,
  );
  const [webFetchProvider, setWebFetchProvider] = useState(
    () => savedWeb.fetchProvider,
  );
  const [braveApiKey, setBraveApiKey] = useState(
    () => savedWeb.apiKeys.brave || "",
  );
  const [serperApiKey, setSerperApiKey] = useState(
    () => savedWeb.apiKeys.serper || "",
  );
  const [exaApiKey, setExaApiKey] = useState(() => savedWeb.apiKeys.exa || "");
  const [geminiApiKey, setGeminiApiKey] = useState(
    () => savedWeb.apiKeys.gemini || "",
  );
  const [showAdvancedWebKeys, setShowAdvancedWebKeys] = useState(false);
  const [integrationTelemetry, setIntegrationTelemetry] = useState(
    loadIntegrationTelemetry,
  );
  const [perfSummary, setPerfSummary] = useState(getPerfSummary);
  const [startupSummary, setStartupSummary] = useState(
    getStartupTelemetrySummary,
  );

  useEffect(() => {
    markSettingsOpen();
    const refresh = () => {
      setIntegrationTelemetry(loadIntegrationTelemetry());
      setPerfSummary(getPerfSummary());
      setStartupSummary(getStartupTelemetrySummary());
    };
    refresh();
    const intervalId = window.setInterval(refresh, 4000);
    return () => window.clearInterval(intervalId);
  }, []);

  // OAuth flow state
  const [oauthFlow, setOauthFlow] = useState<OAuthFlowState>(() => {
    if (
      state.providerConfig?.authMethod === "oauth" &&
      state.providerConfig?.provider
    ) {
      const creds = loadOAuthCredentials(state.providerConfig.provider);
      return creds ? { step: "connected" } : { step: "idle" };
    }
    return { step: "idle" };
  });
  const [oauthCodeInput, setOauthCodeInput] = useState("");

  const followMode = state.providerConfig?.followMode ?? true;
  const isCustom = provider === "custom";
  const providerHealth = useMemo(
    () =>
      state.providerConfig
        ? evaluateProviderConfig(state.providerConfig)
        : { blocking: [], warnings: [] },
    [state.providerConfig],
  );

  const providerLabel = (providerId: string): string => {
    if (providerId === "zai") return "Z.ai";
    if (providerId === "openrouter") return "OpenRouter";
    if (providerId === "openai-codex") return "OpenAI Codex";
    return providerId;
  };

  const updateAndSync = useCallback(
    (
      updates: Partial<{
        provider: string;
        apiKey: string;
        model: string;
        useProxy: boolean;
        proxyUrl: string;
        thinking: ThinkingLevel;
        bashMode: BashMode;
        apiType: string;
        customBaseUrl: string;
        authMethod: "apikey" | "oauth";
      }>,
    ) => {
      const p = updates.provider ?? provider;
      // Use the provided API key OR the current in-memory key (via ref).
      // NEVER fall back to loadApiKey(p) here. Use the provided key or in-memory value.
      // and can re-inject a stale/cleared key when non-key settings change.
      const k =
        updates.apiKey !== undefined ? updates.apiKey : apiKeyRef.current;
      const m = updates.model ?? model;
      const up = updates.useProxy ?? useProxyValue;
      const pu = updates.proxyUrl ?? proxyUrlValue;
      const t = updates.thinking ?? thinkingValue;
      const bm = updates.bashMode ?? bashModeValue;
      const at = updates.apiType ?? apiTypeValue;
      const cb = updates.customBaseUrl ?? customBaseUrlValue;
      const am = updates.authMethod ?? authMethodValue;

      // Don't set local state for provider/model - they come from context now
      if ("apiKey" in updates) setApiKey(k);

      const nextConfig = {
        provider: p,
        apiKey: k,
        model: m,
        useProxy: up,
        proxyUrl: pu,
        thinking: t,
        followMode,
        bashMode: bm,
        apiType: at,
        customBaseUrl: cb,
        authMethod: am,
      };

      // Always persist provider/model/settings so remount sees the correct provider.
      // saveConfig strips the key from the main store; the key lives in the
      // per-provider store and is only written when non-empty.
      saveConfig(nextConfig);

      // Keep UI state and runtime state synced, while chat context decides
      // whether the config is ready to activate.
      setProviderConfig(nextConfig);
    },
    [
      provider,
      model,
      useProxyValue,
      proxyUrlValue,
      thinkingValue,
      bashModeValue,
      apiTypeValue,
      customBaseUrlValue,
      authMethodValue,
      followMode,
      setProviderConfig,
    ],
  );

  // Sync updateAndSync ref after it's declared (can't use it in the
  // earlier ref-sync effect because it's a block-scoped variable).
  useEffect(() => {
    updateAndSyncRef.current = updateAndSync;
  }, [updateAndSync]);

  useEffect(() => {
    if (!apiKeyChanged || authMethodValue !== "apikey" || !provider) return;

    setSaveStatus("saving");
    const timeoutId = window.setTimeout(() => {
      saveApiKey(provider, apiKey);
      // Use ref so changing model/followMode/proxy doesn't reset this timer
      updateAndSyncRef.current?.({ apiKey });
      setSaveStatus(apiKey ? "saved" : "idle");
      setApiKeyChanged(false);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [apiKey, apiKeyChanged, authMethodValue, provider]);

  useEffect(() => {
    let cancelled = false;

    preloadProviderCatalog()
      .then((providers) => {
        if (!cancelled) {
          setAvailableProviders(providers);
        }
      })
      .catch((err) => {
        console.error("[Settings] Failed to load provider catalog:", err);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!provider || isCustom) {
      setModels([]);
      return;
    }

    let cancelled = false;
    loadModelsForProvider(provider)
      .then((providerModels) => {
        if (!cancelled) {
          setModels(providerModels);
        }
      })
      .catch((err) => {
        console.error(`[Settings] Failed to load models for ${provider}:`, err);
        if (!cancelled) {
          setModels([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCustom, provider]);

  const hasOAuth = provider in OAUTH_PROVIDERS;
  const oauthCredentials =
    authMethodValue === "oauth" && provider
      ? loadOAuthCredentials(provider)
      : null;
  const hasStoredOAuthCredentials = Boolean(oauthCredentials);
  const oauthReconnectRequired =
    hasOAuth && authMethod === "oauth" && !hasStoredOAuthCredentials;
  const searchProviders = listSearchProviders();
  const fetchProviders = listFetchProviders();
  const needsBraveKey = webSearchProvider === "brave";
  const needsSerperKey = webSearchProvider === "serper";
  const needsExaKey = webSearchProvider === "exa" || webFetchProvider === "exa";
  const toggleCredentialStorageMode = useCallback(() => {
    const next: CredentialStorageMode =
      credentialStorageMode === "device" ? "session" : "device";
    setCredentialStorageMode(next);
    setCredentialStorageModeState(next);

    const deviceStorage = getLocalStorage();
    if (next === "session" && deviceStorage) {
      clearStoredApiKeys(deviceStorage);
      clearStoredOAuthCredentials(deviceStorage);
      clearStoredWebKeys(deviceStorage);
    }

    if (provider && authMethodValue === "apikey") {
      saveApiKey(provider, apiKey);
    }
    if (provider && authMethodValue === "oauth" && oauthCredentials) {
      saveOAuthCredentials(provider, oauthCredentials);
    }

    saveWebConfig({
      searchProvider: webSearchProvider,
      fetchProvider: webFetchProvider,
      apiKeys: {
        brave: braveApiKey,
        serper: serperApiKey,
        exa: exaApiKey,
        gemini: geminiApiKey,
      },
    });
  }, [
    authMethodValue,
    apiKey,
    braveApiKey,
    credentialStorageMode,
    exaApiKey,
    geminiApiKey,
    oauthCredentials,
    provider,
    serperApiKey,
    webFetchProvider,
    webSearchProvider,
  ]);
  const perfMetricRows = [
    ["taskpane_interactive_ms", "Taskpane interactive"],
    ["settings_open_ms", "Settings open"],
    ["first_prompt_send_ms", "First prompt send"],
    ["first_streamed_token_ms", "First streamed token"],
    ["bash_command_ms", "Bash command"],
    ["pdf_to_text_ms", "PDF to text"],
    ["pdf_to_images_ms", "PDF to images"],
    ["docx_to_text_ms", "DOCX to text"],
    ["xlsx_to_csv_ms", "XLSX to CSV"],
  ] as const;

  useEffect(() => {
    if (!provider || authMethodValue !== "oauth" || !hasOAuth) {
      if (oauthFlow.step !== "idle") {
        setOauthFlow({ step: "idle" });
      }
      return;
    }

    if (oauthFlow.step === "awaiting-code" || oauthFlow.step === "exchanging") {
      return;
    }

    if (oauthCredentials) {
      if (oauthFlow.step !== "connected") {
        setOauthFlow({ step: "connected" });
      }
      if (state.providerConfig?.apiKey !== oauthCredentials.access) {
        updateAndSync({ authMethod: "oauth", apiKey: oauthCredentials.access });
      }
      return;
    }

    if (state.providerConfig?.apiKey) {
      updateAndSync({ authMethod: "oauth", apiKey: "" });
    }

    if (oauthFlow.step === "connected") {
      setOauthFlow({
        step: "error",
        message: "OAuth session expired. Reconnect this provider in Settings.",
      });
      return;
    }

    if (oauthFlow.step !== "error") {
      setOauthFlow({ step: "idle" });
    }
  }, [
    authMethodValue,
    hasOAuth,
    oauthCredentials,
    oauthFlow.step,
    provider,
    state.providerConfig?.apiKey,
    updateAndSync,
  ]);

  const updateWebSettings = useCallback(
    (
      updates: Partial<{
        searchProvider: string;
        fetchProvider: string;
        braveApiKey: string;
        serperApiKey: string;
        exaApiKey: string;
        geminiApiKey: string;
      }>,
    ) => {
      const nextSearchProvider = updates.searchProvider ?? webSearchProvider;
      const nextFetchProvider = updates.fetchProvider ?? webFetchProvider;
      const nextBraveApiKey = updates.braveApiKey ?? braveApiKey;
      const nextSerperApiKey = updates.serperApiKey ?? serperApiKey;
      const nextExaApiKey = updates.exaApiKey ?? exaApiKey;
      const nextGeminiApiKey = updates.geminiApiKey ?? geminiApiKey;

      if ("searchProvider" in updates) setWebSearchProvider(nextSearchProvider);
      if ("fetchProvider" in updates) setWebFetchProvider(nextFetchProvider);
      if ("braveApiKey" in updates) setBraveApiKey(nextBraveApiKey);
      if ("serperApiKey" in updates) setSerperApiKey(nextSerperApiKey);
      if ("exaApiKey" in updates) setExaApiKey(nextExaApiKey);
      if ("geminiApiKey" in updates) setGeminiApiKey(nextGeminiApiKey);

      saveWebConfig({
        searchProvider: nextSearchProvider,
        fetchProvider: nextFetchProvider,
        apiKeys: {
          brave: nextBraveApiKey,
          serper: nextSerperApiKey,
          exa: nextExaApiKey,
          gemini: nextGeminiApiKey,
        },
      });
    },
    [
      webSearchProvider,
      webFetchProvider,
      braveApiKey,
      serperApiKey,
      exaApiKey,
      geminiApiKey,
    ],
  );

  const handleProviderChange = async (newProvider: string) => {
    setOauthCodeInput("");
    setSaveStatus("idle");

    if (newProvider === "custom") {
      setModels([]);
      setOauthFlow({ step: "idle" });
      updateAndSync({
        provider: newProvider,
        model: "",
        authMethod: "apikey",
        apiKey: loadApiKey(newProvider),
      });
      return;
    }

    const providerModels = newProvider
      ? await loadModelsForProvider(newProvider)
      : [];
    const currentModelStillValid = providerModels.some((m) => m.id === model);
    const nextModel = currentModelStillValid
      ? model
      : providerModels[0]?.id || "";
    const nextAuthMethod =
      newProvider in OAUTH_PROVIDERS ? authMethodValue : "apikey";
    const nextOauthCreds =
      nextAuthMethod === "oauth" ? loadOAuthCredentials(newProvider) : null;
    const nextApiKey =
      nextAuthMethod === "oauth"
        ? (nextOauthCreds?.access ?? "")
        : loadApiKey(newProvider);

    setModels(providerModels);
    setOauthFlow(
      nextAuthMethod === "oauth"
        ? nextOauthCreds
          ? { step: "connected" }
          : { step: "idle" }
        : { step: "idle" },
    );
    updateAndSync({
      provider: newProvider,
      model: nextModel,
      authMethod: nextAuthMethod,
      apiKey: nextApiKey,
    });
  };

  const handleAuthMethodChange = (newMethod: "apikey" | "oauth") => {
    setOauthCodeInput("");

    if (newMethod === "oauth") {
      const creds = loadOAuthCredentials(provider);
      if (creds) {
        setOauthFlow({ step: "connected" });
        updateAndSync({ authMethod: "oauth", apiKey: creds.access });
      } else {
        updateAndSync({ authMethod: "oauth", apiKey: "" });
        setOauthFlow({ step: "idle" });
      }
      return;
    }

    const savedApiKey = loadApiKey(provider);
    setOauthFlow({ step: "idle" });
    updateAndSync({ authMethod: "apikey", apiKey: savedApiKey });
  };

  const persistApiKey = useCallback(
    (keyToSave: string, notify = false) => {
      if (!provider || authMethodValue !== "apikey") {
        if (notify) {
          showToast("error", "Select an API-key provider before saving", 4000);
        }
        return;
      }

      setSaveStatus("saving");
      saveApiKey(provider, keyToSave);
      updateAndSync({ apiKey: keyToSave });
      setSaveStatus("saved");
      setApiKeyChanged(false);

      if (notify) {
        const verifyKey = loadApiKey(provider);
        if (verifyKey) {
          showToast(
            "success",
            `API key saved for ${provider} (${verifyKey.length} chars)`,
            4000,
          );
        } else {
          showToast("error", `Failed to save API key for ${provider}`, 6000);
        }
      }
    },
    [authMethodValue, provider, showToast, updateAndSync],
  );

  const fixProviderConfig = useCallback(() => {
    if (!provider || isCustom) {
      showToast(
        "error",
        "Auto-fix currently supports built-in providers only.",
        4000,
      );
      return;
    }

    const providerModels = models;
    if (providerModels.length === 0) {
      showToast("error", `No models found for ${provider}.`, 4000);
      return;
    }

    const fallbackModel = providerModels[0]?.id ?? "";
    if (!fallbackModel) {
      showToast(
        "error",
        `Could not determine a fallback model for ${provider}.`,
        4000,
      );
      return;
    }

    updateAndSync({ model: fallbackModel });
    showToast("success", `Updated model to ${fallbackModel}.`, 4000);
  }, [isCustom, models, provider, showToast, updateAndSync]);

  const startOAuthLogin = async () => {
    try {
      const { verifier, challenge } = await generatePKCE();
      const { url, oauthState } = buildAuthorizationUrl(
        provider,
        challenge,
        verifier,
      );
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (!popup) {
        throw new Error(
          "Browser blocked the login popup. Allow popups for this add-in and try again.",
        );
      }
      setOauthFlow({ step: "awaiting-code", verifier, oauthState });
    } catch (err) {
      setOauthFlow({
        step: "error",
        message: err instanceof Error ? err.message : "Failed to start OAuth",
      });
    }
  };

  const submitOAuthCode = async () => {
    if (oauthFlow.step !== "awaiting-code" || !oauthCodeInput.trim()) return;
    const { verifier } = oauthFlow;
    setOauthFlow({ step: "exchanging" });

    try {
      const creds = await exchangeOAuthCode({
        provider,
        rawInput: oauthCodeInput.trim(),
        verifier,
        expectedState: oauthFlow.oauthState,
        useProxy: useProxyValue,
        proxyUrl: proxyUrlValue,
      });
      const saveResult = saveOAuthCredentials(provider, creds);
      if (!saveResult.ok) {
        throw new Error(
          saveResult.error || "Failed to save OAuth credentials.",
        );
      }
      setOauthFlow({ step: "connected" });
      setOauthCodeInput("");
      updateAndSync({ apiKey: creds.access, authMethod: "oauth" });
    } catch (err) {
      setOauthFlow({
        step: "error",
        message: err instanceof Error ? err.message : "OAuth failed",
      });
    }
  };

  const logoutOAuth = () => {
    const removeResult = removeOAuthCredentials(provider);
    if (!removeResult.ok) {
      setOauthFlow({
        step: "error",
        message: removeResult.error || "Failed to remove OAuth credentials.",
      });
      showToast(
        "error",
        removeResult.error || "Failed to remove OAuth credentials.",
        6000,
      );
      return;
    }

    const savedApiKey = loadApiKey(provider);
    setOauthCodeInput("");
    setOauthFlow({ step: "idle" });
    updateAndSync({ authMethod: "apikey", apiKey: savedApiKey });
  };

  const isConfigured = state.providerConfig !== null;
  const showApiKeyInput = !(hasOAuth && authMethod === "oauth");

  const inputStyle = {
    borderRadius: "var(--chat-radius)",
    fontFamily: "var(--chat-font-mono)",
  };

  return (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-6"
      style={{ fontFamily: "var(--chat-font-mono)" }}
    >
      <div>
        <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted) mb-4">
          api configuration
        </div>

        <div className="space-y-4">
          {/* Provider */}
          <label className="block">
            <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
              Provider
            </span>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                         text-sm px-3 py-2 border border-(--chat-border)
                         focus:outline-none focus:border-(--chat-border-active)"
              style={inputStyle}
            >
              <option value="">Select provider...</option>
              {availableProviders.map((p) => (
                <option key={p} value={p}>
                  {providerLabel(p)}
                </option>
              ))}
              <option disabled>----------</option>
              <option value="custom">Custom Endpoint</option>
            </select>
          </label>
          {/* Custom Endpoint fields */}
          {isCustom && (
            <>
              <label className="block">
                <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                  API Type
                </span>
                <select
                  value={apiTypeValue}
                  onChange={(e) => updateAndSync({ apiType: e.target.value })}
                  className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                             text-sm px-3 py-2 border border-(--chat-border)
                             focus:outline-none focus:border-(--chat-border-active)"
                  style={inputStyle}
                >
                  {API_TYPES.map((at) => (
                    <option key={at.id} value={at.id}>
                      {at.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-(--chat-text-muted) mt-1">
                  {API_TYPES.find((at) => at.id === apiTypeValue)?.hint}
                </p>
              </label>

              {/* Base URL - hide for pre-configured providers like DeepSeek */}
              {apiTypeValue !== "deepseek" && (
                <label className="block">
                  <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                    Base URL
                  </span>
                  <input
                    type="text"
                    value={customBaseUrlValue}
                    onChange={(e) =>
                      updateAndSync({ customBaseUrl: e.target.value })
                    }
                    placeholder="https://api.openai.com/v1"
                    className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                               text-sm px-3 py-2 border border-(--chat-border)
                               placeholder:text-(--chat-text-muted)
                               focus:outline-none focus:border-(--chat-border-active)"
                    style={inputStyle}
                  />
                  <p className="text-[10px] text-(--chat-text-muted) mt-1">
                    The API endpoint URL for your provider
                  </p>
                </label>
              )}

              <label className="block">
                <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                  Model ID
                </span>
                <select
                  value={model}
                  onChange={(e) => updateAndSync({ model: e.target.value })}
                  className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                             text-sm px-3 py-2 border border-(--chat-border)
                             focus:outline-none focus:border-(--chat-border-active)"
                  style={inputStyle}
                >
                  <option value="">Select or enter model...</option>
                  {/* DeepSeek models */}
                  {apiType === "deepseek" && (
                    <>
                      <option value="deepseek-chat">deepseek-chat</option>
                      <option value="deepseek-reasoner">
                        deepseek-reasoner
                      </option>
                      <option value="deepseek-r1-0528">deepseek-r1-0528</option>
                      <option value="deepseek-v3.1-terminus">
                        deepseek-v3.1-terminus
                      </option>
                      <option value="deepseek-v3.2">deepseek-v3.2</option>
                    </>
                  )}
                  {/* Google models */}
                  {apiType === "google-generative-ai" && (
                    <>
                      <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                      <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                    </>
                  )}
                  {/* Show current value for other API types */}
                  {apiType !== "deepseek" &&
                    apiType !== "google-generative-ai" &&
                    model && <option value={model}>{model}</option>}
                </select>
                {apiType === "deepseek" && (
                  <p className="text-[10px] text-(--chat-text-muted) mt-1">
                    <a
                      href="https://platform.deepseek.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-(--chat-accent) hover:underline"
                    >
                      Get API Key
                    </a>
                  </p>
                )}
                {apiType === "google-generative-ai" && (
                  <p className="text-[10px] text-(--chat-text-muted) mt-1">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-(--chat-accent) hover:underline"
                    >
                      Get API Key
                    </a>
                  </p>
                )}
              </label>
            </>
          )}
          {/* Model dropdown for built-in providers only */}
          {!isCustom && provider && (
            <label className="block">
              <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                Model
              </span>
              <select
                value={model}
                onChange={(e) => updateAndSync({ model: e.target.value })}
                disabled={!provider}
                className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                           text-sm px-3 py-2 border border-(--chat-border)
                           focus:outline-none focus:border-(--chat-border-active)
                           disabled:opacity-50 disabled:cursor-not-allowed"
                style={inputStyle}
              >
                <option value="">Select model...</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* Auth method toggle for providers with OAuth support */}
          {hasOAuth && (
            <div>
              <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                Authentication
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleAuthMethodChange("apikey")}
                  className={`flex-1 py-1.5 text-xs border transition-colors ${
                    authMethod === "apikey"
                      ? "bg-(--chat-accent) border-(--chat-accent) text-white"
                      : "bg-(--chat-input-bg) border-(--chat-border) text-(--chat-text-secondary) hover:border-(--chat-border-active)"
                  }`}
                  style={{ borderRadius: "var(--chat-radius)" }}
                >
                  API Key
                </button>
                <button
                  type="button"
                  onClick={() => handleAuthMethodChange("oauth")}
                  className={`flex-1 py-1.5 text-xs border transition-colors ${
                    authMethod === "oauth"
                      ? "bg-(--chat-accent) border-(--chat-accent) text-white"
                      : "bg-(--chat-input-bg) border-(--chat-border) text-(--chat-text-secondary) hover:border-(--chat-border-active)"
                  }`}
                  style={{ borderRadius: "var(--chat-radius)" }}
                >
                  {OAUTH_PROVIDERS[provider]?.label ?? "OAuth"}
                </button>
              </div>
            </div>
          )}
          {/* OAuth flow for providers with OAuth support */}
          {/* OAuth flow for providers with OAuth support */}
          {hasOAuth && authMethod === "oauth" && (
            <div className="space-y-2">
              {oauthFlow.step === "idle" && (
                <button
                  type="button"
                  onClick={startOAuthLogin}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs
                             bg-(--chat-input-bg) border border-(--chat-border) text-(--chat-text-primary)
                             hover:border-(--chat-accent) hover:text-(--chat-accent) transition-colors"
                  style={{ borderRadius: "var(--chat-radius)" }}
                >
                  <ExternalLink size={12} />
                  {OAUTH_PROVIDERS[provider]?.buttonText ?? "Login"}
                </button>
              )}

              {oauthFlow.step === "awaiting-code" && (
                <div className="space-y-2">
                  <p className="text-[10px] text-(--chat-text-muted)">
                    {provider === "openai-codex"
                      ? "Complete login in the opened tab. The page will redirect to localhost and fail. Copy the full URL from your browser's address bar and paste it below:"
                      : "Authorize in the opened tab, then paste the code shown on the redirect page:"}
                  </p>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={oauthCodeInput}
                      onChange={(e) => setOauthCodeInput(e.target.value)}
                      placeholder={
                        provider === "openai-codex"
                          ? "Paste the full redirect URL here"
                          : "Paste code#state here"
                      }
                      className="flex-1 bg-(--chat-input-bg) text-(--chat-text-primary)
                                 text-sm px-3 py-2 border border-(--chat-border)
                                 placeholder:text-(--chat-text-muted)
                                 focus:outline-none focus:border-(--chat-border-active)"
                      style={inputStyle}
                      onKeyDown={(e) => e.key === "Enter" && submitOAuthCode()}
                    />
                    <button
                      type="button"
                      onClick={submitOAuthCode}
                      disabled={!oauthCodeInput.trim()}
                      className="px-3 py-2 text-xs bg-(--chat-accent) text-white border border-(--chat-accent)
                                 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{ borderRadius: "var(--chat-radius)" }}
                    >
                      Submit
                    </button>
                  </div>
                  <p className="text-[10px] text-(--chat-text-muted)">
                    Requires CORS proxy to be enabled for token exchange.
                  </p>
                </div>
              )}

              {oauthFlow.step === "exchanging" && (
                <div
                  className="px-3 py-2.5 text-xs text-(--chat-text-muted) bg-(--chat-input-bg) border border-(--chat-border)"
                  style={{ borderRadius: "var(--chat-radius)" }}
                >
                  Exchanging authorization code...
                </div>
              )}

              {oauthFlow.step === "connected" && (
                <div
                  className="flex items-center justify-between px-3 py-2.5 bg-(--chat-input-bg) border border-(--chat-border)"
                  style={{ borderRadius: "var(--chat-radius)" }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <Check size={12} className="text-(--chat-success)" />
                    <span className="text-(--chat-text-secondary)">
                      Connected via OAuth
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={logoutOAuth}
                    className="flex items-center gap-1 text-[10px] text-(--chat-text-muted) hover:text-(--chat-error) transition-colors"
                  >
                    <LogOut size={10} />
                    Logout
                  </button>
                </div>
              )}

              {oauthFlow.step === "error" && (
                <div className="space-y-2">
                  <div
                    className="px-3 py-2 text-xs text-(--chat-error) bg-(--chat-input-bg) border border-(--chat-error)/30"
                    style={{ borderRadius: "var(--chat-radius)" }}
                  >
                    {oauthFlow.message}
                  </div>
                  <button
                    type="button"
                    onClick={() => setOauthFlow({ step: "idle" })}
                    className="text-[10px] text-(--chat-text-muted) hover:text-(--chat-text-secondary) transition-colors"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}
          {/* API Key input hidden when using OAuth */}
          {showApiKeyInput && (
            <div className="space-y-2">
              <label className="block">
                <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                  API Key
                </span>
                <div className="relative">
                  <input
                    type="text"
                    autoComplete="off"
                    value={apiKey}
                    onChange={(e) => {
                      const nextKey = e.target.value;
                      setApiKey(nextKey);
                      setSaveStatus("idle");

                      if (
                        nextKey === "" &&
                        provider &&
                        authMethodValue === "apikey"
                      ) {
                        // Clear immediately; no debounce needed.
                        saveApiKey(provider, "");
                        updateAndSync({ apiKey: "" });
                        // apiKeyChanged stays false
                      } else {
                        setApiKeyChanged(true);
                      }
                    }}
                    onBlur={() => {
                      if (apiKeyChanged) {
                        persistApiKey(apiKey, false);
                      }
                    }}
                    placeholder="Enter your API key"
                    className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                               text-sm px-3 py-2 pr-10 border border-(--chat-border)
                               placeholder:text-(--chat-text-muted)
                               focus:outline-none focus:border-(--chat-border-active)"
                    style={
                      {
                        ...inputStyle,
                        WebkitTextSecurity: showKey ? "none" : "disc",
                      } as React.CSSProperties
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-(--chat-text-muted)
                               hover:text-(--chat-text-secondary)"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {provider === "zai" && (
                  <p className="text-[10px] text-(--chat-text-muted) mt-1">
                    Z.ai provider requires a platform API key. A web/app coding
                    subscription alone may not authorize API calls.
                  </p>
                )}
                {apiKeyChanged && (
                  <p className="text-[10px] text-(--chat-accent) mt-1">
                    API key modified - auto-saves when you leave this field
                  </p>
                )}
              </label>

              {/* Manual Save Button */}
              <button
                type="button"
                onClick={() => {
                  persistApiKey(apiKey, true);
                }}
                disabled={
                  !provider || !apiKeyChanged || saveStatus === "saving"
                }
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs
                           border transition-all
                           ${
                             saveStatus === "saved" && !apiKeyChanged
                               ? "bg-(--chat-border) border-(--chat-border) text-(--chat-text-muted) cursor-not-allowed"
                               : saveStatus === "saving"
                                 ? "bg-(--chat-border) border-(--chat-border) text-(--chat-text-muted) cursor-wait"
                                 : "bg-(--chat-accent) border-(--chat-accent) text-white hover:opacity-90"
                           }`}
                style={{ borderRadius: "var(--chat-radius)" }}
              >
                {saveStatus === "saving" ? (
                  <>
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : saveStatus === "saved" && !apiKeyChanged ? (
                  <>
                    <Check size={12} />
                    Saved
                  </>
                ) : (
                  <>
                    <Check size={12} />
                    Save API Key
                  </>
                )}
              </button>
            </div>
          )}
          {/* CORS Proxy */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-(--chat-text-secondary)">
                CORS Proxy
              </span>
              <p className="text-[10px] text-(--chat-text-muted) mt-0.5">
                Required for Anthropic and some providers
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateAndSync({ useProxy: !useProxyValue })}
              className={`
                w-10 h-5 rounded-full transition-colors relative
                ${useProxyValue ? "bg-(--chat-accent)" : "bg-(--chat-border)"}
              `}
            >
              <span
                className={`
                  absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform
                  ${useProxyValue ? "left-5" : "left-0.5"}
                `}
              />
            </button>
          </div>
          {useProxyValue && (
            <label className="block">
              <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                Proxy URL
              </span>
              <input
                type="text"
                value={proxyUrlValue}
                onChange={(e) => updateAndSync({ proxyUrl: e.target.value })}
                placeholder="https://your-proxy.com/proxy"
                className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                           text-sm px-3 py-2 border border-(--chat-border)
                           placeholder:text-(--chat-text-muted)
                           focus:outline-none focus:border-(--chat-border-active)"
                style={inputStyle}
              />
              <p className="text-[10px] text-(--chat-text-muted) mt-1">
                Your proxy should accept ?url=encoded_url format
              </p>
            </label>
          )}
          {/* Thinking Level */}
          <div>
            <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
              Thinking Level
            </span>
            <div className="flex gap-1">
              {THINKING_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => updateAndSync({ thinking: level.value })}
                  className={`
                    flex-1 py-1.5 text-xs border transition-colors
                    ${
                      thinkingValue === level.value
                        ? "bg-(--chat-accent) border-(--chat-accent) text-white"
                        : "bg-(--chat-input-bg) border-(--chat-border) text-(--chat-text-secondary) hover:border-(--chat-border-active)"
                    }
                  `}
                  style={{ borderRadius: "var(--chat-radius)" }}
                >
                  {level.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-(--chat-text-muted) mt-1">
              Extended thinking for supported models
            </p>
          </div>
          <div>
            <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
              Bash Usage
            </span>
            <div className="grid grid-cols-2 gap-1">
              {[
                {
                  value: "on-demand" as const,
                  label: "On Demand",
                  hint: "Only when you explicitly ask for shell-style work",
                },
                {
                  value: "auto" as const,
                  label: "Automatic",
                  hint: "Model may use bash whenever it helps",
                },
              ].map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => updateAndSync({ bashMode: mode.value })}
                  className={`
                    px-3 py-2 text-xs border text-left transition-colors
                    ${
                      bashModeValue === mode.value
                        ? "bg-(--chat-accent) border-(--chat-accent) text-white"
                        : "bg-(--chat-input-bg) border-(--chat-border) text-(--chat-text-secondary) hover:border-(--chat-border-active)"
                    }
                  `}
                  style={{ borderRadius: "var(--chat-radius)" }}
                >
                  <div>{mode.label}</div>
                  <div className="mt-1 text-[10px] opacity-80">{mode.hint}</div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-(--chat-text-muted) mt-1">
              Safer default for performance. Bash stays available, but the model
              will avoid it unless needed.
            </p>
          </div>
          <div className="border-t border-(--chat-border) pt-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted)">
              web tools
            </div>

            <label className="block">
              <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                Default Search Provider
              </span>
              <select
                value={webSearchProvider}
                onChange={(e) =>
                  updateWebSettings({ searchProvider: e.target.value })
                }
                className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                           text-sm px-3 py-2 border border-(--chat-border)
                           focus:outline-none focus:border-(--chat-border-active)"
                style={inputStyle}
              >
                {searchProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-(--chat-text-muted) mt-1">
                Used by web-search.
              </p>
            </label>

            <label className="block">
              <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                Default Fetch Provider
              </span>
              <select
                value={webFetchProvider}
                onChange={(e) =>
                  updateWebSettings({ fetchProvider: e.target.value })
                }
                className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                           text-sm px-3 py-2 border border-(--chat-border)
                           focus:outline-none focus:border-(--chat-border-active)"
                style={inputStyle}
              >
                {fetchProviders.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-(--chat-text-muted) mt-1">
                Used by web-fetch.
              </p>
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted)">
                  knowledge base
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-(--chat-text-muted)">
                  <span className="px-2 py-0.5 border border-(--chat-border) bg-(--chat-bg)">
                    {knowledgeBaseCountLabel}
                  </span>
                  {knowledgeBaseUpdatedLabel && (
                    <span className="px-2 py-0.5 border border-(--chat-border) bg-(--chat-bg)">
                      Updated {knowledgeBaseUpdatedLabel}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={kbInputRef}
                  type="file"
                  multiple
                  onChange={handleKbSelect}
                  className="hidden"
                  accept=".pdf,.txt,.docx,.md,.csv,.json,.xml"
                />
                <button
                  type="button"
                  onClick={() => kbInputRef.current?.click()}
                  className="px-3 py-2 text-xs bg-(--chat-input-bg) border border-(--chat-border) text-(--chat-text-primary) hover:border-(--chat-border-active)"
                  style={{ borderRadius: "var(--chat-radius)" }}
                >
                  Upload to Knowledge Base
                </button>
                {state.isUploading && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-(--chat-text-muted)">
                    <span className="h-2 w-2 rounded-full bg-(--chat-accent) animate-pulse" />
                    Uploading...
                  </span>
                )}
              </div>
              {state.knowledgeBaseUploads.length > 0 ? (
                <div className="space-y-1">
                  {state.knowledgeBaseUploads.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between text-[11px] px-2 py-1 bg-(--chat-bg) border border-(--chat-border)"
                      style={{ borderRadius: "var(--chat-radius)" }}
                    >
                      <span className="truncate" title={file.displayName}>
                        {file.displayName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKnowledgeBaseFile(file)}
                        className="text-(--chat-error) text-[10px] hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-(--chat-text-muted)">
                  No knowledge base files yet.
                </p>
              )}
            </div>

            {needsBraveKey && (
              <label className="block">
                <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                  Brave API Key
                </span>
                <input
                  type="password"
                  value={braveApiKey}
                  onChange={(e) =>
                    updateWebSettings({ braveApiKey: e.target.value })
                  }
                  placeholder="Required for Brave search"
                  className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                           text-sm px-3 py-2 border border-(--chat-border)
                           placeholder:text-(--chat-text-muted)
                           focus:outline-none focus:border-(--chat-border-active)"
                  style={inputStyle}
                />
              </label>
            )}

            {needsSerperKey && (
              <label className="block">
                <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                  Serper API Key
                </span>
                <input
                  type="password"
                  value={serperApiKey}
                  onChange={(e) =>
                    updateWebSettings({ serperApiKey: e.target.value })
                  }
                  placeholder="Required for Serper search"
                  className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                           text-sm px-3 py-2 border border-(--chat-border)
                           placeholder:text-(--chat-text-muted)
                           focus:outline-none focus:border-(--chat-border-active)"
                  style={inputStyle}
                />
              </label>
            )}

            {needsExaKey && (
              <label className="block">
                <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                  Exa API Key
                </span>
                <input
                  type="password"
                  value={exaApiKey}
                  onChange={(e) =>
                    updateWebSettings({ exaApiKey: e.target.value })
                  }
                  placeholder="Required for Exa search/fetch"
                  className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                           text-sm px-3 py-2 border border-(--chat-border)
                           placeholder:text-(--chat-text-muted)
                           focus:outline-none focus:border-(--chat-border-active)"
                  style={inputStyle}
                />
              </label>
            )}

            <label className="block mt-4 pt-4 border-t border-(--chat-border)">
              <span className="block text-xs text-(--chat-text-secondary) mb-1.5 flex items-center justify-between">
                <span>Gemini API Key Override</span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-(--chat-accent) hover:underline"
                >
                  Get Key
                </a>
              </span>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) =>
                  updateWebSettings({ geminiApiKey: e.target.value })
                }
                placeholder="Optional if Google is not your active chat provider"
                className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                       text-sm px-3 py-2 border border-(--chat-border)
                       placeholder:text-(--chat-text-muted)
                       focus:outline-none focus:border-(--chat-border-active)"
                style={inputStyle}
              />
              <span className="mt-1 block text-[10px] text-(--chat-text-muted)">
                Knowledge Base uploads use your active Google provider config
                first and only fall back to this override key.
              </span>
            </label>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowAdvancedWebKeys(!showAdvancedWebKeys)}
                className="inline-flex items-center gap-1.5 text-xs text-(--chat-text-secondary) hover:text-(--chat-text-primary)"
              >
                {showAdvancedWebKeys ? (
                  <ChevronUp size={12} />
                ) : (
                  <ChevronDown size={12} />
                )}
                <span>
                  {showAdvancedWebKeys ? "Hide" : "Show"} advanced saved API
                  keys
                </span>
              </button>
            </div>

            {showAdvancedWebKeys && (
              <div className="space-y-3 border border-(--chat-border) p-3 bg-(--chat-input-bg)">
                {!needsBraveKey && (
                  <label className="block">
                    <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                      Brave API Key
                    </span>
                    <input
                      type="password"
                      value={braveApiKey}
                      onChange={(e) =>
                        updateWebSettings({ braveApiKey: e.target.value })
                      }
                      placeholder="Optional"
                      className="w-full bg-(--chat-bg) text-(--chat-text-primary)
                         text-sm px-3 py-2 border border-(--chat-border)
                         placeholder:text-(--chat-text-muted)
                         focus:outline-none focus:border-(--chat-border-active)"
                      style={inputStyle}
                    />
                  </label>
                )}

                {!needsSerperKey && (
                  <label className="block">
                    <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                      Serper API Key
                    </span>
                    <input
                      type="password"
                      value={serperApiKey}
                      onChange={(e) =>
                        updateWebSettings({ serperApiKey: e.target.value })
                      }
                      placeholder="Optional"
                      className="w-full bg-(--chat-bg) text-(--chat-text-primary)
                         text-sm px-3 py-2 border border-(--chat-border)
                         placeholder:text-(--chat-text-muted)
                         focus:outline-none focus:border-(--chat-border-active)"
                      style={inputStyle}
                    />
                  </label>
                )}

                {!needsExaKey && (
                  <label className="block">
                    <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                      Exa API Key
                    </span>
                    <input
                      type="password"
                      value={exaApiKey}
                      onChange={(e) =>
                        updateWebSettings({ exaApiKey: e.target.value })
                      }
                      placeholder="Optional"
                      className="w-full bg-(--chat-bg) text-(--chat-text-primary)
                         text-sm px-3 py-2 border border-(--chat-border)
                         placeholder:text-(--chat-text-muted)
                         focus:outline-none focus:border-(--chat-border-active)"
                      style={inputStyle}
                    />
                  </label>
                )}
              </div>
            )}
          </div>{" "}
        </div>
      </div>

      {/* Status */}
      <div className="border-t border-(--chat-border) pt-4">
        <div className="flex items-center gap-2 text-xs">
          {providerHealth.blocking.length > 0 ? (
            <>
              <TriangleAlert size={12} className="text-(--chat-error)" />
              <span className="text-(--chat-error)">
                {providerHealth.blocking[0]}
              </span>
              <button
                type="button"
                onClick={fixProviderConfig}
                className="ml-2 px-2 py-0.5 text-[10px] border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors"
              >
                Fix now
              </button>
            </>
          ) : oauthReconnectRequired ? (
            <>
              <TriangleAlert size={12} className="text-(--chat-warning)" />
              <span className="text-(--chat-warning)">
                OAuth session expired. Reconnect this provider in Settings.
              </span>
            </>
          ) : isConfigured ? (
            <>
              <Check size={12} className="text-(--chat-success)" />
              <span className="text-(--chat-text-secondary)">
                Using{" "}
                {state.providerConfig?.provider === "custom"
                  ? `custom (${state.providerConfig?.apiType})`
                  : state.providerConfig?.provider}
                {state.providerConfig?.authMethod === "oauth" && " via OAuth"}
              </span>
            </>
          ) : (
            <span className="text-(--chat-text-muted)">
              Fill in all fields above to get started
            </span>
          )}
        </div>
        {providerHealth.warnings.length > 0 && (
          <div className="mt-2 space-y-1 text-[10px] text-(--chat-warning)">
            {providerHealth.warnings.map((warning) => (
              <div key={warning}>- {warning}</div>
            ))}
          </div>
        )}
      </div>
      {/* Privacy & Safety */}
      <div className="border-t border-(--chat-border) pt-4">
        <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted) mb-2">
          privacy & safety
        </div>
        <div className="space-y-3 text-xs text-(--chat-text-secondary)">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-(--chat-text-primary)">Usage telemetry</div>
              <div className="text-[10px] text-(--chat-text-muted)">
                Sends error and performance data to improve the add-in. Requires
                reload.
              </div>
            </div>
            <button
              type="button"
              onClick={toggleTelemetryOptIn}
              className={`px-3 py-1.5 text-xs border transition-colors $
                {telemetryOptIn
                  ? "border-(--chat-accent) text-(--chat-accent)"
                  : "border-(--chat-border) text-(--chat-text-muted) hover:text-(--chat-text-primary) hover:border-(--chat-border-active)"}`}
            >
              {telemetryOptIn ? "On" : "Off"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-(--chat-text-primary)">
                Confirm tool writes
              </div>
              <div className="text-[10px] text-(--chat-text-muted)">
                Ask before tools that can modify your workbook run.
              </div>
            </div>
            <button
              type="button"
              onClick={toggleToolApprovalPrompt}
              className={`px-3 py-1.5 text-xs border transition-colors $
                {toolApprovalPrompt
                  ? "border-(--chat-accent) text-(--chat-accent)"
                  : "border-(--chat-border) text-(--chat-text-muted) hover:text-(--chat-text-primary) hover:border-(--chat-border-active)"}`}
            >
              {toolApprovalPrompt ? "Prompt" : "Auto"}
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-(--chat-text-primary)">
                Credential storage
              </div>
              <div className="text-[10px] text-(--chat-text-muted)">
                Store API keys and OAuth tokens on this device or only for this
                session.
              </div>
            </div>
            <button
              type="button"
              onClick={toggleCredentialStorageMode}
              className={`px-3 py-1.5 text-xs border transition-colors ${
                credentialStorageMode === "device"
                  ? "border-(--chat-accent) text-(--chat-accent)"
                  : "border-(--chat-border) text-(--chat-text-muted) hover:text-(--chat-text-primary) hover:border-(--chat-border-active)"
              }`}
            >
              {credentialStorageMode === "device" ? "Device" : "Session"}
            </button>
          </div>
        </div>
      </div>

      {/* Integration Diagnostics */}
      <div className="border-t border-(--chat-border) pt-4">
        <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted) mb-2">
          integration diagnostics
        </div>
        <div className="text-xs text-(--chat-text-secondary) space-y-1">
          <div>Config blocking issues: {providerHealth.blocking.length}</div>
          <div>Config warnings: {providerHealth.warnings.length}</div>
          <div>
            OAuth refresh retries:{" "}
            {integrationTelemetry.counters.oauth_refresh_retry}
          </div>
          <div>
            OAuth credentials stored: {hasStoredOAuthCredentials ? "yes" : "no"}
          </div>
          <div>
            Transient retries: {integrationTelemetry.counters.transient_retry}
          </div>
          <div>
            Final provider errors:{" "}
            {integrationTelemetry.counters.provider_final_error}
          </div>
          <div>
            Send message errors:{" "}
            {integrationTelemetry.counters.send_message_error}
          </div>
          <div className="text-(--chat-text-muted)">
            Last updated:{" "}
            {integrationTelemetry.updatedAt
              ? new Date(integrationTelemetry.updatedAt).toLocaleString()
              : "never"}
          </div>
          <div className="text-(--chat-text-muted) break-all">
            Status counts: {JSON.stringify(integrationTelemetry.statusCounts)}
          </div>
          <div className="pt-2 text-(--chat-text-primary)">
            Performance telemetry
          </div>
          {perfMetricRows.map(([metricKey, label]) => {
            const stats = perfSummary.metrics[metricKey];
            return (
              <div key={metricKey}>
                {label}: count {stats.count}, avg {stats.avg}ms, p95 {stats.p95}
                ms, last {stats.last}ms
              </div>
            );
          })}
          <div className="text-(--chat-text-muted)">
            Startup phases: {JSON.stringify(startupSummary.phases)}
          </div>
          {oauthReconnectRequired && (
            <div className="text-(--chat-warning)">
              Reconnect required: stored OAuth credentials are missing for the
              selected provider.
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              clearIntegrationTelemetry();
              setIntegrationTelemetry(loadIntegrationTelemetry());
            }}
            className="px-3 py-1.5 text-xs border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors"
          >
            Reset integration counters
          </button>
          <button
            type="button"
            onClick={() => {
              clearPerfTelemetry();
              setPerfSummary(getPerfSummary());
              setStartupSummary(getStartupTelemetrySummary());
            }}
            className="px-3 py-1.5 text-xs border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors"
          >
            Reset perf counters
          </button>
          <button
            type="button"
            onClick={() => {
              const snapshot = JSON.stringify(
                {
                  integrationTelemetry,
                  perfTelemetry: JSON.parse(exportPerfTelemetry()),
                  startupTelemetry: JSON.parse(exportStartupTelemetry()),
                },
                null,
                2,
              );
              navigator.clipboard
                .writeText(snapshot)
                .then(() => {
                  showToast("success", "Diagnostics snapshot copied", 2500);
                })
                .catch(() => {
                  showToast(
                    "error",
                    "Failed to copy diagnostics snapshot",
                    4000,
                  );
                });
            }}
            className="px-3 py-1.5 text-xs border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors"
          >
            Copy diagnostics snapshot
          </button>
        </div>
      </div>

      {/* Skills */}
      <div className="border-t border-(--chat-border) pt-4">
        <SkillsManagementPanel />
      </div>

      {/* About */}
      <div className="border-t border-(--chat-border) pt-4">
        <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted) mb-2">
          about
        </div>
        <p className="text-xs text-(--chat-text-secondary) leading-relaxed">
          OpenExcel uses your own API key to connect to LLM providers. Your key
          is stored locally in the browser.
        </p>
        {isCustom && (
          <p className="text-xs text-(--chat-text-muted) leading-relaxed mt-2">
            Custom Endpoint: Point to any OpenAI-compatible API (Ollama, vLLM,
            LMStudio) or other supported API types.
          </p>
        )}
        {useProxyValue && (
          <p className="text-xs text-(--chat-text-muted) leading-relaxed mt-2">
            CORS Proxy: Requests route through your proxy to bypass browser CORS
            restrictions. Required for Claude OAuth and some providers.
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            // Arm the kill-switch FIRST so a subsequent unmount (tab switch)
            // will never flush stale values back to storage.
            didResetRef.current = true;
            apiKeyChangedRef.current = false;

            // Explicitly wipe the current provider key before the bulk clear
            // in case an onBlur race re-wrote it just before this click.
            if (provider) saveApiKey(provider, "");

            clearAllApiKeys();
            clearAllOAuthCredentials();
            clearWebConfig();
            // Reset by calling updateAndSync with empty values
            updateAndSync({
              provider: "",
              apiKey: "",
              model: "",
              authMethod: "apikey",
              useProxy: true,
              proxyUrl: "",
              thinking: "none",
              bashMode: "on-demand",
              apiType: "openai-completions",
              customBaseUrl: "",
            });
            setOauthFlow({ step: "idle" });
            setApiKey("");
            setApiKeyChanged(false);
            setSaveStatus("idle");
            setBraveApiKey("");
            setSerperApiKey("");
            setExaApiKey("");
          }}
          className="mt-3 px-3 py-1.5 text-xs border border-(--chat-error) text-(--chat-error) hover:bg-(--chat-error) hover:text-(--chat-bg) transition-colors"
        >
          Clear all saved keys &amp; reset
        </button>
        <p className="text-[10px] text-(--chat-text-muted) mt-3">
          v{__APP_VERSION__}
        </p>
      </div>
    </div>
  );
}
