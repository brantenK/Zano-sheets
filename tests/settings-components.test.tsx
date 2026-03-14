/**
 * Settings components test coverage
 * Tests for ApiKeyManager, ProviderSelector, and related UI components
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiKeyManager } from "../src/taskpane/components/chat/settings/api-key-manager";
import { ProviderSelector } from "../src/taskpane/components/chat/settings/provider-selector";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ApiKeyManager Component", () => {
  const mockProps = {
    provider: "openai",
    authMethod: "apikey",
    apiKey: "",
    showKey: false,
    saveStatus: "idle" as const,
    onApiKeyChange: vi.fn(),
    onShowKeyToggle: vi.fn(),
    onSaveApiKey: vi.fn(),
    onApiKeyBlur: vi.fn(),
  };

  it("should render API key input when auth method is apikey", () => {
    render(<ApiKeyManager {...mockProps} />);

    const input = screen.getByPlaceholderText("Enter your API key");
    expect(input).toBeInTheDocument();
  });

  it("should not render API key input when auth method is not apikey", () => {
    render(<ApiKeyManager {...mockProps} authMethod="oauth" />);

    const input = screen.queryByPlaceholderText("Enter your API key");
    expect(input).not.toBeInTheDocument();
  });

  it("should show masked key by default", () => {
    render(<ApiKeyManager {...mockProps} apiKey="test-key-123" showKey={false} />);

    const input = screen.getByPlaceholderText("Enter your API key") as HTMLInputElement;
    expect(input.style.WebkitTextSecurity).toBe("disc");
  });

  it("should show unmasked key when showKey is true", () => {
    render(<ApiKeyManager {...mockProps} apiKey="test-key-123" showKey={true} />);

    const input = screen.getByPlaceholderText("Enter your API key") as HTMLInputElement;
    expect(input.style.WebkitTextSecurity).toBe("none");
  });

  it("should toggle key visibility when eye icon is clicked", async () => {
    const { rerender } = render(<ApiKeyManager {...mockProps} showKey={false} />);

    const eyeButton = screen.getByRole("button", { name: "" }); // Eye icon button
    fireEvent.click(eyeButton);

    expect(mockProps.onShowKeyToggle).toHaveBeenCalled();

    rerender(<ApiKeyManager {...mockProps} showKey={true} />);
    const input = screen.getByPlaceholderText("Enter your API key") as HTMLInputElement;
    expect(input.style.WebkitTextSecurity).toBe("none");
  });

  it("should call onApiKeyChange when input value changes", async () => {
    const user = userEvent.setup();
    render(<ApiKeyManager {...mockProps} />);

    const input = screen.getByPlaceholderText("Enter your API key");
    await user.type(input, "new-api-key");

    expect(mockProps.onApiKeyChange).toHaveBeenCalledWith("n");
    expect(mockProps.onApiKeyChange).toHaveBeenCalledTimes(11);
  });

  it("should call onApiKeyBlur when input loses focus", async () => {
    const user = userEvent.setup();
    render(<ApiKeyManager {...mockProps} />);

    const input = screen.getByPlaceholderText("Enter your API key");
    await user.click(input);
    await user.tab();

    expect(mockProps.onApiKeyBlur).toHaveBeenCalled();
  });

  it("should disable save button when provider is not selected", () => {
    render(<ApiKeyManager {...mockProps} provider="" />);

    const saveButton = screen.getByRole("button", { name: /save api key/i });
    expect(saveButton).toBeDisabled();
  });

  it("should enable save button when provider is selected", () => {
    render(<ApiKeyManager {...mockProps} provider="openai" />);

    const saveButton = screen.getByRole("button", { name: /save api key/i });
    expect(saveButton).not.toBeDisabled();
  });

  it("should show loading state when saving", () => {
    render(<ApiKeyManager {...mockProps} saveStatus="saving" />);

    const saveButton = screen.getByRole("button", { name: /saving/i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("should show saved state with checkmark", () => {
    render(<ApiKeyManager {...mockProps} saveStatus="saved" />);

    const saveButton = screen.getByRole("button", { name: /saved/i });
    expect(saveButton).not.toBeDisabled();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("should call onSaveApiKey when save button is clicked", async () => {
    const user = userEvent.setup();
    render(<ApiKeyManager {...mockProps} apiKey="my-api-key" provider="openai" />);

    const saveButton = screen.getByRole("button", { name: /save api key/i });
    await user.click(saveButton);

    expect(mockProps.onSaveApiKey).toHaveBeenCalledWith("my-api-key", true);
  });

  it("should display provider-specific hint for zai", () => {
    render(<ApiKeyManager {...mockProps} provider="zai" />);

    expect(screen.getByText(/Z.ai provider requires a platform API key/i)).toBeInTheDocument();
  });

  it("should not display provider-specific hint for other providers", () => {
    render(<ApiKeyManager {...mockProps} provider="openai" />);

    expect(
      screen.queryByText(/Z.ai provider requires a platform API key/i),
    ).not.toBeInTheDocument();
  });
});

describe("ProviderSelector Component", () => {
  const mockProps = {
    provider: "openai",
    model: "gpt-4",
    apiType: "openai",
    customBaseUrl: "",
    isCustom: false,
    availableProviders: ["openai", "claude", "deepseek"],
    models: [
      { id: "gpt-4", name: "GPT-4", contextWindow: 8192 },
      { id: "claude-3", name: "Claude 3", contextWindow: 200000 },
    ] as any,
    onProviderChange: vi.fn(),
    onModelChange: vi.fn(),
    onApiTypeChange: vi.fn(),
    onCustomBaseUrlChange: vi.fn(),
    onFixConfig: vi.fn(),
    providerHealth: { blocking: [], warnings: [] },
  };

  it("should render provider select with available options", () => {
    render(<ProviderSelector {...mockProps} />);

    const select = screen.getByDisplayValue("openai");
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole("option");
    expect(options.some((opt) => opt.textContent === "openai")).toBe(true);
    expect(options.some((opt) => opt.textContent === "claude")).toBe(true);
  });

  it("should format provider labels correctly", () => {
    render(
      <ProviderSelector
        {...mockProps}
        availableProviders={["openai", "zai", "openrouter"]}
      />,
    );

    expect(screen.getByText("Z.ai")).toBeInTheDocument();
    expect(screen.getByText("OpenRouter")).toBeInTheDocument();
  });

  it("should not show custom endpoint fields when isCustom is false", () => {
    render(<ProviderSelector {...mockProps} isCustom={false} />);

    expect(screen.queryByLabelText(/API Type/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Base URL/i)).not.toBeInTheDocument();
  });

  it("should show custom endpoint fields when isCustom is true", () => {
    render(<ProviderSelector {...mockProps} isCustom={true} apiType="openai" />);

    expect(screen.getByLabelText(/API Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Base URL/i)).toBeInTheDocument();
  });

  it("should handle provider change with async callback", async () => {
    const user = userEvent.setup();
    const mockOnProviderChange = vi.fn().mockResolvedValue(undefined);
    render(
      <ProviderSelector
        {...mockProps}
        availableProviders={["openai", "claude"]}
        onProviderChange={mockOnProviderChange}
      />,
    );

    const select = screen.getByDisplayValue("openai");
    await user.selectOptions(select, "claude");

    await waitFor(() => {
      expect(mockOnProviderChange).toHaveBeenCalledWith("claude");
    });
  });

  it("should call onModelChange when model is selected", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSelector
        {...mockProps}
        isCustom={true}
        apiType="deepseek"
        model=""
      />,
    );

    const modelSelect = screen.getByRole("combobox", { name: /model id/i });
    await user.selectOptions(modelSelect, "deepseek-reasoner");

    expect(mockProps.onModelChange).toHaveBeenCalledWith("deepseek-reasoner");
  });

  it("should call onApiTypeChange when API type changes", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSelector
        {...mockProps}
        isCustom={true}
        apiType="openai-completions"
      />,
    );

    const apiTypeSelect = screen.getByRole("combobox", { name: /api type/i });
    await user.selectOptions(apiTypeSelect, "anthropic-messages");

    expect(mockProps.onApiTypeChange).toHaveBeenCalledWith(
      "anthropic-messages",
    );
  });

  it("should update custom base URL when input changes", async () => {
    const user = userEvent.setup();
    render(
      <ProviderSelector {...mockProps} isCustom={true} apiType="openai" customBaseUrl="" />,
    );

    const baseUrlInput = screen.getByPlaceholderText("https://api.openai.com/v1");
    await user.type(baseUrlInput, "https://custom-api.example.com");

    expect(mockProps.onCustomBaseUrlChange).toHaveBeenCalled();
    expect(mockProps.onCustomBaseUrlChange).toHaveBeenLastCalledWith("m");
  });

  it("should hide base URL field for deepseek API type", () => {
    render(
      <ProviderSelector {...mockProps} isCustom={true} apiType="deepseek" />,
    );

    expect(screen.queryByLabelText(/Base URL/i)).not.toBeInTheDocument();
  });

  it("should show deepseek-specific models when apiType is deepseek", () => {
    render(
      <ProviderSelector {...mockProps} isCustom={true} apiType="deepseek" />,
    );

    expect(
      screen.getByRole("option", { name: "deepseek-chat" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "deepseek-reasoner" }),
    ).toBeInTheDocument();
  });

  it("should display API type hint text", () => {
    render(
      <ProviderSelector {...mockProps} isCustom={true} apiType="openai" />,
    );

    const hintElements = screen.getAllByText(/The API endpoint URL/i);
    expect(hintElements.length).toBeGreaterThan(0);
  });

  it("should include custom endpoint option in provider list", () => {
    render(<ProviderSelector {...mockProps} />);

    const customOption = screen.getByRole("option", {
      name: "Custom Endpoint",
    });
    expect(customOption).toBeInTheDocument();
  });

  it("should have placeholder for model selection when custom", () => {
    render(
      <ProviderSelector {...mockProps} isCustom={true} apiType="openai" model="" />,
    );

    const modelSelect = screen.getByRole("combobox", { name: /model/i });
    expect(modelSelect).toHaveDisplayValue("Select or enter model...");
  });
});

describe("ProviderSelector - Provider Labels", () => {
  const createSelector = (provider: string) => {
    const props = {
      provider,
      model: "test",
      apiType: "openai",
      customBaseUrl: "",
      isCustom: false,
      availableProviders: [provider],
      models: [] as any,
      onProviderChange: vi.fn(),
      onModelChange: vi.fn(),
      onApiTypeChange: vi.fn(),
      onCustomBaseUrlChange: vi.fn(),
      onFixConfig: vi.fn(),
      providerHealth: { blocking: [], warnings: [] },
    };
    return <ProviderSelector {...props} />;
  };

  it("should display Z.ai label for zai provider", () => {
    render(createSelector("zai"));
    expect(screen.getByText("Z.ai")).toBeInTheDocument();
  });

  it("should display OpenRouter label for openrouter provider", () => {
    render(createSelector("openrouter"));
    expect(screen.getByText("OpenRouter")).toBeInTheDocument();
  });

  it("should display OpenAI Codex label for openai-codex provider", () => {
    render(createSelector("openai-codex"));
    expect(screen.getByText("OpenAI Codex")).toBeInTheDocument();
  });

  it("should use provider id directly for unlabeled providers", () => {
    render(createSelector("anthropic"));
    expect(screen.getByText("anthropic")).toBeInTheDocument();
  });
});
