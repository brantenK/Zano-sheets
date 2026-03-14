import { Check, Eye, EyeOff } from "lucide-react";
import { useCallback } from "react";

const inputStyle = { fontFamily: "inherit" };

interface ApiKeyManagerProps {
  provider: string;
  authMethod: string;
  apiKey: string;
  showKey: boolean;
  saveStatus: "idle" | "saving" | "saved";
  onApiKeyChange: (key: string) => void;
  onShowKeyToggle: () => void;
  onSaveApiKey: (key: string, notify: boolean) => void;
  onApiKeyBlur: () => void;
}

export function ApiKeyManager({
  provider,
  authMethod,
  apiKey,
  showKey,
  saveStatus,
  onApiKeyChange,
  onShowKeyToggle,
  onSaveApiKey,
  onApiKeyBlur,
}: ApiKeyManagerProps) {
  const showApiKeyInput = authMethod === "apikey";

  const handleSave = useCallback(() => {
    onSaveApiKey(apiKey, true);
  }, [apiKey, onSaveApiKey]);

  if (!showApiKeyInput) return null;

  return (
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
            onChange={(e) => onApiKeyChange(e.target.value)}
            onBlur={onApiKeyBlur}
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
            onClick={onShowKeyToggle}
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
      </label>

      {/* Manual Save Button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!provider || saveStatus === "saving"}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs
                   border transition-all
                   ${
                     saveStatus === "saved"
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
        ) : saveStatus === "saved" ? (
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
  );
}
