// @vitest-environment jsdom
/**
 * Tests for enhanced onboarding tour component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import {
  OnboardingTour,
  useShouldShowOnboarding,
  useTriggerOnboarding,
  HelpButton,
  HelpModal,
} from "../src/taskpane/components/chat/onboarding-tour";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("OnboardingTour", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it("should show onboarding when version mismatches", () => {
    localStorageMock.setItem("zanosheets-onboarding-complete", "1");
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
      />
    );
    expect(screen.getByText(/Welcome to Zano Sheets!/i)).toBeInTheDocument();
  });

  it("should not show onboarding when version matches", () => {
    localStorageMock.setItem("zanosheets-onboarding-complete", "2");
    const { container } = render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should display all tour steps in order", async () => {
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
      />
    );

    // Step 1: Welcome
    expect(screen.getByText(/Welcome to Zano Sheets!/i)).toBeInTheDocument();
    expect(screen.getByText(/Get Started/i)).toBeInTheDocument();

    // Click next
    fireEvent.click(screen.getByText(/Get Started/i));

    await waitFor(() => {
      // Step 2: Your Data is Safe
      expect(screen.getByText(/Your Data is Safe/i)).toBeInTheDocument();
      expect(screen.getByText(/Local Storage/i)).toBeInTheDocument();
      expect(screen.getByText(/Direct API Connection/i)).toBeInTheDocument();
      expect(screen.getByText(/Change Tracking/i)).toBeInTheDocument();
    });

    // Click next
    fireEvent.click(screen.getByText(/I feel safe/i));

    await waitFor(() => {
      // Step 3: Configure Your AI
      expect(screen.getByText(/Configure Your AI/i)).toBeInTheDocument();
      expect(screen.getByText(/For Complex Analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/For Speed & Cost/i)).toBeInTheDocument();
    });
  });

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
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
      />
    );

    // Navigate to mutation step
    fireEvent.click(screen.getByText(/Get Started/i));
    fireEvent.click(screen.getByText(/I feel safe/i));
    fireEvent.click(screen.getByText(/Open Settings/i));

    await waitFor(() => {
      expect(screen.getByText(/Understanding Excel Mutations/i)).toBeInTheDocument();
      expect(screen.getByText(/AI Will Modify Cells/i)).toBeInTheDocument();
      expect(screen.getByText(/When you ask the AI to make changes/i)).toBeInTheDocument();
      expect(screen.getByText(/Dirty Ranges Tracking/i)).toBeInTheDocument();
      expect(screen.getByText(/Modified cells are highlighted in orange/i)).toBeInTheDocument();
    });
  });

  it("should show model selection guidance in step 3", async () => {
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
      />
    );

    // Navigate to configuration step
    fireEvent.click(screen.getByText(/Get Started/i));
    fireEvent.click(screen.getByText(/I feel safe/i));

    await waitFor(() => {
      expect(screen.getByText(/Configure Your AI/i)).toBeInTheDocument();
      expect(screen.getByText(/For Complex Analysis/i)).toBeInTheDocument();
      expect(screen.getByText(/Claude 3.5 Sonnet, GPT-4o/i)).toBeInTheDocument();
      expect(screen.getByText(/For Speed & Cost/i)).toBeInTheDocument();
      expect(screen.getByText(/GPT-4o-mini, Claude Haiku/i)).toBeInTheDocument();
    });
  });

  it("should display progress bar correctly", async () => {
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
      />
    );

    // Step 1: Should show "Step 1 of 6" and "17%"
    expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
    expect(screen.getByText(/17%/i)).toBeInTheDocument();
  });

  it("should allow skipping tour", () => {
    const onComplete = vi.fn();
    render(
      <OnboardingTour
        onComplete={onComplete}
        onOpenSettings={() => {}}
      />
    );

    const skipButton = screen.getAllByText(/Skip for now/i)[0];
    fireEvent.click(skipButton);

    expect(onComplete).toHaveBeenCalled();
    expect(localStorageMock.getItem("zanosheets-onboarding-complete")).toBe("2");
  });

  it("should allow navigation back", async () => {
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
      />
    );

    // Move to step 2
    fireEvent.click(screen.getByText(/Get Started/i));

    await waitFor(() => {
      expect(screen.getByText(/Your Data is Safe/i)).toBeInTheDocument();
    });

    // Go back to step 1
    const backButton = screen.getByText(/Back/i);
    fireEvent.click(backButton);

    await waitFor(() => {
      expect(screen.getByText(/Welcome to Zano Sheets!/i)).toBeInTheDocument();
    });
  });

  it("should call onOpenSettings when settings button is clicked", async () => {
    const onOpenSettings = vi.fn();
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={onOpenSettings}
      />
    );

    // Navigate to settings step
    fireEvent.click(screen.getByText(/Get Started/i));
    fireEvent.click(screen.getByText(/I feel safe/i));

    await waitFor(() => {
      expect(screen.getByText(/Configure Your AI/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Open Settings/i));
    expect(onOpenSettings).toHaveBeenCalled();
  });

  it("should trigger walkthrough when button is clicked", async () => {
    const onStartWalkthrough = vi.fn();
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
        onStartWalkthrough={onStartWalkthrough}
      />
    );

    // Navigate to walkthrough step
    fireEvent.click(screen.getByText(/Get Started/i));
    fireEvent.click(screen.getByText(/I feel safe/i));
    fireEvent.click(screen.getByText(/Open Settings/i));
    fireEvent.click(screen.getByText(/Got it/i));

    await waitFor(() => {
      expect(screen.getByText(/Try Your First Prompt/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Start Walkthrough/i));
    expect(onStartWalkthrough).toHaveBeenCalled();
  });

  it("should display keyboard shortcuts in final step", async () => {
    render(
      <OnboardingTour
        onComplete={() => {}}
        onOpenSettings={() => {}}
      />
    );

    // Navigate to walkthrough entry step
    for (let i = 0; i < 5; i++) {
      const nextButton = screen.queryByText(/Get Started|I feel safe|Open Settings|Got it|Start Walkthrough|Next/i);
      if (nextButton) fireEvent.click(nextButton);
    }

    // Finish walkthrough if shown
    for (let i = 0; i < 5; i++) {
      const nextButton = screen.queryByText(/Next|Finish/i);
      if (!nextButton) break;
      fireEvent.click(nextButton);
    }

    await waitFor(() => {
      expect(screen.getByText(/Pro Tips & Shortcuts/i)).toBeInTheDocument();
      expect(screen.getByText(/Ctrl\+K/i)).toBeInTheDocument();
      expect(screen.getByText(/Ctrl\+\//i)).toBeInTheDocument();
      expect(screen.getByText(/Ctrl\+Shift\+N/i)).toBeInTheDocument();
    });
  });
});

describe("HelpButton", () => {
  it("should render help button", () => {
    const onClick = vi.fn();
    render(<HelpButton onClick={onClick} />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("should show tooltip on hover", async () => {
    const onClick = vi.fn();
    render(<HelpButton onClick={onClick} />);

    const button = screen.getByRole("button");
    fireEvent.mouseEnter(button);

    await waitFor(() => {
      expect(screen.getByText(/Need help\? Click for guidance/i)).toBeInTheDocument();
    });
  });

  it("should call onClick when clicked", () => {
    const onClick = vi.fn();
    render(<HelpButton onClick={onClick} />);

    const button = screen.getByRole("button");
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("HelpModal", () => {
  it("should render help modal with all sections", () => {
    render(<HelpModal onClose={() => {}} />);

    expect(screen.getByText(/Quick Help/i)).toBeInTheDocument();
    expect(screen.getByText(/Keyboard Shortcuts/i)).toBeInTheDocument();
    expect(screen.getByText(/Understanding Cell Changes/i)).toBeInTheDocument();
    expect(screen.getByText(/Choosing the Right Model/i)).toBeInTheDocument();
    expect(screen.getByText(/Safety Tips/i)).toBeInTheDocument();
  });

  it("should display keyboard shortcuts", () => {
    render(<HelpModal onClose={() => {}} />);

    expect(screen.getByText(/Ctrl\+K/i)).toBeInTheDocument();
    expect(screen.getByText(/Esc/i)).toBeInTheDocument();
    expect(screen.getByText(/Ctrl\+\//i)).toBeInTheDocument();
    expect(screen.getByText(/Ctrl\+Shift\+N/i)).toBeInTheDocument();
  });

  it("should close when close button clicked", () => {
    const onClose = vi.fn();
    render(<HelpModal onClose={onClose} />);

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should explain dirty ranges tracking", () => {
    render(<HelpModal onClose={() => {}} />);

    expect(screen.getByText(/Understanding Cell Changes/i)).toBeInTheDocument();
    expect(screen.getByText(/Orange links show exactly which cells changed/i)).toBeInTheDocument();
    expect(screen.getByText(/click to navigate/i)).toBeInTheDocument();
  });

  it("should provide model selection guidance", () => {
    render(<HelpModal onClose={() => {}} />);

    expect(screen.getByText(/Choosing the Right Model/i)).toBeInTheDocument();
    expect(screen.getByText(/Claude 3.5 Sonnet, GPT-4o/i)).toBeInTheDocument();
    expect(screen.getByText(/GPT-4o-mini, Claude Haiku/i)).toBeInTheDocument();
  });

  it("should show safety tips", () => {
    render(<HelpModal onClose={() => {}} />);

    expect(screen.getByText(/Safety Tips/i)).toBeInTheDocument();
    expect(screen.getByText(/AI will modify cells when asked/i)).toBeInTheDocument();
    expect(screen.getByText(/always review important changes/i)).toBeInTheDocument();
  });
});

describe("useShouldShowOnboarding", () => {
  it("should return true when onboarding not completed", () => {
    localStorageMock.clear();
    const { result } = renderHook(() => useShouldShowOnboarding());
    expect(result.current).toBe(true);
  });

  it("should return false when onboarding completed", () => {
    localStorageMock.setItem("zanosheets-onboarding-complete", "2");
    const { result } = renderHook(() => useShouldShowOnboarding());
    expect(result.current).toBe(false);
  });

  it("should return true when version mismatches", () => {
    localStorageMock.setItem("zanosheets-onboarding-complete", "1");
    const { result } = renderHook(() => useShouldShowOnboarding());
    expect(result.current).toBe(true);
  });
});

describe("useTriggerOnboarding", () => {
  it("should remove onboarding key and reload", () => {
    localStorageMock.setItem("zanosheets-onboarding-complete", "2");

    const { result } = renderHook(() => useTriggerOnboarding());
    act(() => {
      result.current();
    });

    expect(localStorageMock.getItem("zanosheets-onboarding-complete")).toBeNull();
  });
});
