import type { Api, Model } from "@mariozechner/pi-ai";
import { useCallback } from "react";
import { API_TYPES } from "../../../../lib/provider-config";

const inputStyle = { fontFamily: "inherit" };

interface ProviderSelectorProps {
  provider: string;
  model: string;
  apiType: string;
  customBaseUrl: string;
  isCustom: boolean;
  availableProviders: string[];
  models: Model<Api>[];
  onProviderChange: (provider: string) => Promise<void>;
  onModelChange: (model: string) => void;
  onApiTypeChange: (type: string) => void;
  onCustomBaseUrlChange: (url: string) => void;
  onFixConfig: () => void;
  providerHealth: { blocking: string[]; warnings: string[] };
}

const providerLabel = (providerId: string): string => {
  if (providerId === "zai") return "Z.ai";
  if (providerId === "openrouter") return "OpenRouter";
  if (providerId === "openai-codex") return "OpenAI Codex";
  return providerId;
};

export function ProviderSelector({
  provider,
  model,
  apiType,
  customBaseUrl,
  isCustom,
  availableProviders,
  models,
  onProviderChange,
  onModelChange,
  onApiTypeChange,
  onCustomBaseUrlChange,
  onFixConfig,
  providerHealth,
}: ProviderSelectorProps) {
  const handleProviderChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      await onProviderChange(e.target.value);
    },
    [onProviderChange],
  );

  return (
    <>
      <label className="block">
        <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
          Provider
        </span>
        <select
          value={provider}
          onChange={handleProviderChange}
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
              value={apiType}
              onChange={(e) => onApiTypeChange(e.target.value)}
              className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                         text-sm px-3 py-2 border border-(--chat-border)
                         focus:outline-none focus:border-(--chat-border-active)"
              style={inputStyle}
            >
              {API_TYPES.map((at: (typeof API_TYPES)[number]) => (
                <option key={at.id} value={at.id}>
                  {at.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-(--chat-text-muted) mt-1">
              {
                API_TYPES.find(
                  (at: (typeof API_TYPES)[number]) => at.id === apiType,
                )?.hint
              }
            </p>
          </label>

          {/* Base URL - hide for pre-configured providers like DeepSeek */}
          {apiType !== "deepseek" && (
            <label className="block">
              <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
                Base URL
              </span>
              <input
                type="text"
                value={customBaseUrl}
                onChange={(e) => onCustomBaseUrlChange(e.target.value)}
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
              onChange={(e) => onModelChange(e.target.value)}
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
                  <option value="deepseek-reasoner">deepseek-reasoner</option>
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
            onChange={(e) => onModelChange(e.target.value)}
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

      {/* Health status indicator */}
      {providerHealth.blocking.length > 0 && (
        <div className="text-[10px] text-(--chat-error) flex items-center gap-2">
          <span>{providerHealth.blocking[0]}</span>
          <button
            type="button"
            onClick={onFixConfig}
            className="px-2 py-0.5 border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors"
          >
            Fix now
          </button>
        </div>
      )}
    </>
  );
}
