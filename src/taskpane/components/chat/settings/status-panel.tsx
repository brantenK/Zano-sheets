import { Check, TriangleAlert } from "lucide-react";

interface StatusPanelProps {
  isConfigured: boolean;
  provider: string;
  authMethod: string;
  apiType: string;
  oauthReconnectRequired: boolean;
  providerHealth: { blocking: string[]; warnings: string[] };
  onFixConfig: () => void;
}

const providerLabel = (providerId: string): string => {
  if (providerId === "zai") return "Z.ai";
  if (providerId === "openrouter") return "OpenRouter";
  if (providerId === "openai-codex") return "OpenAI Codex";
  return providerId;
};

export function StatusPanel({
  isConfigured,
  provider,
  authMethod,
  apiType,
  oauthReconnectRequired,
  providerHealth,
  onFixConfig,
}: StatusPanelProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {providerHealth.blocking.length > 0 ? (
        <>
          <TriangleAlert size={12} className="text-(--chat-error)" />
          <span className="text-(--chat-error)">
            {providerHealth.blocking[0]}
          </span>
          <button
            type="button"
            onClick={onFixConfig}
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
            {provider === "custom"
              ? `custom (${apiType})`
              : providerLabel(provider)}
            {authMethod === "oauth" && " via OAuth"}
          </span>
        </>
      ) : (
        <span className="text-(--chat-text-muted)">
          Fill in all fields above to get started
        </span>
      )}
      {providerHealth.warnings.length > 0 && (
        <div className="mt-2 space-y-1 text-[10px] text-(--chat-warning)">
          {providerHealth.warnings.map((warning) => (
            <div key={warning}>- {warning}</div>
          ))}
        </div>
      )}
    </div>
  );
}
