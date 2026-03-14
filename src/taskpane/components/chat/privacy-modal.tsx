import { ExternalLink, Shield, X } from "lucide-react";
import { useCallback } from "react";

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * PrivacyModal provides comprehensive information about data handling,
 * storage, and privacy practices to build user trust.
 */
export function PrivacyModal({ isOpen, onClose }: PrivacyModalProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-title"
    >
      <div className="bg-(--chat-bg) border border-(--chat-border) rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-(--chat-border)">
          <div className="flex items-center gap-2">
            <Shield className="text-(--chat-success)" size={20} />
            <h2
              id="privacy-title"
              className="text-lg font-semibold text-(--chat-text-primary)"
            >
              Privacy & Data Handling
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* What stays in Excel */}
          <section>
            <h3 className="text-sm font-semibold text-(--chat-text-primary) mb-2">
              What Stays in Excel
            </h3>
            <ul className="space-y-2 text-xs text-(--chat-text-secondary)">
              <li className="flex items-start gap-2">
                <span className="text-(--chat-success) mt-0.5">✓</span>
                <span>
                  Your workbook data remains in Excel and is never uploaded to
                  external servers
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-(--chat-success) mt-0.5">✓</span>
                <span>API keys are stored locally in your browser only</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-(--chat-success) mt-0.5">✓</span>
                <span>
                  Chat history and sessions are stored in your browser's
                  IndexedDB
                </span>
              </li>
            </ul>
          </section>

          {/* What's sent to AI providers */}
          <section>
            <h3 className="text-sm font-semibold text-(--chat-text-primary) mb-2">
              What's Sent to AI Providers
            </h3>
            <p className="text-xs text-(--chat-text-secondary) leading-relaxed mb-3">
              To provide AI assistance, we send the following to your selected
              AI provider:
            </p>
            <ul className="space-y-2 text-xs text-(--chat-text-secondary)">
              <li className="flex items-start gap-2">
                <span className="text-(--chat-accent) mt-0.5">→</span>
                <span>Your prompts and questions</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-(--chat-accent) mt-0.5">→</span>
                <span>
                  Relevant workbook context (sheet names, cell ranges you're
                  working with)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-(--chat-accent) mt-0.5">→</span>
                <span>File attachments you explicitly upload</span>
              </li>
            </ul>
            <div className="mt-3 p-3 bg-(--chat-bg-secondary) rounded border border-(--chat-border)">
              <p className="text-xs text-(--chat-text-muted)">
                <strong className="text-(--chat-text-secondary)">
                  Important:
                </strong>{" "}
                Actual cell values and workbook content are processed locally by
                Excel. Only metadata and your specific requests are sent to the
                AI.
              </p>
            </div>
          </section>

          {/* API Key Storage */}
          <section>
            <h3 className="text-sm font-semibold text-(--chat-text-primary) mb-2">
              API Key Storage
            </h3>
            <p className="text-xs text-(--chat-text-secondary) leading-relaxed mb-3">
              Your API keys are encrypted and stored locally in your browser:
            </p>
            <ul className="space-y-2 text-xs text-(--chat-text-secondary)">
              <li className="flex items-start gap-2">
                <span className="text-(--chat-success) mt-0.5">🔒</span>
                <span>
                  <strong>Session Storage:</strong> Temporary, cleared when
                  browser closes (recommended for shared computers)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-(--chat-success) mt-0.5">🔒</span>
                <span>
                  <strong>Local Storage:</strong> Persists across sessions
                  (convenient for personal devices)
                </span>
              </li>
            </ul>
            <p className="text-xs text-(--chat-text-muted) mt-3">
              Keys are never sent to our servers. They're sent directly to the
              AI provider you've configured.
            </p>
          </section>

          {/* Telemetry */}
          <section>
            <h3 className="text-sm font-semibold text-(--chat-text-primary) mb-2">
              Telemetry & Error Reporting
            </h3>
            <p className="text-xs text-(--chat-text-secondary) leading-relaxed mb-3">
              Optional telemetry helps us improve the add-in:
            </p>
            <div className="space-y-2">
              <div className="p-3 bg-(--chat-bg-secondary) rounded border border-(--chat-border)">
                <p className="text-xs font-medium text-(--chat-text-secondary) mb-1">
                  What we collect (if enabled):
                </p>
                <ul className="space-y-1 text-xs text-(--chat-text-muted)">
                  <li>• Error messages and stack traces</li>
                  <li>• Performance metrics (load times, response times)</li>
                  <li>• Provider connection status</li>
                </ul>
              </div>
              <div className="p-3 bg-(--chat-success)/5 rounded border border-(--chat-success)/20">
                <p className="text-xs font-medium text-(--chat-success) mb-1">
                  What we NEVER collect:
                </p>
                <ul className="space-y-1 text-xs text-(--chat-text-muted)">
                  <li>• Chat content or conversations</li>
                  <li>• Workbook data or cell values</li>
                  <li>• API keys or credentials</li>
                  <li>• Personal information</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-(--chat-text-muted) mt-3">
              You can disable telemetry in Settings at any time.
            </p>
          </section>

          {/* Provider Privacy Policies */}
          <section>
            <h3 className="text-sm font-semibold text-(--chat-text-primary) mb-2">
              AI Provider Privacy Policies
            </h3>
            <p className="text-xs text-(--chat-text-secondary) leading-relaxed mb-3">
              Each AI provider has their own privacy policy for data processed
              through their APIs:
            </p>
            <div className="space-y-2">
              <a
                href="https://www.anthropic.com/legal/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-(--chat-accent) hover:underline"
              >
                <span>Anthropic (Claude)</span>
                <ExternalLink size={12} />
              </a>
              <a
                href="https://openai.com/policies/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-(--chat-accent) hover:underline"
              >
                <span>OpenAI</span>
                <ExternalLink size={12} />
              </a>
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-(--chat-accent) hover:underline"
              >
                <span>Google (Gemini)</span>
                <ExternalLink size={12} />
              </a>
              <a
                href="https://aws.amazon.com/ai/responsible-ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-(--chat-accent) hover:underline"
              >
                <span>AWS (Bedrock)</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </section>

          {/* Open Source */}
          <section>
            <h3 className="text-sm font-semibold text-(--chat-text-primary) mb-2">
              Open Source & Transparency
            </h3>
            <p className="text-xs text-(--chat-text-secondary) leading-relaxed">
              Zano Sheets is open source. You can review our code, report
              issues, or contribute on{" "}
              <a
                href="https://github.com/brantenK/Zano-sheets"
                target="_blank"
                rel="noopener noreferrer"
                className="text-(--chat-accent) hover:underline inline-flex items-center gap-1"
              >
                GitHub
                <ExternalLink size={12} />
              </a>
              .
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-(--chat-border) bg-(--chat-bg-secondary)">
          <p className="text-xs text-(--chat-text-muted)">
            Have questions? See our{" "}
            <a
              href="https://github.com/brantenK/Zano-sheets#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--chat-accent) hover:underline"
            >
              documentation
            </a>{" "}
            or{" "}
            <a
              href="https://github.com/brantenK/Zano-sheets/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--chat-accent) hover:underline"
            >
              report an issue
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
