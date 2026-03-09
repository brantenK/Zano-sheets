/**
 * Onboarding tour component for first-time users
 * Shows welcome screen and guides through key features
 */

import { ChevronRight, Key, MessageSquare, X, Zap } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const ONBOARDING_KEY = "zanosheets-onboarding-complete";
const ONBOARDING_VERSION = "1"; // Increment to force re-show on updates

interface OnboardingProps {
  onComplete: () => void;
  onOpenSettings: () => void;
}

export function OnboardingTour({
  onComplete,
  onOpenSettings,
}: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already completed onboarding
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
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const handleBack = useCallback(() => {
    setStep((currentStep) => Math.max(0, currentStep - 1));
  }, []);

  if (!isVisible) return null;

  const steps = [
    {
      title: "Welcome to Zano Sheets! 🚀",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Your AI-powered assistant for Excel. Bring your own API key and use
            any AI model you want.
          </p>
          <div className="flex gap-2 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 bg-(--chat-bg-secondary) rounded">
              <Zap size={12} className="text-(--chat-accent)" />
              <span>10+ AI providers</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-(--chat-bg-secondary) rounded">
              <Key size={12} className="text-(--chat-accent)" />
              <span>BYOK - Your keys</span>
            </div>
          </div>
        </div>
      ),
      action: "Get Started",
    },
    {
      title: "Configure your API key",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            To get started, you need an API key from your preferred AI provider.
          </p>
          <div className="text-xs space-y-1 text-(--chat-text-muted)">
            <p>• OpenAI: platform.openai.com</p>
            <p>• Anthropic: console.anthropic.com</p>
            <p>• Or use OpenRouter, Groq, xAI, and more!</p>
          </div>
          <p className="text-sm font-medium text-(--chat-text-primary)">
            Click "Settings" to configure your key.
          </p>
        </div>
      ),
      action: "Open Settings",
      onAction: onOpenSettings,
    },
    {
      title: "Start chatting with Excel",
      content: (
        <div className="space-y-3">
          <p className="text-sm">
            Now you can ask questions about your data in plain English:
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2 bg-(--chat-bg-secondary) rounded border border-(--chat-border)">
              <p className="font-medium">Example prompts:</p>
              <ul className="mt-1 space-y-1 text-(--chat-text-muted)">
                <li>• "Summarize this data"</li>
                <li>• "Create a pivot table from A1:D100"</li>
                <li>• "Find duplicates in column B"</li>
                <li>• "Explain the formula in C5"</li>
              </ul>
            </div>
          </div>
        </div>
      ),
      action: "Got it",
    },
    {
      title: "Pro tips 💡",
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
        </div>
      ),
      action: "Start using Zano Sheets",
    },
  ];

  const currentStep = steps[step];

  const handleNext = () => {
    if (currentStep.onAction) {
      currentStep.onAction();
    }
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-(--chat-bg) border border-(--chat-border) rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--chat-border)">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-(--chat-accent) text-white flex items-center justify-center text-xs font-bold">
              {step + 1}
            </div>
            <span className="text-sm font-medium text-(--chat-text-primary)">
              {currentStep.title}
            </span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
            title="Skip tour"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">{currentStep.content}</div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 px-4 pb-4">
          {steps.map((item, i) => (
            <div
              key={item.title}
              className={`h-1.5 rounded-full transition-colors ${
                i === step
                  ? "bg-(--chat-accent) w-6"
                  : i < step
                    ? "bg-(--chat-accent) w-1.5"
                    : "bg-(--chat-border) w-1.5"
              }`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-(--chat-border)">
          <button
            type="button"
            onClick={step === 0 ? handleSkip : handleBack}
            className="text-xs text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
          >
            {step === 0 ? "Skip tour" : "Back"}
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 px-4 py-2 bg-(--chat-accent) text-white text-sm font-medium rounded hover:opacity-90 transition-opacity"
          >
            {currentStep.action}
            <ChevronRight size={14} />
          </button>
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
