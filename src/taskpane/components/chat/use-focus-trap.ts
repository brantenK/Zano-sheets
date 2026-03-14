import { useEffect, useRef } from "react";

/**
 * Hook to trap focus within a container (for modals, dialogs, etc.)
 * Ensures keyboard navigation stays within the modal
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    // Focus first element
    firstElement?.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleTab);
    return () => container.removeEventListener("keydown", handleTab);
  }, [isActive]);

  return containerRef;
}

/**
 * Hook to restore focus to a previously focused element
 * Useful when closing modals/dropdowns
 */
export function useFocusRestore(isActive: boolean) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isActive) {
      // Store the currently focused element
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else {
      // Restore focus when inactive
      previousFocusRef.current?.focus();
    }
  }, [isActive]);
}

/**
 * Hook to manage ARIA live regions for announcements
 */
export function useAnnouncement() {
  const announceRef = useRef<HTMLDivElement>(null);

  const announce = (
    message: string,
    priority: "polite" | "assertive" = "polite",
  ) => {
    if (!announceRef.current) return;

    announceRef.current.setAttribute("aria-live", priority);
    announceRef.current.textContent = "";
    // Force a repaint to ensure screen readers announce the change
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!announceRef.current) return;
        announceRef.current.textContent = message;
      });
    });
  };

  return { announceRef, announce };
}
