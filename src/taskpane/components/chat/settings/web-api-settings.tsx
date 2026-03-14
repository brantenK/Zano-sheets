import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const inputStyle = { fontFamily: "inherit" };

interface SearchProvider {
  id: string;
  label: string;
}

interface WebApiSettingsProps {
  webSearchProvider: string;
  webFetchProvider: string;
  braveApiKey: string;
  serperApiKey: string;
  exaApiKey: string;
  geminiApiKey: string;
  searchProviders: SearchProvider[];
  fetchProviders: string[];
  needsBraveKey: boolean;
  needsSerperKey: boolean;
  needsExaKey: boolean;
  showDefaultSearchReliabilityWarning: boolean;
  showBasicFetchReliabilityWarning: boolean;
  onSearchProviderChange: (provider: string) => void;
  onFetchProviderChange: (provider: string) => void;
  onBraveKeyChange: (key: string) => void;
  onSerperKeyChange: (key: string) => void;
  onExaKeyChange: (key: string) => void;
  onGeminiKeyChange: (key: string) => void;
}

export function WebApiSettings({
  webSearchProvider,
  webFetchProvider,
  braveApiKey,
  serperApiKey,
  exaApiKey,
  geminiApiKey,
  searchProviders,
  fetchProviders,
  needsBraveKey,
  needsSerperKey,
  needsExaKey,
  showDefaultSearchReliabilityWarning,
  showBasicFetchReliabilityWarning,
  onSearchProviderChange,
  onFetchProviderChange,
  onBraveKeyChange,
  onSerperKeyChange,
  onExaKeyChange,
  onGeminiKeyChange,
}: WebApiSettingsProps) {
  const [showAdvancedWebKeys, setShowAdvancedWebKeys] = useState(false);

  return (
    <>
      <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted)">
        web tools
      </div>

      <label className="block">
        <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
          Default Search Provider
        </span>
        <select
          value={webSearchProvider}
          onChange={(e) => onSearchProviderChange(e.target.value)}
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

      {showDefaultSearchReliabilityWarning && (
        <div className="border border-(--chat-warning) bg-(--chat-warning-bg) px-3 py-2 text-[10px] text-(--chat-warning)">
          DuckDuckGo works as a fallback, but public scraping and shared CORS
          proxies are less reliable than Brave, Serper, or Exa. Configure one of
          those providers for a stronger public-web experience.
        </div>
      )}

      <label className="block">
        <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
          Default Fetch Provider
        </span>
        <select
          value={webFetchProvider}
          onChange={(e) => onFetchProviderChange(e.target.value)}
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

      {showBasicFetchReliabilityWarning && (
        <div className="border border-(--chat-warning) bg-(--chat-warning-bg) px-3 py-2 text-[10px] text-(--chat-warning)">
          Basic fetch depends on site CORS behavior and shared proxy fallbacks.
          Add an Exa API key or your own proxy if you want web reading to feel
          more consistent for end users.
        </div>
      )}

      {needsBraveKey && (
        <label className="block">
          <span className="block text-xs text-(--chat-text-secondary) mb-1.5">
            Brave API Key
          </span>
          <input
            type="password"
            value={braveApiKey}
            onChange={(e) => onBraveKeyChange(e.target.value)}
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
            onChange={(e) => onSerperKeyChange(e.target.value)}
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
            onChange={(e) => onExaKeyChange(e.target.value)}
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
          onChange={(e) => onGeminiKeyChange(e.target.value)}
          placeholder="Optional if Google is not your active chat provider"
          className="w-full bg-(--chat-input-bg) text-(--chat-text-primary)
                     text-sm px-3 py-2 border border-(--chat-border)
                     placeholder:text-(--chat-text-muted)
                     focus:outline-none focus:border-(--chat-border-active)"
          style={inputStyle}
        />
        <span className="mt-1 block text-[10px] text-(--chat-text-muted)">
          Knowledge Base uploads use your active Google provider config first
          and only fall back to this override key.
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
            {showAdvancedWebKeys ? "Hide" : "Show"} advanced saved API keys
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
                onChange={(e) => onBraveKeyChange(e.target.value)}
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
                onChange={(e) => onSerperKeyChange(e.target.value)}
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
                onChange={(e) => onExaKeyChange(e.target.value)}
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
    </>
  );
}
