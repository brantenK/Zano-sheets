import { Paperclip, Send, Square, X } from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  evaluateProviderConfig,
  isProviderConfigReady,
} from "../../../lib/provider-config";
import { InlineError } from "../error-display";
import { useChat } from "./chat-context";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const LINE_HEIGHT = 20;
const MIN_ROWS = 1;
const MAX_ROWS = 2;

export function ChatInput() {
  const { sendMessage, state, abort, processFiles, removeUpload, clearError } =
    useChat();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploads = state.uploads;
  const isUploading = state.isUploading;
  const providerConfig = state.providerConfig;
  const providerHealth = providerConfig
    ? evaluateProviderConfig(providerConfig)
    : null;
  const [isConfigReady, setIsConfigReady] = useState(false);

  useEffect(() => {
    if (!providerConfig) {
      setIsConfigReady(false);
      return;
    }

    isProviderConfigReady(providerConfig).then((ready) => {
      setIsConfigReady(ready && providerHealth?.blocking.length === 0);
    });
  }, [providerConfig, providerHealth?.blocking.length]);
  const configBlockingMessage = providerHealth?.blocking[0] ?? null;

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const min = LINE_HEIGHT * MIN_ROWS;
    const max = LINE_HEIGHT * MAX_ROWS;
    const clamped = Math.max(min, Math.min(ta.scrollHeight, max));
    ta.style.height = `${clamped}px`;
    ta.style.overflowY = ta.scrollHeight > max ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    if (!input) {
      autoResize();
    }
  }, [input, autoResize]);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      autoResize();
    },
    [autoResize],
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || state.isStreaming) return;
    const attachmentNames = uploads.map((u) => u.name);
    setInput("");
    await sendMessage(
      trimmed,
      attachmentNames.length > 0 ? attachmentNames : undefined,
    );
  }, [input, state.isStreaming, sendMessage, uploads]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter: Submit message. Shift+Enter inserts a newline.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
        return;
      }

      // Escape: Stop generation
      if (e.key === "Escape" && state.isStreaming) {
        e.preventDefault();
        abort();
        return;
      }
    },
    [handleSubmit, state.isStreaming, abort],
  );

  const handleFileSelect = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      await processFiles(Array.from(files));
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processFiles],
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <section
      id="chat-input"
      className="border-t border-(--chat-border) px-3 py-2 bg-(--chat-bg)"
      style={{ fontFamily: "var(--chat-font-mono)" }}
      aria-label="Chat input"
    >
      {state.error && (
        <InlineError
          message={state.error}
          onDismiss={clearError}
          className="mb-2"
        />
      )}
      {!state.error &&
        providerConfig &&
        !isConfigReady &&
        configBlockingMessage && (
          <output
            id="config-warning"
            className="text-(--chat-warning) text-xs mb-2 px-1"
            aria-live="polite"
          >
            {configBlockingMessage}
          </output>
        )}

      {/* Uploaded files chips */}
      {uploads.length > 0 && (
        <ul
          aria-label={`Attached files: ${uploads.length} file${uploads.length > 1 ? "s" : ""}`}
          className="flex flex-wrap gap-1.5 mb-2"
        >
          {uploads.map((file) => (
            <li
              key={file.name}
              className="flex items-center gap-1 px-2 py-1 text-[10px] bg-(--chat-bg-secondary) border border-(--chat-border) text-(--chat-text-secondary)"
              style={{ borderRadius: "var(--chat-radius)" }}
            >
              <span className="max-w-[120px] truncate" title={file.name}>
                {file.name}
              </span>
              {file.size > 0 && (
                <span className="text-(--chat-text-muted)">
                  {formatFileSize(file.size)}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeUpload(file.name)}
                aria-label={`Remove ${file.name}`}
                className="ml-0.5 text-(--chat-text-muted) hover:text-(--chat-error) transition-colors"
              >
                <X size={10} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*,.pdf,.txt,.csv,.json,.xml,.md,.html,.css,.js,.ts,.py,.sh"
        aria-label="Upload files"
      />

      {/* Input container — border on wrapper, textarea + action row inside */}
      <div
        className="bg-(--chat-input-bg) border border-(--chat-border) focus-within:border-(--chat-border-active) transition-colors"
        style={{ borderRadius: "var(--chat-radius)" }}
      >
        <textarea
          id="message-input"
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isConfigReady
              ? "Type a message... (Enter to send, Shift+Enter for new line, Esc to stop)"
              : providerConfig
                ? "Finish provider setup in Settings"
                : "Configure API key in settings"
          }
          disabled={!isConfigReady}
          aria-label="Type your message"
          aria-describedby={
            !isConfigReady && configBlockingMessage
              ? "config-warning"
              : undefined
          }
          className={`
            w-full resize-none bg-transparent text-(--chat-text-primary)
            text-sm px-3 pt-2 pb-0 border-none outline-none
            placeholder:text-(--chat-text-muted)
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          style={{
            fontFamily: "var(--chat-font-mono)",
            lineHeight: `${LINE_HEIGHT}px`,
            height: `${LINE_HEIGHT * MIN_ROWS}px`,
          }}
        />

        {/* Action row inside the border */}
        <div className="flex items-center justify-between px-1.5 py-1">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={openFilePicker}
              disabled={isUploading || state.isStreaming}
              aria-label="Upload files"
              className="flex items-center justify-center w-6 h-5
                         text-(--chat-text-muted) hover:text-(--chat-text-primary)
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors"
            >
              <Paperclip
                size={13}
                className={isUploading ? "animate-pulse" : ""}
                aria-hidden="true"
              />
            </button>
          </div>

          {state.isStreaming ? (
            <button
              type="button"
              onClick={abort}
              aria-label="Stop generation"
              className="flex items-center justify-center w-6 h-5
                         text-(--chat-error) hover:text-(--chat-bg) hover:bg-(--chat-error)
                         transition-colors"
              style={{ borderRadius: "var(--chat-radius)" }}
            >
              <Square size={13} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isConfigReady || !input.trim()}
              aria-label="Send message"
              className="flex items-center justify-center w-6 h-5
                         text-(--chat-text-muted) hover:text-(--chat-text-primary)
                         disabled:opacity-30 disabled:cursor-not-allowed
                         transition-colors"
            >
              <Send size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
