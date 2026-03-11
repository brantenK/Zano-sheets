import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loadSavedConfigMock,
  evaluateProviderConfigMock,
  applyProxyToModelMock,
  loadWebConfigMock,
  searchWebMock,
  fetchWebMock,
  resolveAgentModelMock,
  streamSimpleMock,
  loadOAuthCredentialsMock,
  refreshOAuthTokenMock,
  saveOAuthCredentialsMock,
} = vi.hoisted(() => ({
  loadSavedConfigMock: vi.fn(),
  evaluateProviderConfigMock: vi.fn(),
  applyProxyToModelMock: vi.fn(),
  loadWebConfigMock: vi.fn(),
  searchWebMock: vi.fn(),
  fetchWebMock: vi.fn(),
  resolveAgentModelMock: vi.fn(),
  streamSimpleMock: vi.fn(),
  loadOAuthCredentialsMock: vi.fn(),
  refreshOAuthTokenMock: vi.fn(),
  saveOAuthCredentialsMock: vi.fn(),
}));

vi.mock("../src/lib/provider-config", () => ({
  loadSavedConfig: loadSavedConfigMock,
  evaluateProviderConfig: evaluateProviderConfigMock,
  applyProxyToModel: applyProxyToModelMock,
}));

vi.mock("../src/lib/web/config", () => ({
  loadWebConfig: loadWebConfigMock,
}));

vi.mock("../src/lib/web/search", () => ({
  searchWeb: searchWebMock,
}));

vi.mock("../src/lib/web/fetch", () => ({
  fetchWeb: fetchWebMock,
}));

vi.mock("../src/lib/chat/model-resolution", () => ({
  resolveAgentModel: resolveAgentModelMock,
}));

vi.mock("../src/lib/chat/provider-stream", () => ({
  streamSimple: streamSimpleMock,
}));

vi.mock("../src/lib/oauth", () => ({
  loadOAuthCredentials: loadOAuthCredentialsMock,
  refreshOAuthToken: refreshOAuthTokenMock,
  saveOAuthCredentials: saveOAuthCredentialsMock,
}));

import { executeDeepResearch } from "../src/lib/research/deep-agent";

const baseConfig = {
  provider: "openai",
  apiKey: "sk-test",
  model: "gpt-4o",
  useProxy: false,
  proxyUrl: "",
  thinking: "none",
  followMode: true,
  bashMode: "on-demand",
  authMethod: "apikey",
} as const;

const baseModel = {
  id: "gpt-4o",
  name: "GPT-4o",
  api: "openai-completions",
  provider: "openai",
  reasoning: true,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 16000,
};

beforeEach(() => {
  vi.clearAllMocks();

  loadSavedConfigMock.mockReturnValue(baseConfig);
  evaluateProviderConfigMock.mockReturnValue({ blocking: [], warnings: [] });
  loadWebConfigMock.mockReturnValue({
    searchProvider: "serper",
    fetchProvider: "basic",
    apiKeys: {},
  });
  resolveAgentModelMock.mockReturnValue({ baseModel });
  applyProxyToModelMock.mockImplementation((model: unknown) => model);
  streamSimpleMock.mockResolvedValue({
    result: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Structured answer" }],
    }),
  });
  loadOAuthCredentialsMock.mockReturnValue(null);
  refreshOAuthTokenMock.mockResolvedValue({
    access: "oauth-access",
    refresh: "oauth-refresh",
    expires: Date.now() + 60_000,
  });
});

describe("executeDeepResearch", () => {
  it("uses the configured search provider first and falls back to ddgs", async () => {
    searchWebMock
      .mockRejectedValueOnce(new Error("serper failed"))
      .mockResolvedValueOnce([
        {
          title: "Example",
          href: "https://example.com/article",
          body: "snippet",
        },
      ]);
    fetchWebMock.mockResolvedValue({
      kind: "text",
      contentType: "text/markdown",
      text: "source text",
      title: "Example article",
    });

    const result = await executeDeepResearch("market outlook", vi.fn());

    expect(result).toBe("Structured answer");
    expect(searchWebMock).toHaveBeenNthCalledWith(
      1,
      "market outlook",
      { maxResults: 6, page: 1 },
      { proxyUrl: undefined, apiKeys: {} },
      "serper",
    );
    expect(searchWebMock).toHaveBeenNthCalledWith(
      2,
      "market outlook",
      { maxResults: 6, page: 1 },
      { proxyUrl: undefined, apiKeys: {} },
      "ddgs",
    );
  });

  it("synthesizes through the resolved provider runtime", async () => {
    searchWebMock.mockResolvedValue([
      {
        title: "Example",
        href: "https://example.com/article",
        body: "snippet",
      },
    ]);
    fetchWebMock.mockResolvedValue({
      kind: "text",
      contentType: "text/markdown",
      text: "source text",
      title: "Example article",
    });

    await executeDeepResearch("market outlook", vi.fn());

    expect(resolveAgentModelMock).toHaveBeenCalledWith(baseConfig);
    expect(applyProxyToModelMock).toHaveBeenCalledWith(baseModel, baseConfig);
    expect(streamSimpleMock).toHaveBeenCalledTimes(1);
    expect(streamSimpleMock.mock.calls[0]?.[1]).toMatchObject({
      messages: [
        {
          role: "user",
        },
      ],
    });
    expect(streamSimpleMock.mock.calls[0]?.[2]).toMatchObject({
      apiKey: "sk-test",
    });
  });

  it("fails when no readable source content can be extracted", async () => {
    searchWebMock.mockResolvedValue([
      {
        title: "Example",
        href: "https://example.com/file.pdf",
        body: "snippet",
      },
    ]);
    fetchWebMock.mockResolvedValue({
      kind: "binary",
      contentType: "application/pdf",
      data: new Uint8Array([1, 2, 3]),
    });

    await expect(
      executeDeepResearch("market outlook", vi.fn()),
    ).rejects.toThrow(
      "Deep research could not extract readable content from any search result.",
    );
    expect(streamSimpleMock).not.toHaveBeenCalled();
  });
});