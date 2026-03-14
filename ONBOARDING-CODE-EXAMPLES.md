# Enhanced Onboarding Code Examples

## Key Code Snippets

### 1. Enhanced Tour Step Structure

```tsx
// Step 2: Your Data is Safety (NEW)
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
          <Lock size={14} className="text-(--chat-accent) shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Local Storage</p>
            <p className="text-(--chat-text-muted)">
              API keys stored only in your browser's encrypted storage
            </p>
          </div>
        </div>
        {/* More safety pillars... */}
      </div>
    </div>
  ),
  action: "I feel safe",
}
```

### 2. Excel Mutation Safety Step

```tsx
// Step 4: Understanding Excel Mutations (NEW)
{
  title: "Understanding Excel Mutations",
  content: (
    <div className="space-y-3">
      <p className="text-sm">
        When the AI modifies your Excel data, you're always in control.
      </p>
      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-400">AI Will Modify Cells</p>
            <p className="text-amber-400/80">
              When you ask the AI to make changes, it will modify your
              workbook. Always review important changes.
            </p>
          </div>
        </div>
        {/* Dirty ranges and follow mode explanations... */}
      </div>
    </div>
  ),
  action: "Got it",
}
```

### 3. Model Selection Guidance

```tsx
// Step 3: Configure Your AI (ENHANCED)
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
    </div>
  ),
  action: "Open Settings",
  onAction: onOpenSettings,
}
```

### 4. Progress Tracking Implementation

```tsx
// Progress bar with percentage
<div className="px-4 pb-2">
  <div className="flex items-center justify-between text-xs text-(--chat-text-muted) mb-1">
    <span>Step {step + 1} of {tourSteps.length}</span>
    <span>{Math.round(((step + 1) / tourSteps.length) * 100)}%</span>
  </div>
  <div className="h-1.5 bg-(--chat-bg-secondary) rounded-full overflow-hidden">
    <div
      className="h-full bg-(--chat-accent) transition-all duration-300"
      style={{ width: `${((step + 1) / tourSteps.length) * 100}%` }}
    />
  </div>
</div>
```

### 5. Interactive Walkthrough Component

```tsx
function InteractiveWalkthrough({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);

  const walkthroughSteps = [
    {
      title: "Let's Try It Together!",
      description: "We'll guide you through your first AI interaction...",
      highlight: "input",
    },
    {
      title: "Type Your First Prompt",
      description: "Click in the input box below and try typing...",
      highlight: "input",
    },
    // More steps...
  ];

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-(--chat-bg) border-2 border-(--chat-accent) rounded-lg shadow-xl p-4 z-50">
      {/* Walkthrough UI */}
    </div>
  );
}
```

### 6. Help Button Component

```tsx
export function HelpButton({ onClick, className = "" }: {
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
        className={`p-1.5 text-(--chat-text-muted) hover:text-(--chat-accent) transition-colors ${className}`}
        title="Need help?"
      >
        <HelpCircle size={16} />
      </button>
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-(--chat-bg-secondary) border border-(--chat-border) rounded text-xs whitespace-nowrap">
          Need help? Click for guidance
        </div>
      )}
    </div>
  );
}
```

### 7. Help Modal Structure

```tsx
export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-(--chat-bg) border border-(--chat-border) rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-(--chat-border)">
          <h3 className="text-sm font-bold text-(--chat-text-primary)">
            Quick Help
          </h3>
          <button type="button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Content Sections */}
        <div className="p-4 space-y-4">
          {/* Keyboard Shortcuts */}
          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Keyboard Shortcuts
            </h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>Clear chat</span>
                <kbd>Ctrl+K</kbd>
              </div>
              {/* More shortcuts... */}
            </div>
          </div>

          {/* Understanding Cell Changes */}
          <div>
            <h4 className="text-xs font-bold text-(--chat-text-primary) mb-2">
              Understanding Cell Changes
            </h4>
            <ul className="space-y-1 text-xs text-(--chat-text-muted)">
              <li>Orange links show exactly which cells changed</li>
              {/* More explanations... */}
            </ul>
          </div>

          {/* Choosing the Right Model */}
          {/* Safety Tips */}
        </div>
      </div>
    </div>
  );
}
```

### 8. Chat Interface Integration

```tsx
// State management
const [showHelp, setShowHelp] = useState(false);
const [walkthroughActive, setWalkthroughActive] = useState(false);

// Version check
useEffect(() => {
  try {
    const ONBOARDING_KEY = "zanosheets-onboarding-complete";
    const ONBOARDING_VERSION = "2"; // Updated to "2"
    const saved = localStorage.getItem(ONBOARDING_KEY);
    if (saved !== ONBOARDING_VERSION) {
      setShowOnboarding(true);
    }
  } catch {
    setShowOnboarding(true);
  }
}, []);

// Keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+?: Toggle help
    if (e.ctrlKey && e.key === "?") {
      e.preventDefault();
      setShowHelp((prev) => !prev);
      return;
    }
    // Other shortcuts...
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);

// Help button in header
<HelpButton onClick={() => setShowHelp(true)} />

// Help modal
{showHelp && <HelpModal onClose={() => setShowHelp(false)} />}

// Onboarding with walkthrough support
{showOnboarding && !walkthroughActive && (
  <Suspense fallback={null}>
    <LazyOnboardingTour
      onComplete={handleOnboardingComplete}
      onOpenSettings={handleOpenSettings}
      onStartWalkthrough={handleStartWalkthrough}
    />
  </Suspense>
)}
```

### 9. Custom Hooks

```tsx
// Check if onboarding should be shown
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

// Trigger onboarding programmatically
export function useTriggerOnboarding() {
  const trigger = useCallback(() => {
    try {
      localStorage.removeItem(ONBOARDING_KEY);
      window.location.reload();
    } catch {
      // Ignore storage errors
    }
  }, []);

  return trigger;
}
```

### 10. Testing Example

```tsx
describe("OnboardingTour", () => {
  it("should show safety information in step 2", async () => {
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
      />
    );

    // Navigate to safety step
    fireEvent.click(screen.getByText(/Get Started/i));

    await waitFor(() => {
      expect(screen.getByText(/Your Data is Safe/i)).toBeInTheDocument();
      expect(screen.getByText(/Local Storage/i)).toBeInTheDocument();
      expect(screen.getByText(/API keys stored only in your browser/i)).toBeInTheDocument();
      expect(screen.getByText(/Direct API Connection/i)).toBeInTheDocument();
      expect(screen.getByText(/Your data goes directly to your chosen AI provider/i)).toBeInTheDocument();
      expect(screen.getByText(/Change Tracking/i)).toBeInTheDocument();
      expect(screen.getByText(/Every cell modification is tracked/i)).toBeInTheDocument();
    });
  });

  it("should show Excel mutation warning in step 4", async () => {
    // Test implementation...
  });

  it("should display progress bar correctly", () => {
    // Test implementation...
  });

  it("should allow skipping tour", () => {
    // Test implementation...
  });

  // More tests...
});
```

## Key Implementation Details

### Version Management
```tsx
const ONBOARDING_KEY = "zanosheets-onboarding-complete";
const ONBOARDING_VERSION = "2"; // Increment to force re-show
```

### Accessibility Features
```tsx
// ARIA labels
<div role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
<div role="navigation" aria-label="Chat navigation">
<div role="status" aria-live="polite">

// Keyboard navigation
<button
  type="button"
  onClick={handleNext}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleNext();
    }
  }}
>
```

### Responsive Design
```tsx
// Mobile-friendly progress
<div className="fixed bottom-4 left-4 right-4">

// Scrollable content
<div className="max-h-[80vh] overflow-y-auto">

// Flexible sizing
<div className="max-w-md w-full"> // or max-w-lg for help modal
```

### Styling Conventions
```tsx
// Background colors
bg-(--chat-bg)
bg-(--chat-bg-secondary)
bg-(--chat-accent)

// Text colors
text-(--chat-text-primary)
text-(--chat-text-secondary)
text-(--chat-text-muted)

// Borders
border-(--chat-border)

// Interactive states
hover:text-(--chat-text-primary)
hover:opacity-90
transition-colors
```

## Performance Considerations

### Lazy Loading
```tsx
const LazyOnboardingTour = lazy(async () => {
  const module = await import("./onboarding-tour");
  return { default: module.OnboardingTour };
});

// Usage with Suspense
<Suspense fallback={null}>
  <LazyOnboardingTour />
</Suspense>
```

### Memoization
```tsx
const handleNext = useCallback(() => {
  if (currentStep.onAction) {
    currentStep.onAction();
  }
  // Navigation logic...
}, [currentStep, step, tourSteps.length, handleComplete]);
```

### State Management
```tsx
// LocalStorage with error handling
try {
  localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
} catch {
  // Ignore storage errors
}
```

This comprehensive set of code examples provides a complete reference for implementing and understanding the enhanced onboarding experience.
