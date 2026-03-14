import { HelpCircle, X } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface HelpTooltipProps {
  content: ReactNode;
  title?: string;
  placement?: "top" | "bottom" | "left" | "right";
  size?: "small" | "medium" | "large";
}

export function HelpTooltip({
  content,
  title,
  placement = "top",
  size = "medium",
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  const sizeClasses = {
    small: "w-48 max-w-xs",
    medium: "w-64 max-w-sm",
    large: "w-80 max-w-md",
  };

  const placementClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={title ? `Help: ${title}` : "Get help"}
        className={`
          inline-flex items-center justify-center
          text-(--chat-text-muted) hover:text-(--chat-accent)
          transition-colors
          ${isOpen ? "text-(--chat-accent)" : ""}
        `}
      >
        <HelpCircle size={14} />
      </button>

      {isOpen && (
        <div
          ref={tooltipRef}
          className={`
            ${placementClasses[placement]}
            ${sizeClasses[size]}
            z-50 p-3
            bg-(--chat-bg) border border-(--chat-border)
            rounded shadow-lg
            text-xs text-(--chat-text-secondary)
          `}
          style={{ fontFamily: "var(--chat-font-mono)" }}
        >
          {title && (
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-(--chat-text-primary)">
                {title}
              </h4>
              <button
                type="button"
                onClick={handleClose}
                className="p-0.5 text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
                aria-label="Close tooltip"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div className="leading-relaxed">{content}</div>
        </div>
      )}
    </div>
  );
}

// Preset tooltips for common settings
export function ProviderHelpTooltip() {
  return (
    <HelpTooltip
      title="AI Provider"
      size="large"
      content={
        <div>
          <p className="mb-2">
            Choose the AI provider to power Zano Sheets. Each has strengths:
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong>Claude (Anthropic)</strong> - Excellent at complex
              reasoning and data analysis
            </li>
            <li>
              <strong>GPT-4 (OpenAI)</strong> - Great for general tasks and
              coding
            </li>
            <li>
              <strong>Gemini (Google)</strong> - Strong at multi-modal tasks
            </li>
          </ul>
          <p className="mt-2 text-(--chat-text-muted)">
            You can switch providers anytime.
          </p>
        </div>
      }
    />
  );
}

export function ModelHelpTooltip() {
  return (
    <HelpTooltip
      title="Model Selection"
      size="large"
      content={
        <div>
          <p className="mb-2">
            Different models offer different capabilities and costs:
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong>GPT-3.5 / Gemini Flash</strong> - Fast, affordable, good
              for simple tasks
            </li>
            <li>
              <strong>GPT-4 / Claude Sonnet</strong> - Balanced capability and
              cost
            </li>
            <li>
              <strong>Claude Opus / GPT-4 Turbo</strong> - Best for complex
              analysis, higher cost
            </li>
          </ul>
          <p className="mt-2 text-(--chat-text-muted)">
            Start with a mid-tier model and upgrade if needed.
          </p>
        </div>
      }
    />
  );
}

export function ThinkingModeHelpTooltip() {
  return (
    <HelpTooltip
      title="Thinking Mode"
      size="medium"
      content={
        <div>
          <p className="mb-2">
            Controls how much time the AI spends reasoning:
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong>None</strong> - Fast, minimal reasoning
            </li>
            <li>
              <strong>Low</strong> - Quick reasoning for simple tasks
            </li>
            <li>
              <strong>Medium</strong> - Balanced for most tasks
            </li>
            <li>
              <strong>High</strong> - Deep reasoning, slower but better for
              complex tasks
            </li>
          </ul>
        </div>
      }
    />
  );
}

export function ToolApprovalHelpTooltip() {
  return (
    <HelpTooltip
      title="Tool Approval"
      size="medium"
      content={
        <div>
          <p className="mb-2">
            Controls when the AI can perform actions in Excel:
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong>Always</strong> - AI acts without asking (fastest)
            </li>
            <li>
              <strong>Manual</strong> - You approve each action (safest)
            </li>
            <li>
              <strong>Smart</strong> - AI asks only for risky actions
            </li>
          </ul>
          <p className="mt-2 text-(--chat-text-muted)">
            Start with Manual until you trust the system.
          </p>
        </div>
      }
    />
  );
}

export function BashModeHelpTooltip() {
  return (
    <HelpTooltip
      title="Bash Mode"
      size="medium"
      content={
        <div>
          <p className="mb-2">Controls code execution capabilities:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong>Disabled</strong> - No code execution (safest)
            </li>
            <li>
              <strong>Read-only</strong> - Can read files but not modify
            </li>
            <li>
              <strong>Full</strong> - Can execute any code
            </li>
          </ul>
          <p className="mt-2 text-(--chat-error)">
            Use Full mode only if you understand the risks.
          </p>
        </div>
      }
    />
  );
}

export function ApiKeyHelpTooltip() {
  return (
    <HelpTooltip
      title="API Key Storage"
      size="medium"
      content={
        <div>
          <p className="mb-2">
            Your API keys are encrypted and stored locally:
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              <strong>Browser Storage</strong> - Persists across sessions
            </li>
            <li>
              <strong>Session Only</strong> - Cleared when Excel closes
            </li>
          </ul>
          <p className="mt-2 text-(--chat-text-muted)">
            Keys are never sent to our servers.
          </p>
        </div>
      }
    />
  );
}
