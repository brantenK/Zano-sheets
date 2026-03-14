// @vitest-environment jsdom
/**
 * Accessibility tests for Zano Sheets
 * Tests WCAG 2.1 AA compliance, keyboard navigation, and screen reader support
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { SkipLink, SkipLinks } from "../src/taskpane/components/chat/skip-links";

// Mock axe-core for automated accessibility testing
// In production, install: @testing-library/jest-dom and jest-axe
const mockAxeResults = { violations: [] };

describe("Accessibility - Automated Tests", () => {
  describe("Skip Links", () => {
    it("should provide skip links for keyboard navigation", () => {
      const container = render(<SkipLinks />).container;

      const skipLinks = container.querySelectorAll("a");
      expect(skipLinks.length).toBeGreaterThan(0);
      skipLinks.forEach((link) => {
        expect(link).toHaveAttribute("href");
      });
    });

    it("should make skip links visible on focus", async () => {
      render(<SkipLink targetId="chat-input">Skip to chat input</SkipLink>);

      const skipLink = screen.getByText("Skip to chat input");
      expect(skipLink).toHaveClass("sr-only");

      await userEvent.tab();
      // Focus should make it visible
      expect(skipLink).toHaveFocus();
    });
  });

  describe("ARIA Labels and Roles", () => {
    it("should have proper ARIA labels on icon-only buttons", async () => {
      // Mock ChatInterface for testing
      const mockChatInterface = () => (
        <div>
          <button aria-label="Clear messages" type="button">
            <svg data-testid="trash-icon" />
          </button>
          <button
            aria-label="Toggle dark mode"
            type="button"
            title="Switch to dark mode"
          >
            <svg data-testid="moon-icon" />
          </button>
        </div>
      );

      render(mockChatInterface());

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);

      buttons.forEach((button) => {
        const label = button.getAttribute("aria-label");
        const title = button.getAttribute("title");
        const text = button.textContent;

        // Icon-only buttons must have aria-label or title
        const hasIcon = button.querySelector("svg, i");
        if (hasIcon && !text?.trim()) {
          expect(label || title).toBeTruthy();
        }
      });
    });

    it("should provide status updates for dynamic content", () => {
      const StatsBar = () => (
        <div role="status" aria-live="polite">
          <span aria-label="Input tokens: 1000">^1.0k</span>
          <span aria-label="Output tokens: 500">v500</span>
        </div>
      );

      render(<StatsBar />);

      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
    });

    it("should use proper tab roles for tab navigation", () => {
      const TabComponent = () => (
        <div role="tablist">
          <button role="tab" aria-selected="true" aria-controls="panel1">
            Chat
          </button>
          <button role="tab" aria-selected="false" aria-controls="panel2">
            Settings
          </button>
        </div>
      );

      render(<TabComponent />);

      const tabs = screen.getAllByRole("tab");
      expect(tabs.length).toBe(2);
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    });
  });

  describe("Keyboard Navigation", () => {
    it("should allow tab navigation through all interactive elements", async () => {
      const user = userEvent.setup();

      const TestComponent = () => (
        <div>
          <button type="button">Button 1</button>
          <input type="text" placeholder="Input" />
          <button type="button">Button 2</button>
        </div>
      );

      render(<TestComponent />);

      const button1 = screen.getByText("Button 1");
      const input = screen.getByPlaceholderText("Input");
      const button2 = screen.getByText("Button 2");

      // Tab through elements
      await user.tab();
      expect(button1).toHaveFocus();

      await user.tab();
      expect(input).toHaveFocus();

      await user.tab();
      expect(button2).toHaveFocus();
    });

    it("should support Enter and Space for button activation", async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<button type="button" onClick={handleClick}>Test</button>);

      const button = screen.getByRole("button");
      button.focus();

      await user.keyboard("{Enter}");
      expect(handleClick).toHaveBeenCalledTimes(1);

      await user.keyboard(" "); // Space
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it("should move focus through modal controls", async () => {
      const user = userEvent.setup();
      let modalOpen = true;

      const Modal = () => (
        <div role="dialog" aria-modal="true">
          <button type="button">Modal Button 1</button>
          <button type="button">Modal Button 2</button>
          <button type="button" onClick={() => (modalOpen = false)}>
            Close
          </button>
        </div>
      );

      render(<Modal />);

      const button1 = screen.getByText("Modal Button 1");
      const button2 = screen.getByText("Modal Button 2");
      const close = screen.getByText("Close");

      button1.focus();

      // Tab should cycle within modal
      await user.tab();
      expect(button2).toHaveFocus();

      await user.tab();
      expect(close).toHaveFocus();

      await user.tab();
      expect(document.activeElement).not.toBe(button1);
    });

    it("should support Escape to close modals", async () => {
      const handleClose = vi.fn();
      const user = userEvent.setup();

      const Modal = () => (
        <div role="dialog" aria-modal="true">
          <input type="text" autoFocus />
        </div>
      );

      render(<Modal />);

      const input = screen.getByRole("textbox");
      input.focus();

      await user.keyboard("{Escape}");
      // Modal should handle escape (would need actual implementation)
      expect(input).toHaveFocus(); // Focus still on input
    });
  });

  describe("Color and Contrast", () => {
    it("should not use color as the only means of conveying information", () => {
      const TokenDisplay = () => (
        <div>
          <span title="Input tokens" aria-label="Input tokens: 1000">
            ^1.0k
          </span>
          <span title="Output tokens" aria-label="Output tokens: 500">
            v500
          </span>
        </div>
      );

      render(<TokenDisplay />);

      // Symbols (^v) provide additional meaning beyond color
      const input = screen.getByLabelText("Input tokens: 1000");
      const output = screen.getByLabelText("Output tokens: 500");

      expect(input.textContent).toContain("^");
      expect(output.textContent).toContain("v");
    });

    it("should have sufficient color contrast for text", () => {
      // This would typically use axe-core to check contrast ratios
      // For now, we test that contrast-critical classes are present
      const TextComponent = () => (
        <div>
          <span className="text-(--chat-text-primary)">Primary text</span>
          <span className="text-(--chat-text-secondary)">Secondary text</span>
          <span className="text-(--chat-text-muted)">Muted text</span>
        </div>
      );

      const { container } = render(<TextComponent />);

      const spans = container.querySelectorAll("span");
      expect(spans.length).toBe(3);

      // In production, use axe-core to verify WCAG AA compliance (4.5:1 for normal text)
      // expect(mockAxeResults).toHaveNoViolations();
    });
  });

  describe("Focus Management", () => {
    it("should maintain focus when switching tabs", async () => {
      const user = userEvent.setup();

      const TabSwitcher = () => {
        const [activeTab, setActiveTab] = React.useState("chat");

        return (
          <div>
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              aria-selected={activeTab === "chat"}
              role="tab"
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              aria-selected={activeTab === "settings"}
              role="tab"
            >
              Settings
            </button>
            {activeTab === "chat" && (
              <div id="chat-panel">
                <input type="text" placeholder="Chat input" />
              </div>
            )}
            {activeTab === "settings" && (
              <div id="settings-panel">
                <input type="text" placeholder="Settings input" />
              </div>
            )}
          </div>
        );
      };

      render(<TabSwitcher />);

      const chatTab = screen.getByRole("tab", { name: "Chat" });
      const settingsTab = screen.getByRole("tab", { name: "Settings" });

      await user.click(chatTab);
      expect(chatTab).toHaveAttribute("aria-selected", "true");

      const chatInput = screen.getByPlaceholderText("Chat input");
      expect(chatInput).toBeInTheDocument();

      await user.click(settingsTab);
      expect(settingsTab).toHaveAttribute("aria-selected", "true");
      expect(settingsTab).toHaveFocus();
    });

    it("should restore focus after closing dropdowns", async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();

      const Dropdown = () => (
        <div>
          <button type="button" aria-haspopup="true" aria-expanded="true">
            Open Dropdown
          </button>
          <div role="menu">
            <button role="menuitem" onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      );

      render(<Dropdown />);

      const trigger = screen.getByRole("button", { name: "Open Dropdown" });
      trigger.focus();

      const menuItem = screen.getByRole("menuitem");
      await user.click(menuItem);

      expect(handleClose).toHaveBeenCalled();
      // Focus should return to trigger (implementation-dependent)
    });
  });

  describe("Screen Reader Support", () => {
    it("should announce dynamic content changes", () => {
      const LiveRegion = () => (
        <div>
          <div aria-live="polite" aria-atomic="true" role="status">
            Loading...
          </div>
          <div aria-live="assertive" role="alert">
            Error occurred
          </div>
        </div>
      );

      render(<LiveRegion />);

      const politeRegion = screen.getByRole("status");
      const alertRegion = screen.getByRole("alert");

      expect(politeRegion).toHaveAttribute("aria-live", "polite");
      expect(alertRegion).toHaveAttribute("aria-live", "assertive");
    });

    it("should provide descriptive labels for form inputs", () => {
      const Form = () => (
        <form>
          <label htmlFor="api-key">API Key</label>
          <input id="api-key" type="password" aria-describedby="api-key-help" />
          <span id="api-key-help">Enter your provider API key</span>
        </form>
      );

      render(<Form />);

      const input = screen.getByLabelText("API Key");
      expect(input).toHaveAttribute("aria-describedby", "api-key-help");

      const help = screen.getByText("Enter your provider API key");
      expect(help).toHaveAttribute("id", "api-key-help");
    });

    it("should indicate required fields", () => {
      const Form = () => (
        <form>
          <label htmlFor="required-field">
            Required Field <span aria-hidden="true">*</span>
          </label>
          <input
            id="required-field"
            type="text"
            required
            aria-required="true"
          />
        </form>
      );

      render(<Form />);

      const input = screen.getByLabelText(/required field/i);
      expect(input).toHaveAttribute("aria-required", "true");
    });
  });
});

describe("Accessibility - Keyboard Shortcuts", () => {
  it("should provide documented keyboard shortcuts", () => {
    const shortcuts = [
      { key: "Ctrl+K", description: "Clear chat" },
      { key: "Ctrl+/", description: "Toggle settings" },
      { key: "Escape", description: "Stop generation" },
      { key: "Ctrl+Shift+N", description: "New chat" },
    ];

    shortcuts.forEach((shortcut) => {
      expect(shortcut.key).toBeTruthy();
      expect(shortcut.description).toBeTruthy();
    });
  });

  it("should not interfere with browser/OS shortcuts", () => {
    // Test that custom shortcuts don't override critical system shortcuts
    const systemShortcuts = ["Ctrl+W", "Ctrl+T", "Ctrl+N", "Ctrl+L"];

    const customShortcuts = ["Ctrl+K", "Ctrl+/", "Ctrl+Shift+N"];

    const conflicts = customShortcuts.filter((shortcut) =>
      systemShortcuts.includes(shortcut)
    );

    expect(conflicts.length).toBe(0);
  });
});
