import type { Api, Model } from "@mariozechner/pi-ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  loadModelsForProvider,
  preloadProviderCatalog,
} from "../../../lib/chat/provider-catalog";
import type { CredentialStorageMode } from "../../../lib/credential-storage";
import {
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
  getPerfSummary,
} from "../../../lib/perf-telemetry";
import {
  clearStoredApiKeys,
  evaluateProviderConfig,
  loadApiKey,
  type ProviderConfig,
  saveApiKey,
  saveConfig,
  type ThinkingLevel,
} from "../../../lib/provider-config";
import {
  getStartupTelemetrySummary,
  markSettingsOpen,
} from "../../../lib/startup-telemetry";
import {
  clearStoredWebKeys,
  loadWebConfig,
  saveWebConfig,
} from "../../../lib/web/config";
import { listFetchProviders } from "../../../lib/web/fetch";
import { listSearchProviders } from "../../../lib/web/search";
import { useToast } from "../toast/toast-context";
import { useChat } from "./chat-context";
import { AdvancedSettings } from "./settings/advanced-settings";
import { ApiKeyManager } from "./settings/api-key-manager";
import { DiagnosticsPanel } from "./settings/diagnostics-panel";
import { KnowledgeBaseManager } from "./settings/knowledge-base-manager";
import { OAuthManager } from "./settings/oauth-manager";
import { PrivacyDataInfo } from "./settings/privacy-data-info";
import { ProviderSelector } from "./settings/provider-selector";
import { SkillsManagementPanel } from "./settings/SkillsManagementPanel";
import { StatusPanel } from "./settings/status-panel";
import { WebApiSettings } from "./settings/web-api-settings";

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

  // Provider config state from context
  const provider = state.providerConfig?.provider || "";
  const model = state.providerConfig?.model || "";
  const useProxyValue = state.providerConfig?.useProxy ?? false;
  const proxyUrlValue = state.providerConfig?.proxyUrl || "";
  const thinkingValue = state.providerConfig?.thinking || "none";
  const bashModeValue = state.providerConfig?.bashMode || "on-demand";
  const apiTypeValue = state.providerConfig?.apiType || "openai-completions";
  const customBaseUrlValue = state.providerConfig?.customBaseUrl || "";
  const authMethodValue = state.providerConfig?.authMethod || "apikey";

  // Knowledge base helpers
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

  // API key state
  const [apiKey, setApiKey] = useState(() => "");
  const [apiKeyChanged, setApiKeyChanged] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [showKey, setShowKey] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [models, setModels] = useState<Model<Api>[]>([]);

  // Refs for unmount flush
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
  const didResetRef = useRef(false);

  // Telemetry state
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

  // Web config state
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

  // Diagnostics state
  const [integrationTelemetry, setIntegrationTelemetry] = useState(
    loadIntegrationTelemetry,
  );
  const [perfSummary, setPerfSummary] = useState(getPerfSummary);
  const [startupSummary, setStartupSummary] = useState(
    getStartupTelemetrySummary,
  );

  // OAuth state
  const [oauthFlow, setOauthFlow] = useState<OAuthFlowState>({ step: "idle" });
  const [oauthCodeInput, setOauthCodeInput] = useState("");
  const [oauthCredentials, setOauthCredentials] = useState<Awaited<
    ReturnType<typeof loadOAuthCredentials>
  > | null>(null);

  // Sync refs with current values
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

  // Flush pending API key edits on unmount
  useEffect(() => {
    return () => {
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

  // Reload API key when provider changes
  useEffect(() => {
    if (authMethodValue === "apikey" && provider) {
      loadApiKey(provider).then((keyForProvider) => {
        setApiKey(keyForProvider);
        setApiKeyChanged(false);
        setSaveStatus(keyForProvider ? "saved" : "idle");
      });
    }
  }, [provider, authMethodValue]);

  // Setup diagnostics refresh
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

  // Setup provider catalog and models loading
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
    if (!provider || provider === "custom") {
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
  }, [provider]);

  // Load OAuth credentials
  useEffect(() => {
    if (authMethodValue === "oauth" && provider) {
      loadOAuthCredentials(provider).then(setOauthCredentials);
    } else {
      setOauthCredentials(null);
    }
  }, [authMethodValue, provider]);

  // Computed values
  const isCustom = provider === "custom";
  const hasOAuth = provider in OAUTH_PROVIDERS;
  const hasStoredOAuthCredentials = Boolean(oauthCredentials);
  const oauthReconnectRequired =
    hasOAuth && authMethodValue === "oauth" && !hasStoredOAuthCredentials;

  const providerHealth = useMemo(
    () =>
      state.providerConfig
        ? evaluateProviderConfig(state.providerConfig)
        : { blocking: [], warnings: [] },
    [state.providerConfig],
  );

  const followMode = state.providerConfig?.followMode ?? true;
  const isConfigured = state.providerConfig !== null;

  const searchProviders = listSearchProviders();
  const fetchProviders = listFetchProviders();
  const needsBraveKey = webSearchProvider === "brave";
  const needsSerperKey = webSearchProvider === "serper";
  const needsExaKey = webSearchProvider === "exa" || webFetchProvider === "exa";
  const hasManagedWebProvider = Boolean(
    braveApiKey || serperApiKey || exaApiKey,
  );
  const showDefaultSearchReliabilityWarning =
    webSearchProvider === "ddgs" && !hasManagedWebProvider;
  const showBasicFetchReliabilityWarning =
    webFetchProvider === "basic" && !exaApiKey;

  // Core sync function
  const updateAndSync = useCallback(
    (
      updates: Partial<{
        provider: string;
        apiKey: string;
        model: string;
        useProxy: boolean;
        proxyUrl: string;
        thinking: ThinkingLevel;
        bashMode: "on-demand" | "auto";
        apiType: string;
        customBaseUrl: string;
        authMethod: "apikey" | "oauth";
      }>,
    ) => {
      const p = updates.provider ?? provider;
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

      saveConfig(nextConfig);
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

  useEffect(() => {
    updateAndSyncRef.current = updateAndSync;
  }, [updateAndSync]);

  // Auto-save API key with debounce
  useEffect(() => {
    if (!apiKeyChanged || authMethodValue !== "apikey" || !provider) return;

    setSaveStatus("saving");
    const timeoutId = window.setTimeout(() => {
      saveApiKey(provider, apiKey);
      updateAndSyncRef.current?.({ apiKey });
      setSaveStatus(apiKey ? "saved" : "idle");
      setApiKeyChanged(false);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [apiKey, apiKeyChanged, authMethodValue, provider]);

  // Handler functions
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
        loadApiKey(provider).then((verifyKey) => {
          if (verifyKey) {
            showToast(
              "success",
              `API key saved for ${provider} (${verifyKey.length} chars)`,
              4000,
            );
          } else {
            showToast("error", `Failed to save API key for ${provider}`, 6000);
          }
        });
      }
    },
    [authMethodValue, provider, showToast, updateAndSync],
  );

  const handleProviderChange = async (newProvider: string) => {
    setOauthCodeInput("");
    setSaveStatus("idle");

    if (newProvider === "custom") {
      setModels([]);
      setOauthFlow({ step: "idle" });
      const customApiKey = await loadApiKey(newProvider);
      updateAndSync({
        provider: newProvider,
        model: "",
        authMethod: "apikey",
        apiKey: customApiKey,
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

    setModels(providerModels);

    if (nextAuthMethod === "oauth") {
      loadOAuthCredentials(newProvider).then((nextOauthCreds) => {
        setOauthFlow(nextOauthCreds ? { step: "connected" } : { step: "idle" });
        updateAndSync({
          provider: newProvider,
          model: nextModel,
          authMethod: nextAuthMethod,
          apiKey: nextOauthCreds?.access ?? "",
        });
      });
    } else {
      loadApiKey(newProvider).then((nextApiKey) => {
        setOauthFlow({ step: "idle" });
        updateAndSync({
          provider: newProvider,
          model: nextModel,
          authMethod: nextAuthMethod,
          apiKey: nextApiKey,
        });
      });
    }
  };

  const handleAuthMethodChange = (newMethod: "apikey" | "oauth") => {
    setOauthCodeInput("");

    if (newMethod === "oauth") {
      loadOAuthCredentials(provider).then((creds) => {
        if (creds) {
          setOauthFlow({ step: "connected" });
          updateAndSync({ authMethod: "oauth", apiKey: creds.access });
        } else {
          updateAndSync({ authMethod: "oauth", apiKey: "" });
          setOauthFlow({ step: "idle" });
        }
      });
      return;
    }

    loadApiKey(provider).then((savedApiKey) => {
      setOauthFlow({ step: "idle" });
      updateAndSync({ authMethod: "apikey", apiKey: savedApiKey });
    });
  };

  const fixProviderConfig = useCallback(() => {
    if (!provider || isCustom) {
      showToast(
        "error",
        "Auto-fix currently supports built-in providers only.",
        4000,
      );
      return;
    }

    if (models.length === 0) {
      showToast("error", `No models found for ${provider}.`, 4000);
      return;
    }

    const fallbackModel = models[0]?.id ?? "";
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
      const saveResult = await saveOAuthCredentials(provider, creds);
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
    removeOAuthCredentials(provider).then((removeResult) => {
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

      loadApiKey(provider).then((savedApiKey) => {
        setOauthCodeInput("");
        setOauthFlow({ step: "idle" });
        updateAndSync({ authMethod: "apikey", apiKey: savedApiKey });
      });
    });
  };

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
      saveOAuthCredentials(provider, oauthCredentials).catch(() => {});
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
      const nextBraveApiKey = updates.braveApiKey ?? braveApiKey;
      const nextSerperApiKey = updates.serperApiKey ?? serperApiKey;
      const nextExaApiKey = updates.exaApiKey ?? exaApiKey;
      const nextGeminiApiKey = updates.geminiApiKey ?? geminiApiKey;
      const hasManagedSearchKeys = Boolean(
        nextExaApiKey || nextBraveApiKey || nextSerperApiKey,
      );

      let nextSearchProvider = updates.searchProvider ?? webSearchProvider;
      if (!("searchProvider" in updates)) {
        const shouldPromoteSearch =
          webSearchProvider === "ddgs" && hasManagedSearchKeys;
        if (shouldPromoteSearch) {
          nextSearchProvider = nextExaApiKey
            ? "exa"
            : nextBraveApiKey
              ? "brave"
              : "serper";
        }
      }

      let nextFetchProvider = updates.fetchProvider ?? webFetchProvider;
      if (!("fetchProvider" in updates)) {
        const shouldPromoteFetch =
          webFetchProvider === "basic" && Boolean(nextExaApiKey);
        if (shouldPromoteFetch) {
          nextFetchProvider = "exa";
        }
      }

      if ("searchProvider" in updates) setWebSearchProvider(nextSearchProvider);
      if ("fetchProvider" in updates) setWebFetchProvider(nextFetchProvider);
      if (
        !("searchProvider" in updates) &&
        nextSearchProvider !== webSearchProvider
      ) {
        setWebSearchProvider(nextSearchProvider);
      }
      if (
        !("fetchProvider" in updates) &&
        nextFetchProvider !== webFetchProvider
      ) {
        setWebFetchProvider(nextFetchProvider);
      }
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

  const handleKbSelect = useCallback(
    async (files: File[]) => {
      await processKnowledgeBaseFiles(files);
    },
    [processKnowledgeBaseFiles],
  );

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
          <ProviderSelector
            provider={provider}
            model={model}
            apiType={apiTypeValue}
            customBaseUrl={customBaseUrlValue}
            isCustom={isCustom}
            availableProviders={availableProviders}
            models={models}
            onProviderChange={handleProviderChange}
            onModelChange={(m) => updateAndSync({ model: m })}
            onApiTypeChange={(at) => updateAndSync({ apiType: at })}
            onCustomBaseUrlChange={(url) =>
              updateAndSync({ customBaseUrl: url })
            }
            onFixConfig={fixProviderConfig}
            providerHealth={providerHealth}
          />

          <OAuthManager
            provider={provider}
            authMethod={authMethodValue}
            oauthFlow={oauthFlow}
            oauthCodeInput={oauthCodeInput}
            onAuthMethodChange={handleAuthMethodChange}
            onCodeInputChange={setOauthCodeInput}
            onStartOAuthLogin={startOAuthLogin}
            onExchangeCode={submitOAuthCode}
            onLogoutOAuth={logoutOAuth}
            onFlowStateChange={setOauthFlow}
          />

          <ApiKeyManager
            provider={provider}
            authMethod={authMethodValue}
            apiKey={apiKey}
            showKey={showKey}
            saveStatus={saveStatus}
            onApiKeyChange={(key) => {
              setApiKey(key);
              setSaveStatus("idle");
              if (key === "" && provider && authMethodValue === "apikey") {
                saveApiKey(provider, "");
                updateAndSync({ apiKey: "" });
              } else {
                setApiKeyChanged(true);
              }
            }}
            onShowKeyToggle={() => setShowKey(!showKey)}
            onSaveApiKey={persistApiKey}
            onApiKeyBlur={() => {
              if (apiKeyChanged) {
                persistApiKey(apiKey, false);
              }
            }}
          />

          <div className="border-t border-(--chat-border) pt-4">
            <AdvancedSettings
              thinkingValue={thinkingValue as ThinkingLevel}
              bashModeValue={bashModeValue}
              useProxyValue={useProxyValue}
              proxyUrlValue={proxyUrlValue}
              telemetryOptIn={telemetryOptIn}
              toolApprovalPrompt={toolApprovalPrompt}
              credentialStorageMode={credentialStorageMode}
              onThinkingChange={(level) => updateAndSync({ thinking: level })}
              onBashModeChange={(mode) => updateAndSync({ bashMode: mode })}
              onProxyToggle={() => updateAndSync({ useProxy: !useProxyValue })}
              onProxyUrlChange={(url) => updateAndSync({ proxyUrl: url })}
              onTelemetryToggle={toggleTelemetryOptIn}
              onToolApprovalToggle={toggleToolApprovalPrompt}
              onCredentialStorageModeToggle={toggleCredentialStorageMode}
            />
          </div>

          <div className="border-t border-(--chat-border) pt-4 space-y-4">
            <WebApiSettings
              webSearchProvider={webSearchProvider}
              webFetchProvider={webFetchProvider}
              braveApiKey={braveApiKey}
              serperApiKey={serperApiKey}
              exaApiKey={exaApiKey}
              geminiApiKey={geminiApiKey}
              searchProviders={searchProviders}
              fetchProviders={fetchProviders}
              needsBraveKey={needsBraveKey}
              needsSerperKey={needsSerperKey}
              needsExaKey={needsExaKey}
              showDefaultSearchReliabilityWarning={
                showDefaultSearchReliabilityWarning
              }
              showBasicFetchReliabilityWarning={
                showBasicFetchReliabilityWarning
              }
              onSearchProviderChange={(sp) =>
                updateWebSettings({ searchProvider: sp })
              }
              onFetchProviderChange={(fp) =>
                updateWebSettings({ fetchProvider: fp })
              }
              onBraveKeyChange={(key) =>
                updateWebSettings({ braveApiKey: key })
              }
              onSerperKeyChange={(key) =>
                updateWebSettings({ serperApiKey: key })
              }
              onExaKeyChange={(key) => updateWebSettings({ exaApiKey: key })}
              onGeminiKeyChange={(key) =>
                updateWebSettings({ geminiApiKey: key })
              }
            />

            <KnowledgeBaseManager
              files={state.knowledgeBaseUploads}
              countLabel={knowledgeBaseCountLabel}
              updatedLabel={knowledgeBaseUpdatedLabel}
              isUploading={state.isUploading}
              onFilesSelect={handleKbSelect}
              onFileRemove={handleRemoveKnowledgeBaseFile}
            />
          </div>
        </div>
      </div>

      <div className="border-t border-(--chat-border) pt-4">
        <StatusPanel
          isConfigured={isConfigured}
          provider={provider}
          authMethod={authMethodValue}
          apiType={apiTypeValue}
          oauthReconnectRequired={oauthReconnectRequired}
          providerHealth={providerHealth}
          onFixConfig={fixProviderConfig}
        />
        {providerHealth.warnings.length > 0 && (
          <div className="mt-2 space-y-1 text-[10px] text-(--chat-warning)">
            {providerHealth.warnings.map((warning) => (
              <div key={warning}>- {warning}</div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-(--chat-border) pt-4">
        <PrivacyDataInfo
          provider={provider}
          credentialStorageMode={credentialStorageMode}
        />
      </div>

      <div className="border-t border-(--chat-border) pt-4">
        <DiagnosticsPanel
          providerHealth={providerHealth}
          integrationTelemetry={integrationTelemetry}
          perfSummary={perfSummary}
          startupSummary={startupSummary}
          oauthReconnectRequired={oauthReconnectRequired}
          onResetIntegrationCounters={() => {
            clearIntegrationTelemetry();
            setIntegrationTelemetry(loadIntegrationTelemetry());
          }}
          onResetPerfTelemetry={() => {
            clearPerfTelemetry();
            setPerfSummary(getPerfSummary());
            setStartupSummary(getStartupTelemetrySummary());
          }}
        />
      </div>

      <SkillsManagementPanel />
    </div>
  );
}
