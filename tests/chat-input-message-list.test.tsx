import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "../src/taskpane/components/chat/chat-input";
import MessageList from "../src/taskpane/components/chat/message-list";

const {
  mockUseChat,
  mockEvaluateProviderConfig,
  mockIsProviderConfigReady,
} = vi.hoisted(() => ({
  mockUseChat: vi.fn(),
  mockEvaluateProviderConfig: vi.fn(),
  mockIsProviderConfigReady: vi.fn(),
}));

vi.mock("../src/taskpane/components/chat/chat-context", () => ({
  useChat: () => mockUseChat(),
}));

vi.mock("../src/lib/provider-config", () => ({
  evaluateProviderConfig: (...args: unknown[]) =>
    mockEvaluateProviderConfig(...args),
  isProviderConfigReady: (...args: unknown[]) =>
    mockIsProviderConfigReady(...args),
}));

const baseProviderConfig = {
  provider: "openai",
  apiKey: "sk-test",
  model: "gpt-4o-mini",
  useProxy: false,
  proxyUrl: "",
  thinking: "none",
  followMode: true,
  bashMode: "on-demand",
  apiType: "openai-completions",
  customBaseUrl: "",
  authMethod: "apikey",
};

function makeBaseContext(overrides?: Record<string, unknown>): any {
  return {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn(),
    processFiles: vi.fn().mockResolvedValue(undefined),
    removeUpload: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
    getSheetName: vi.fn(() => "Sheet1"),
    state: {
      messages: [],
      isStreaming: false,
      error: null,
      providerConfig: null,
      uploads: [],
      isUploading: false,
    },
    ...overrides,
  };
}

describe("ChatInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluateProviderConfig.mockReturnValue({ blocking: [], warnings: [] });
    mockIsProviderConfigReady.mockResolvedValue(true);
  });

  it("renders disabled input when provider is not configured", () => {
    mockUseChat.mockReturnValue(makeBaseContext());

    render(<ChatInput />);

    const input = screen.getByLabelText("Type your message");
    expect((input as HTMLTextAreaElement).disabled).toBe(true);
    expect(input.getAttribute("placeholder")).toBe(
      "Configure API key in settings",
    );
  });

  it("renders error banner when state.error exists", () => {
    const ctx = makeBaseContext();
    ctx.state.error = "Boom";
    mockUseChat.mockReturnValue(ctx);

    render(<ChatInput />);

    expect(screen.getByText("Boom")).toBeTruthy();
  });

  it("submits message on Enter when configuration is ready", async () => {
    const ctx = makeBaseContext();
    ctx.state.providerConfig = baseProviderConfig;
    mockUseChat.mockReturnValue(ctx);

    render(<ChatInput />);

    const input = screen.getByLabelText("Type your message");
    fireEvent.change(input, { target: { value: "Hello there" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(ctx.sendMessage).toHaveBeenCalledWith("Hello there", undefined);
    });
  });

  it("renders uploaded file chips and handles removal", () => {
    const ctx = makeBaseContext();
    ctx.state.providerConfig = baseProviderConfig;
    ctx.state.uploads = [{ name: "report.csv", size: 2048 }];
    mockUseChat.mockReturnValue(ctx);

    render(<ChatInput />);

    expect(screen.getByText("report.csv")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Remove report.csv"));
    expect(ctx.removeUpload).toHaveBeenCalledWith("report.csv");
  });
});

describe("MessageList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when there are no messages", () => {
    mockUseChat.mockReturnValue(makeBaseContext());

    render(<MessageList />);

    expect(
      screen.getByText("Start a conversation to interact with your Excel data"),
    ).toBeTruthy();
  });

  it("renders user and assistant messages", () => {
    const ctx = makeBaseContext();
    ctx.state.messages = [
      {
        id: "u1",
        role: "user",
        parts: [{ type: "text", text: "Hi" }],
        timestamp: Date.now(),
      },
      {
        id: "a1",
        role: "assistant",
        parts: [{ type: "text", text: "Hello" }],
        timestamp: Date.now(),
      },
    ];
    mockUseChat.mockReturnValue(ctx);

    render(<MessageList />);

    expect(screen.getByLabelText("Your message")).toBeTruthy();
    expect(screen.getByText("Hi")).toBeTruthy();
  });
});
