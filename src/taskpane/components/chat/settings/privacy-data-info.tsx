import { ExternalLink } from "lucide-react";
import type { CredentialStorageMode } from "../../../../lib/credential-storage";

interface PrivacyDataInfoProps {
  provider: string;
  credentialStorageMode: CredentialStorageMode;
  onProviderPolicyClick?: (url: string) => void;
}

const getProviderPrivacyUrl = (provider: string): string => {
  const urls: Record<string, string> = {
    anthropic: "https://www.anthropic.com/privacy",
    openai: "https://openai.com/privacy",
    gemini: "https://policies.google.com/privacy",
    claude: "https://www.anthropic.com/privacy",
    gpt: "https://openai.com/privacy",
  };
  return urls[provider] || `https://${provider}.com/privacy`;
};

export function PrivacyDataInfo({
  provider,
  credentialStorageMode,
}: PrivacyDataInfoProps) {
  return (
    <>
      <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted) mb-3">
        privacy & data
      </div>

      <div className="space-y-3">
        {/* Data handling explanation */}
        <div className="p-3 bg-(--chat-success)/5 rounded border border-(--chat-success)/20">
          <div className="flex items-start gap-2">
            <div className="text-(--chat-success) mt-0.5">🔒</div>
            <div className="flex-1">
              <p className="text-xs font-medium text-(--chat-text-primary) mb-1">
                Your data stays in Excel
              </p>
              <p className="text-[10px] text-(--chat-text-muted) leading-relaxed">
                Workbook data remains local. Only prompts and context are sent
                to your AI provider.
              </p>
            </div>
          </div>
        </div>

        {/* API Key storage indicator */}
        <div className="flex items-center justify-between p-3 bg-(--chat-bg-secondary) rounded border border-(--chat-border)">
          <div className="flex items-center gap-2">
            <div className="text-(--chat-text-secondary)">🔑</div>
            <div>
              <p className="text-xs text-(--chat-text-primary)">
                API Key Storage
              </p>
              <p className="text-[10px] text-(--chat-text-muted)">
                {credentialStorageMode === "device"
                  ? "Stored locally on this device"
                  : "Stored for this session only"}
              </p>
            </div>
          </div>
          <div className="text-[10px] text-(--chat-text-muted) uppercase tracking-wider">
            {credentialStorageMode === "device" ? "Local" : "Session"}
          </div>
        </div>

        {/* Provider privacy policy link */}
        {provider && (
          <div className="flex items-center justify-between p-3 bg-(--chat-bg-secondary) rounded border border-(--chat-border)">
            <div className="flex items-center gap-2">
              <div className="text-(--chat-text-secondary)">📋</div>
              <div>
                <p className="text-xs text-(--chat-text-primary)">
                  Using: {provider}
                </p>
                <p className="text-[10px] text-(--chat-text-muted)">
                  Review their privacy policy
                </p>
              </div>
            </div>
            <a
              href={getProviderPrivacyUrl(provider)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-(--chat-accent) hover:underline flex items-center gap-1"
            >
              View Policy
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        {/* Help & support */}
        <div className="pt-2 space-y-2">
          <p className="text-xs text-(--chat-text-secondary)">
            <strong className="text-(--chat-text-primary)">
              Help & Support:
            </strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://github.com/brantenK/Zano-sheets/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] px-2 py-1 bg-(--chat-bg) border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors rounded flex items-center gap-1"
            >
              Report Issue
              <ExternalLink size={10} />
            </a>
            <a
              href="https://github.com/brantenK/Zano-sheets#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] px-2 py-1 bg-(--chat-bg) border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors rounded flex items-center gap-1"
            >
              Documentation
              <ExternalLink size={10} />
            </a>
            <a
              href="https://github.com/brantenK/Zano-sheets"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] px-2 py-1 bg-(--chat-bg) border border-(--chat-border) text-(--chat-text-secondary) hover:text-(--chat-text-primary) hover:border-(--chat-border-active) transition-colors rounded flex items-center gap-1"
            >
              View Source
              <ExternalLink size={10} />
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
