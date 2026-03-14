const inputStyle = { fontFamily: "inherit" };

interface ProxySettingsProps {
  useProxyValue: boolean;
  proxyUrlValue: string;
  onProxyToggle: () => void;
  onProxyUrlChange: (url: string) => void;
}

export function ProxySettings({
  useProxyValue,
  proxyUrlValue,
  onProxyToggle,
  onProxyUrlChange,
}: ProxySettingsProps) {
  return (
    <>
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
    </>
  );
}
