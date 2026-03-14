import { Check, LogOut } from "lucide-react";
import type { OAuthFlowState } from "../../../../lib/oauth";
import { OAUTH_PROVIDERS } from "../../../../lib/oauth";

const inputStyle = { fontFamily: "inherit" };

interface OAuthManagerProps {
  provider: string;
  authMethod: string;
  oauthFlow: OAuthFlowState;
  oauthCodeInput: string;
  onAuthMethodChange: (method: "apikey" | "oauth") => void;
  onCodeInputChange: (code: string) => void;
  onStartOAuthLogin: () => Promise<void>;
  onExchangeCode: () => Promise<void>;
  onLogoutOAuth: () => void | Promise<void>;
  onFlowStateChange: (state: OAuthFlowState) => void;
}

export function OAuthManager({
  provider,
  authMethod,
  oauthFlow,
  oauthCodeInput,
  onAuthMethodChange,
  onCodeInputChange,
  onStartOAuthLogin,
  onExchangeCode,
  onLogoutOAuth,
}: OAuthManagerProps) {
  const supportsOAuth = provider in OAUTH_PROVIDERS;

  if (!supportsOAuth) return null;

  return (
    <div className="space-y-3 border border-(--chat-border) p-3 bg-(--chat-input-bg)">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onAuthMethodChange("apikey")}
          className={`flex-1 px-3 py-1.5 text-xs border transition-colors ${
            authMethod === "apikey"
              ? "bg-(--chat-accent) border-(--chat-accent) text-white"
              : "bg-(--chat-bg) border-(--chat-border) text-(--chat-text-secondary) hover:border-(--chat-border-active)"
          }`}
          style={{ borderRadius: "var(--chat-radius)" }}
        >
          API Key
        </button>
        <button
          type="button"
          onClick={() => onAuthMethodChange("oauth")}
          className={`flex-1 px-3 py-1.5 text-xs border transition-colors ${
            authMethod === "oauth"
              ? "bg-(--chat-accent) border-(--chat-accent) text-white"
              : "bg-(--chat-bg) border-(--chat-border) text-(--chat-text-secondary) hover:border-(--chat-border-active)"
          }`}
          style={{ borderRadius: "var(--chat-radius)" }}
        >
          OAuth
        </button>
      </div>

      {authMethod === "oauth" && (
        <div className="space-y-2">
          {oauthFlow.step === "idle" && (
            <button
              type="button"
              onClick={onStartOAuthLogin}
              className="w-full px-3 py-2 text-xs bg-(--chat-accent) border border-(--chat-accent) text-white hover:opacity-90 transition-colors"
              style={{ borderRadius: "var(--chat-radius)" }}
            >
              Authorize with {provider}
            </button>
          )}

          {oauthFlow.step === "awaiting-code" && (
            <div className="space-y-2">
              <p className="text-[10px] text-(--chat-text-secondary)">
                A popup window opened. After authorizing, paste the code below:
              </p>
              <input
                type="text"
                value={oauthCodeInput}
                onChange={(e) => onCodeInputChange(e.target.value)}
                placeholder="Paste authorization code here"
                className="w-full bg-(--chat-bg) text-(--chat-text-primary) text-sm px-3 py-2 border border-(--chat-border) focus:outline-none focus:border-(--chat-border-active)"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={onExchangeCode}
                disabled={!oauthCodeInput.trim()}
                className="w-full px-3 py-2 text-xs bg-(--chat-accent) border border-(--chat-accent) text-white hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: "var(--chat-radius)" }}
              >
                Exchange Code
              </button>
            </div>
          )}

          {oauthFlow.step === "exchanging" && (
            <div className="text-[10px] text-(--chat-text-secondary) text-center py-2">
              Exchanging code...
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
                onClick={onLogoutOAuth}
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
                onClick={() => onStartOAuthLogin()}
                className="text-[10px] text-(--chat-text-muted) hover:text-(--chat-text-secondary) transition-colors"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
