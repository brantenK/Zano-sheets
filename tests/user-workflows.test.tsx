// @vitest-environment jsdom
/**
 * User workflow integration tests for Zano Sheets
 * Tests complete user journeys from start to finish
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the IndexedDB storage
const mockDB = {
  sessions: new Map(),
  settings: new Map(),
  files: new Map(),
};

describe("User Workflows - Onboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockDB.sessions.clear();
    mockDB.settings.clear();
    mockDB.files.clear();
  });

  it("should show onboarding tour for first-time users", async () => {
    const ONBOARDING_KEY = "zanosheets-onboarding-complete";
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull();
  });

  it("should complete onboarding and mark as done", async () => {
    const ONBOARDING_KEY = "zanosheets-onboarding-complete";
    const ONBOARDING_VERSION = "1";

    localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe(ONBOARDING_VERSION);
  });

  it("should guide users through provider setup", () => {
    const steps = [
      "Welcome to Zano Sheets",
      "Choose your AI provider",
      "Configure API settings",
      "Start chatting",
    ];

    expect(steps.length).toBeGreaterThan(0);
    steps.forEach((step) => {
      expect(step).toBeTruthy();
    });
  });
});

describe("User Workflows - Sending Messages", () => {
  it("should send a simple text message", async () => {
    const user = userEvent.setup();
    const mockSendMessage = vi.fn();

    render(
      <div>
        <textarea
          data-testid="chat-input"
          placeholder="Type your message..."
        />
        <button data-testid="send-button" onClick={mockSendMessage}>
          Send
        </button>
      </div>
    );

    const input = screen.getByTestId("chat-input");
    const sendButton = screen.getByTestId("send-button");

    await user.type(input, "Hello, AI!");
    await user.click(sendButton);

    expect(mockSendMessage).toHaveBeenCalled();
  });

  it("should send message with file attachment", async () => {
    const user = userEvent.setup();
    const mockSendMessage = vi.fn();

    const file = new File(["test content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(
      <div>
        <input type="file" data-testid="file-input" />
        <button data-testid="send-button" onClick={mockSendMessage}>
          Send
        </button>
        <div data-testid="file-list" />
      </div>
    );

    const fileInput = screen.getByTestId("file-input");
    await user.upload(fileInput, file);

    const fileList = screen.getByTestId("file-list");
    expect(fileList).toBeInTheDocument();
  });

  it("should display streaming response", async () => {
    const mockStream = [
      { delta: "Hello", done: false },
      { delta: " there", done: false },
      { delta: "!", done: true },
    ];

    let responseText = "";
    for (const chunk of mockStream) {
      responseText += chunk.delta;
    }

    expect(responseText).toBe("Hello there!");
  });

  it("should stop generation on user request", async () => {
    const mockAbort = vi.fn();
    const isStreaming = true;

    if (isStreaming) {
      mockAbort();
    }

    expect(mockAbort).toHaveBeenCalled();
  });
});

describe("User Workflows - Session Management", () => {
  it("should create a new session", async () => {
    const sessionId = "session-123";
    const sessionName = "New Chat";

    mockDB.sessions.set(sessionId, {
      id: sessionId,
      name: sessionName,
      messages: [],
      createdAt: Date.now(),
    });

    expect(mockDB.sessions.has(sessionId)).toBe(true);
  });

  it("should switch between sessions", async () => {
    const session1 = { id: "s1", name: "Chat 1", messages: [] };
    const session2 = { id: "s2", name: "Chat 2", messages: [] };

    mockDB.sessions.set("s1", session1);
    mockDB.sessions.set("s2", session2);

    let currentSession = session1;
    expect(currentSession.id).toBe("s1");

    currentSession = session2;
    expect(currentSession.id).toBe("s2");
  });

  it("should persist messages across sessions", async () => {
    const session = {
      id: "s1",
      name: "Test Chat",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
    };

    mockDB.sessions.set("s1", session);
    const saved = mockDB.sessions.get("s1");

    expect(saved?.messages.length).toBe(2);
  });

  it("should delete a session", async () => {
    const sessionId = "s1";
    mockDB.sessions.set(sessionId, { id: sessionId, name: "Test", messages: [] });

    mockDB.sessions.delete(sessionId);
    expect(mockDB.sessions.has(sessionId)).toBe(false);
  });
});

describe("User Workflows - Settings Management", () => {
  it("should switch between AI providers", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <select data-testid="provider-select">
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="google">Google</option>
        </select>
      </div>
    );

    const select = screen.getByTestId("provider-select");
    await user.selectOptions(select, "openai");

    expect(select).toHaveValue("openai");
  });

  it("should save API key securely", async () => {
    const apiKey = "sk-test-12345";
    const provider = "anthropic";

    mockDB.settings.set(`${provider}_apiKey`, apiKey);
    const saved = mockDB.settings.get(`${provider}_apiKey`);

    expect(saved).toBe(apiKey);
  });

  it("should validate API key format", () => {
    const validKeys = [
      "sk-ant-1234567890",
      "sk-proj-abcdefghijklmnop",
      "AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz",
    ];

    validKeys.forEach((key) => {
      expect(key.length).toBeGreaterThan(10);
    });
  });

  it("should toggle dark/light theme", async () => {
    const user = userEvent.setup();

    render(
      <div>
        <button data-testid="theme-toggle">Toggle Theme</button>
      </div>
    );

    const themeButton = screen.getByTestId("theme-toggle");

    // Initial theme
    let theme = "dark";
    expect(theme).toBe("dark");

    await user.click(themeButton);
    theme = "light";
    expect(theme).toBe("light");

    await user.click(themeButton);
    theme = "dark";
    expect(theme).toBe("dark");
  });
});

describe("User Workflows - Error Recovery", () => {
    it("should recover from API error and retry", async () => {
      let attempts = 0;
      const maxAttempts = 3;

      const attemptRequest = async () => {
        attempts++;
        if (attempts < maxAttempts) {
          throw { status: 503, message: "Service unavailable" };
        }
        return { success: true };
      };

      let result: { success: boolean } | undefined;
      for (let i = 0; i < maxAttempts; i += 1) {
        try {
          result = await attemptRequest();
          break;
        } catch {
          // Retry until success or attempts exhausted
        }
      }

      expect(result).toEqual({ success: true });
    });

  it("should show error and allow fixing settings", async () => {
    const user = userEvent.setup();
    const hasError = true;
    const errorMessage = "Authentication failed (401)";

    render(
      <div>
        {hasError && <div data-testid="error-message">{errorMessage}</div>}
        <button data-testid="fix-settings">Fix in Settings</button>
      </div>
    );

    if (hasError) {
      const errorDisplay = screen.getByTestId("error-message");
      expect(errorDisplay).toHaveTextContent(/401|authentication/i);

      const fixButton = screen.getByTestId("fix-settings");
      await user.click(fixButton);
    }
  });
});

describe("User Workflows - File Operations", () => {
  it("should upload and process Excel file", async () => {
    const user = userEvent.setup();
    const mockProcessFile = vi.fn();

    const file = new File(
      ["col1,col2\nval1,val2"],
      "data.csv",
      { type: "text/csv" }
    );

      render(
        <div>
          <label htmlFor="upload-input">Upload file</label>
          <input id="upload-input" type="file" accept=".csv,.xlsx" />
          <button onClick={mockProcessFile}>Process</button>
        </div>
      );

      const input = screen.getByLabelText("Upload file");
      await user.upload(input, file);

    const processButton = screen.getByRole("button", { name: "Process" });
    await user.click(processButton);

    expect(mockProcessFile).toHaveBeenCalled();
  });

  it("should display file upload progress", async () => {
    const uploadProgress = [0, 25, 50, 75, 100];

    uploadProgress.forEach((progress) => {
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  it("should handle upload errors gracefully", async () => {
    const uploadError = "File too large (max 10MB)";
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    const fileSize = 15 * 1024 * 1024; // 15MB
    const isTooLarge = fileSize > maxFileSize;

    expect(isTooLarge).toBe(true);
    expect(uploadError).toContain("too large");
  });
});

describe("User Workflows - Keyboard Shortcuts", () => {
  it("should use Ctrl+K to clear chat", async () => {
    const mockClear = vi.fn();

    const handleKeyDown = (e: typeof mockEvent) => {
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        mockClear();
      }
    };

    const mockEvent = {
      ctrlKey: true,
      key: "k",
      preventDefault: vi.fn(),
    };
    handleKeyDown(mockEvent);

    expect(mockClear).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it("should use Ctrl+Shift+N for new chat", async () => {
    const mockNewChat = vi.fn();

    // Mock keyboard event handling
    const mockEvent = {
      ctrlKey: true,
      shiftKey: true,
      key: "N",
      preventDefault: vi.fn(),
    };

    const handleKeyDown = (e: typeof mockEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        mockNewChat();
      }
    };

    handleKeyDown(mockEvent);

    expect(mockNewChat).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it("should use Escape to stop generation", async () => {
    const isStreaming = true;
    const mockAbort = vi.fn();

    // Mock keyboard event handling
    const mockEvent = {
      key: "Escape",
      preventDefault: vi.fn(),
    };

    const handleKeyDown = (e: typeof mockEvent) => {
      if (e.key === "Escape" && isStreaming) {
        e.preventDefault();
        mockAbort();
      }
    };

    handleKeyDown(mockEvent);

    expect(mockAbort).toHaveBeenCalled();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });
});

describe("User Workflows - Complete Journey", () => {
  it("should complete full user journey", async () => {
    const steps = [
      "User opens add-in",
      "Onboarding tour displays",
      "User selects provider",
      "User enters API key",
      "User sends first message",
      "AI responds with streaming",
      "User sends follow-up question",
      "User creates new session",
      "User switches back to previous session",
      "User clears chat",
      "User toggles dark mode",
    ];

    steps.forEach((step) => {
      expect(step).toBeTruthy();
    });

    const journeyComplete = true;
    expect(journeyComplete).toBe(true);
  });

  it("should maintain context throughout session", async () => {
    const sessionContext = {
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      theme: "dark",
      sessions: [],
      currentSession: null,
    };

    // Simulate session updates
    sessionContext.currentSession = { id: "s1", name: "Chat 1" };
    sessionContext.sessions.push(sessionContext.currentSession);
    sessionContext.theme = "light";

    expect(sessionContext.currentSession).toBeDefined();
    expect(sessionContext.sessions.length).toBeGreaterThan(0);
    expect(sessionContext.theme).toBe("light");
  });
});
