import { HelpCircle, X } from "lucide-react";
import { useState } from "react";

interface HelpButtonProps {
  onClick: () => void;
  className?: string;
}

export function HelpButton({ onClick, className = "" }: HelpButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`p-1.5 text-(--chat-text-muted) hover:text-(--chat-accent) transition-colors ${className}`}
        title="Need help?"
        aria-label="Open help"
      >
        <HelpCircle size={16} />
      </button>
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-(--chat-bg-secondary) border border-(--chat-border) rounded text-xs whitespace-nowrap z-50">
          Need help? Click for guidance
        </div>
      )}
    </div>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-(--chat-bg) border border-(--chat-border) rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--chat-border)">
          <h3 className="text-sm font-bold text-(--chat-text-primary)">
            Quick Help
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-(--chat-text-muted) hover:text-(--chat-text-primary)"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Keyboard Shortcuts
            </h4>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Clear chat</span>
                <kbd>Ctrl+K</kbd>
              </div>
              <div className="flex justify-between">
                <span>Toggle settings</span>
                <kbd>Ctrl+/</kbd>
              </div>
              <div className="flex justify-between">
                <span>New chat</span>
                <kbd>Ctrl+Shift+N</kbd>
              </div>
              <div className="flex justify-between">
                <span>Stop generation</span>
                <kbd>Esc</kbd>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Understanding Cell Changes
            </h4>
            <ul className="space-y-1 text-(--chat-text-muted)">
              <li>Orange links show exactly which cells changed</li>
              <li>Click any changed range to navigate there</li>
              <li>Enable Follow mode to auto-navigate after AI actions</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Choosing the Right Model
            </h4>
            <ul className="space-y-1 text-(--chat-text-muted)">
              <li>Complex analysis: Claude 3.5 Sonnet, GPT-4o</li>
              <li>Speed/cost: GPT-4o-mini, Claude Haiku</li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Safety Tips
            </h4>
            <ul className="space-y-1 text-(--chat-text-muted)">
              <li>AI will modify cells when asked</li>
              <li>Always review important changes</li>
              <li>Use manual tool approval for extra control</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
