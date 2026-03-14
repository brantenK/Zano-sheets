import type { CredentialStorageMode } from "../../../../lib/credential-storage";
import {
  THINKING_LEVELS,
  type ThinkingLevel,
} from "../../../../lib/provider-config";

const inputStyle = { fontFamily: "inherit" };

interface AdvancedSettingsProps {
  thinkingValue: ThinkingLevel;
  bashModeValue: string;
  useProxyValue: boolean;
  proxyUrlValue: string;
  telemetryOptIn: boolean;
  toolApprovalPrompt: boolean;
  credentialStorageMode: CredentialStorageMode;
  onThinkingChange: (level: ThinkingLevel) => void;
  onBashModeChange: (mode: "on-demand" | "auto") => void;
  onProxyToggle: () => void;
  onProxyUrlChange: (url: string) => void;
  onTelemetryToggle: () => void;
  onToolApprovalToggle: () => void;
  onCredentialStorageModeToggle: () => void;
}

export function AdvancedSettings({
  thinkingValue,
  bashModeValue,
  useProxyValue,
  proxyUrlValue,
  telemetryOptIn,
  toolApprovalPrompt,
  credentialStorageMode,
  onThinkingChange,
  onBashModeChange,
  onProxyToggle,
  onProxyUrlChange,
  onTelemetryToggle,
  onToolApprovalToggle,
  onCredentialStorageModeToggle,
}: AdvancedSettingsProps) {
  return (
    <>
      {/* Thinking Level */}
      <div>
        <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
          Thinking Level
        </span>
        <div className="flex gap-1">
          {THINKING_LEVELS.map((level: (typeof THINKING_LEVELS)[number]) => (
            <button
              key={level.value}
              type="button"
              onClick={() => onThinkingChange(level.value)}
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

      {/* Bash Usage */}
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
              onClick={() => onBashModeChange(mode.value)}
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
          onClick={onProxyToggle}
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
            onChange={(e) => onProxyUrlChange(e.target.value)}
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

      {/* Privacy & Safety toggles */}
      <div className="space-y-3 text-xs text-(--chat-text-secondary)">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-(--chat-text-primary)">Usage telemetry</div>
            <div className="text-[10px] text-(--chat-text-muted)">
              Helps improve performance and reliability.{" "}
              <a
                href="https://github.com/brantenK/Zano-sheets#privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--chat-accent) hover:underline"
              >
                What we collect
              </a>
            </div>
          </div>
          <button
            type="button"
            onClick={onTelemetryToggle}
            className={`px-3 py-1.5 text-xs border transition-colors ${
              telemetryOptIn
                ? "border-(--chat-accent) text-(--chat-accent)"
                : "border-(--chat-border) text-(--chat-text-muted) hover:text-(--chat-text-primary) hover:border-(--chat-border-active)"
            }`}
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
              Ask once per request before tools that can modify your workbook
              run.
            </div>
          </div>
          <button
            type="button"
            onClick={onToolApprovalToggle}
            className={`px-3 py-1.5 text-xs border transition-colors ${
              toolApprovalPrompt
                ? "border-(--chat-accent) text-(--chat-accent)"
                : "border-(--chat-border) text-(--chat-text-muted) hover:text-(--chat-text-primary) hover:border-(--chat-border-active)"
            }`}
          >
            {toolApprovalPrompt ? "Prompt" : "Auto"}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-(--chat-text-primary)">Credential storage</div>
            <div className="text-[10px] text-(--chat-text-muted)">
              Store API keys and OAuth tokens on this device or only for this
              session.
            </div>
          </div>
          <button
            type="button"
            onClick={onCredentialStorageModeToggle}
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
    </>
  );
}
