/**
 * Enhanced onboarding tour component for first-time users
 * Comprehensive product education covering safety, configuration, and interactive walkthrough
 */

import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Eye,
  HelpCircle,
  Key,
  Lock,
  MessageSquare,
  Shield,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useFocusRestore, useFocusTrap } from "./use-focus-trap";

const ONBOARDING_KEY = "zanosheets-onboarding-complete";
const ONBOARDING_VERSION = "2"; // Incremented for enhanced onboarding

interface OnboardingProps {
  onComplete: () => void;
  onOpenSettings: () => void;
  onStartWalkthrough?: () => void;
}

type OnboardingMode = "tour" | "walkthrough" | "completed";

export function OnboardingTour({
  onComplete,
  onOpenSettings,
  onStartWalkthrough,
}: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [mode, setMode] = useState<OnboardingMode>("tour");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ONBOARDING_KEY);
      if (saved === ONBOARDING_VERSION) {
        setIsVisible(false);
        return;
      }
    } catch {
      // Ignore storage errors
    }
    setIsVisible(true);
  }, []);

  const handleComplete = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    } catch {
      // Ignore storage errors
    }
    setIsVisible(false);
    setMode("completed");
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const handleBack = useCallback(() => {
    setStep((currentStep) => Math.max(0, currentStep - 1));
  }, []);

  const handleStartWalkthrough = useCallback(() => {
    setMode("walkthrough");
    onStartWalkthrough?.();
  }, [onStartWalkthrough]);

  const handleWalkthroughComplete = useCallback(() => {
    setMode("tour");
  }, []);

  if (!isVisible) return null;

  const tourSteps = [
    {
      title: "Welcome to Zano Sheets!",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Your AI-powered assistant for Excel. Bring your own API key and use
            any AI model you want.
          </p>
          <div className="flex gap-2 text-xs flex-wrap">
            <div className="flex items-center gap-1 px-2 py-1 bg-(--chat-bg-secondary) rounded">
              <Zap size={12} className="text-(--chat-accent)" />
              <span>10+ AI providers</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-(--chat-bg-secondary) rounded">
              <Key size={12} className="text-(--chat-accent)" />
              <span>BYOK - Your keys</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-(--chat-bg-secondary) rounded">
              <Shield size={12} className="text-(--chat-accent)" />
              <span>Privacy first</span>
            </div>
          </div>
          <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded">
            <p className="text-xs text-blue-400">
              <strong>Privacy Assurance:</strong> Your API keys are stored
              locally in your browser. We never see or store your data.
            </p>
          </div>
        </div>
      ),
      action: "Get Started",
    },
    {
      title: "Your Data is Safe",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Zano Sheets is designed to keep your data secure and under your
            control.
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 p-2 bg-(--chat-bg-secondary) rounded">
              <Lock
                size={14}
                className="text-(--chat-accent) shrink-0 mt-0.5"
              />
              <div>
                <p className="font-medium">Local Storage</p>
                <p className="text-(--chat-text-muted)">
                  API keys stored only in your browser's encrypted storage
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-(--chat-bg-secondary) rounded">
              <Shield
                size={14}
                className="text-(--chat-accent) shrink-0 mt-0.5"
              />
              <div>
                <p className="font-medium">Direct API Connection</p>
                <p className="text-(--chat-text-muted)">
                  Your data goes directly to your chosen AI provider, not
                  through our servers
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-(--chat-bg-secondary) rounded">
              <Eye size={14} className="text-(--chat-accent) shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Change Tracking</p>
                <p className="text-(--chat-text-muted)">
                  Every cell modification is tracked and highlighted with
                  navigation links
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
      action: "I feel safe",
    },
    {
      title: "Configure Your AI",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Choose your AI provider and model. Different models excel at
            different tasks:
          </p>
          <div className="text-xs space-y-2">
            <div className="p-2 bg-(--chat-bg-secondary) rounded border border-(--chat-border)">
              <p className="font-medium text-(--chat-text-primary)">
                For Complex Analysis:
              </p>
              <p className="text-(--chat-text-muted)">
                Claude 3.5 Sonnet, GPT-4o - Best for deep analysis and complex
                formulas
              </p>
            </div>
            <div className="p-2 bg-(--chat-bg-secondary) rounded border border-(--chat-border)">
              <p className="font-medium text-(--chat-text-primary)">
                For Speed & Cost:
              </p>
              <p className="text-(--chat-text-muted)">
                GPT-4o-mini, Claude Haiku - Great for quick questions and simple
                tasks
              </p>
            </div>
          </div>
          <p className="text-sm font-medium text-(--chat-text-primary)">
            Click "Settings" to add your API key and choose a model.
          </p>
          <div className="text-xs text-(--chat-text-muted)">
            <p>Popular providers:</p>
            <p>• OpenAI: platform.openai.com</p>
            <p>• Anthropic: console.anthropic.com</p>
          </div>
        </div>
      ),
      action: "Open Settings",
      onAction: onOpenSettings,
    },
    {
      title: "Understanding Excel Mutations",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            When the AI modifies your Excel data, you're always in control.
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded">
              <AlertTriangle
                size={14}
                className="text-amber-400 shrink-0 mt-0.5"
              />
              <div>
                <p className="font-medium text-amber-400">
                  AI Will Modify Cells
                </p>
                <p className="text-amber-400/80">
                  When you ask the AI to make changes, it will modify your
                  workbook. Always review important changes.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-(--chat-bg-secondary) rounded">
              <Eye size={14} className="text-(--chat-accent) shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Dirty Ranges Tracking</p>
                <p className="text-(--chat-text-muted)">
                  Modified cells are highlighted in orange with links. Click to
                  jump to any changed cell.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-(--chat-bg-secondary) rounded">
              <Shield
                size={14}
                className="text-(--chat-accent) shrink-0 mt-0.5"
              />
              <div>
                <p className="font-medium">Follow Mode</p>
                <p className="text-(--chat-text-muted)">
                  Toggle the Eye icon to automatically scroll to cells as the AI
                  modifies them.
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
      action: "Got it",
    },
    {
      title: "Try Your First Prompt",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Ready to see Zano Sheets in action? Let's try it together!
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2 bg-(--chat-bg-secondary) rounded border border-(--chat-border)">
              <p className="font-medium">Example prompts to try:</p>
              <ul className="mt-1 space-y-1 text-(--chat-text-muted)">
                <li>• "Summarize the data in cells A1:C10"</li>
                <li>• "Create a pivot table from this data"</li>
                <li>• "Find duplicates in column B"</li>
                <li>• "Explain the formula in C5"</li>
                <li>• "Add a column with a calculated field"</li>
              </ul>
            </div>
            <div className="p-2 bg-blue-500/10 border border-blue-500/30 rounded">
              <p className="text-xs text-blue-400">
                <strong>Interactive Walkthrough:</strong> Click below to try a
                guided prompt experience where we'll walk you through your first
                AI interaction.
              </p>
            </div>
          </div>
        </div>
      ),
      action: "Start Walkthrough",
      onAction: handleStartWalkthrough,
    },
    {
      title: "Pro Tips & Shortcuts",
      content: (
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-xs">
            <MessageSquare
              size={12}
              className="text-(--chat-accent) mt-0.5 shrink-0"
            />
            <p>
              <strong>Ctrl+K</strong> to clear chat
            </p>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <MessageSquare
              size={12}
              className="text-(--chat-accent) mt-0.5 shrink-0"
            />
            <p>
              <strong>Esc</strong> to stop generation
            </p>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <MessageSquare
              size={12}
              className="text-(--chat-accent) mt-0.5 shrink-0"
            />
            <p>
              <strong>Ctrl+/</strong> to open settings
            </p>
          </div>
          <div className="flex items-start gap-2 text-xs">
            <MessageSquare
              size={12}
              className="text-(--chat-accent) mt-0.5 shrink-0"
            />
            <p>
              <strong>Ctrl+Shift+N</strong> for new chat
            </p>
          </div>
          <div className="mt-3 p-2 bg-(--chat-bg-secondary) rounded border border-(--chat-border)">
            <p className="text-xs font-medium">Need help?</p>
            <p className="text-xs text-(--chat-text-muted)">
              Click the help icon in the header anytime
            </p>
          </div>
        </div>
      ),
      action: "Start using Zano Sheets",
    },
  ];

  const currentStep = tourSteps[step];

  const handleNext = () => {
    if (currentStep.onAction) {
      currentStep.onAction();
    }
    if (step < tourSteps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  if (mode === "walkthrough") {
    return <InteractiveWalkthrough onComplete={handleWalkthroughComplete} />;
  }

  return (
    <>
      {/* Focus trap and restore for modal */}
      <OnboardingModal
        step={step}
        tourSteps={tourSteps}
        currentStep={currentStep}
        handleSkip={handleSkip}
        handleBack={handleBack}
        handleNext={handleNext}
        onClose={handleComplete}
      />
    </>
  );
}

/**
 * Modal component with focus trapping for accessibility
 */
type TourStep = {
  title: string;
  content: React.ReactNode;
  action: string;
  onAction?: () => void;
};

interface OnboardingModalProps {
  step: number;
  tourSteps: TourStep[];
  currentStep: TourStep;
  handleSkip: () => void;
  handleBack: () => void;
  handleNext: () => void;
  onClose: () => void;
}

function OnboardingModal({
  step,
  tourSteps,
  currentStep,
  handleSkip,
  handleBack,
  handleNext,
}: OnboardingModalProps) {
  const modalRef = useFocusTrap(true);
  useFocusRestore(true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-content"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div
        ref={modalRef}
        className="bg-(--chat-bg) border border-(--chat-border) rounded-lg shadow-xl max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--chat-border)">
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full bg-(--chat-accent) text-white flex items-center justify-center text-xs font-bold"
              aria-hidden="true"
            >
              {step + 1}
            </div>
            <span
              id="onboarding-title"
              className="text-sm font-medium text-(--chat-text-primary)"
            >
              {currentStep.title}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            aria-label="Skip tour"
            className="text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div id="onboarding-content" className="p-4">
          {currentStep.content}
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-xs text-(--chat-text-muted) mb-1">
            <span>
              Step {step + 1} of {tourSteps.length}
            </span>
            <span aria-hidden="true">
              {Math.round(((step + 1) / tourSteps.length) * 100)}%
            </span>
          </div>
          <div
            className="h-1.5 bg-(--chat-bg-secondary) rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={tourSteps.length}
            aria-label={`Onboarding progress: step ${step + 1} of ${tourSteps.length}`}
          >
            <div
              className="h-full bg-(--chat-accent) transition-all duration-300"
              style={{ width: `${((step + 1) / tourSteps.length) * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-(--chat-border)">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={step === 0 ? handleSkip : handleBack}
              className="text-xs text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
            >
              {step === 0 ? "Skip for now" : "Back"}
            </button>
            {step > 0 && (
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
              >
                Skip tour
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 px-4 py-2 bg-(--chat-accent) text-white text-sm font-medium rounded hover:opacity-90 transition-opacity"
          >
            {currentStep.action}
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive walkthrough component for guided first prompt experience
 */
interface InteractiveWalkthroughProps {
  onComplete: () => void;
}

function InteractiveWalkthrough({ onComplete }: InteractiveWalkthroughProps) {
  const [step, setStep] = useState(0);

  const walkthroughSteps = [
    {
      title: "Let's Try It Together!",
      description:
        "We'll guide you through your first AI interaction. Don't worry - you can't break anything!",
      highlight: "input",
    },
    {
      title: "Type Your First Prompt",
      description:
        "Click in the input box below and try typing: 'Summarize the data in cells A1:C10'",
      highlight: "input",
      hint: "Or just click 'Use Example' to use a pre-written prompt",
    },
    {
      title: "Watch the AI Work",
      description:
        "See how the AI reads your data, thinks about the response, and answers. You'll see tool calls happen in real-time.",
      highlight: "messages",
    },
    {
      title: "Navigate to Changed Cells",
      description:
        "After the AI modifies cells, you'll see orange links. Click them to jump to the exact location in Excel.",
      highlight: "dirty-ranges",
    },
    {
      title: "You're All Set!",
      description:
        "You've completed the walkthrough! You now know the basics of using Zano Sheets.",
      highlight: null,
    },
  ];

  const currentStep = walkthroughSteps[step];

  const handleNext = () => {
    if (step < walkthroughSteps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive walkthrough"
      className="fixed bottom-4 left-4 right-4 bg-(--chat-bg) border-2 border-(--chat-accent) rounded-lg shadow-xl p-4 z-50"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full bg-(--chat-accent) text-white flex items-center justify-center text-xs font-bold"
            aria-hidden="true"
          >
            {step + 1}
          </div>
          <h3 className="text-sm font-bold text-(--chat-text-primary)">
            {currentStep.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onComplete}
          aria-label="Close walkthrough"
          className="text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="text-sm text-(--chat-text-secondary) mb-3">
        {currentStep.description}
      </p>
      {currentStep.hint && (
        <output
          className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded"
          aria-live="polite"
        >
          <p className="text-xs text-blue-400">{currentStep.hint}</p>
        </output>
      )}
      <div className="flex items-center justify-between">
        <div
          className="flex gap-1"
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={walkthroughSteps.length}
          aria-label={`Walkthrough progress: step ${step + 1} of ${walkthroughSteps.length}`}
        >
          {walkthroughSteps.map((walkthroughStep, i) => (
            <div
              key={walkthroughStep.title}
              className={`h-1 rounded-full transition-all ${
                i === step
                  ? "bg-(--chat-accent) w-4"
                  : i < step
                    ? "bg-(--chat-accent) w-1.5"
                    : "bg-(--chat-border) w-1.5"
              }`}
              aria-hidden="true"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-(--chat-accent) text-white text-sm font-medium rounded hover:opacity-90 transition-opacity"
        >
          {step === walkthroughSteps.length - 1 ? "Finish" : "Next"}
          {step < walkthroughSteps.length - 1 && (
            <ArrowRight size={14} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Persistent help button component
 */
export function HelpButton({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label="Get help"
        className={`p-1.5 text-(--chat-text-muted) hover:text-(--chat-accent) transition-colors ${className}`}
      >
        <HelpCircle size={16} aria-hidden="true" />
      </button>
      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-(--chat-bg-secondary) border border-(--chat-border) rounded text-xs whitespace-nowrap"
        >
          Need help? Click for guidance
          <div className="absolute top-full right-2 -mt-px border-4 border-transparent border-t-(--chat-border)" />
        </div>
      )}
    </div>
  );
}

/**
 * Quick help modal with common questions and shortcuts
 */
export function HelpModal({ onClose }: { onClose: () => void }) {
  const modalRef = useFocusTrap(true);
  useFocusRestore(true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <div
        ref={modalRef}
        className="bg-(--chat-bg) border border-(--chat-border) rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--chat-border)">
          <h3
            id="help-title"
            className="text-sm font-bold text-(--chat-text-primary)"
          >
            Quick Help
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Keyboard Shortcuts
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-(--chat-text-muted)">Clear chat</span>
                <kbd className="px-1.5 py-0.5 bg-(--chat-bg-secondary) rounded font-mono">
                  Ctrl+K
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-(--chat-text-muted)">
                  Stop generation
                </span>
                <kbd className="px-1.5 py-0.5 bg-(--chat-bg-secondary) rounded font-mono">
                  Esc
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-(--chat-text-muted)">Settings</span>
                <kbd className="px-1.5 py-0.5 bg-(--chat-bg-secondary) rounded font-mono">
                  Ctrl+/
                </kbd>
              </div>
              <div className="flex justify-between">
                <span className="text-(--chat-text-muted)">New chat</span>
                <kbd className="px-1.5 py-0.5 bg-(--chat-bg-secondary) rounded font-mono">
                  Ctrl+Shift+N
                </kbd>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Understanding Cell Changes
            </h4>
            <p className="text-xs text-(--chat-text-muted) mb-2">
              When the AI modifies your Excel data:
            </p>
            <ul className="space-y-1 text-xs text-(--chat-text-muted)">
              <li className="flex items-start gap-2">
                <span className="text-(--chat-accent)">•</span>
                <span>
                  Orange links show exactly which cells changed - click to
                  navigate
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-(--chat-accent)">•</span>
                <span>
                  Toggle the Eye icon to enable/disable automatic scrolling to
                  changed cells
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-(--chat-accent)">•</span>
                <span>
                  All changes are tracked per message so you can review what
                  happened
                </span>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Choosing the Right Model
            </h4>
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-(--chat-bg-secondary) rounded">
                <p className="font-medium text-(--chat-text-primary)">
                  For Complex Analysis
                </p>
                <p className="text-(--chat-text-muted)">
                  Claude 3.5 Sonnet, GPT-4o - Best for deep analysis and complex
                  formulas
                </p>
              </div>
              <div className="p-2 bg-(--chat-bg-secondary) rounded">
                <p className="font-medium text-(--chat-text-primary)">
                  For Speed & Cost
                </p>
                <p className="text-(--chat-text-muted)">
                  GPT-4o-mini, Claude Haiku - Great for quick questions
                </p>
              </div>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Safety Tips
            </h4>
            <ul className="space-y-1 text-xs text-(--chat-text-muted)">
              <li className="flex items-start gap-2">
                <AlertTriangle
                  size={12}
                  className="text-amber-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  AI will modify cells when asked - always review important
                  changes
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Shield
                  size={12}
                  className="text-(--chat-accent) shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span>
                  Your API keys are stored locally and never sent to our servers
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if onboarding should be shown
 */
export function useShouldShowOnboarding(): boolean {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ONBOARDING_KEY);
      setShouldShow(saved !== ONBOARDING_VERSION);
    } catch {
      setShouldShow(true);
    }
  }, []);

  return shouldShow;
}

/**
 * Hook to programmatically trigger onboarding
 */
export function useTriggerOnboarding() {
  const trigger = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
      // Force page reload to show onboarding
      window.location.reload();
    } catch {
      // Ignore storage errors
    }
  }, []);

  return trigger;
}
