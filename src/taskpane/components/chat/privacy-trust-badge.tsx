import { Info, Shield } from "lucide-react";
import { useCallback, useState } from "react";

interface PrivacyTrustBadgeProps {
  onOpenPrivacyModal?: () => void;
}

/**
 * PrivacyTrustBadge displays a trust indicator in the header
 * assuring users that their data stays in Excel and only prompts
 * are sent to the AI provider.
 */
export function PrivacyTrustBadge({
  onOpenPrivacyModal,
}: PrivacyTrustBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleInfoClick = useCallback(() => {
    setShowTooltip(false);
    onOpenPrivacyModal?.();
  }, [onOpenPrivacyModal]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-(--chat-success)/10 rounded-lg border border-(--chat-success)/20">
        <Shield size={14} className="text-(--chat-success) shrink-0" />
        <div className="flex flex-col">
          <span className="text-xs font-medium text-(--chat-success)">
            Your data stays in Excel
          </span>
          <span className="text-[10px] text-(--chat-text-muted)">
            Prompts sent to AI provider only
          </span>
        </div>
        <button
          type="button"
          aria-label="Learn more about privacy"
          className="ml-auto text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors shrink-0"
          onClick={handleInfoClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
        >
          <Info size={12} />
        </button>
      </div>

      {/* Tooltip */}
      {showTooltip && !onOpenPrivacyModal && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-(--chat-bg) border border-(--chat-border) rounded-lg shadow-lg p-3 z-50">
          <p className="text-xs text-(--chat-text-secondary) leading-relaxed">
            Your Excel data never leaves your workbook. Only your prompts and
            necessary context are sent to the AI provider to generate responses.
          </p>
          <button
            type="button"
            className="mt-2 text-xs text-(--chat-accent) hover:underline"
            onClick={handleInfoClick}
          >
            Learn more →
          </button>
        </div>
      )}
    </div>
  );
}
