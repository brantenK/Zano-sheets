import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loadSavedConfigMock,
  loadWebConfigMock,
  searchWebMock,
  fetchWebMock,
} = vi.hoisted(() => ({
  loadSavedConfigMock: vi.fn(),
  loadWebConfigMock: vi.fn(),
  searchWebMock: vi.fn(),
  fetchWebMock: vi.fn(),
}));

vi.mock("../src/lib/provider-config", () => ({
  loadSavedConfig: loadSavedConfigMock,
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

import { webFetchTool } from "../src/lib/tools/web-fetch";
import { webSearchTool } from "../src/lib/tools/web-search";

beforeEach(() => {
  vi.clearAllMocks();
  loadSavedConfigMock.mockReturnValue({
    useProxy: true,
    proxyUrl: "https://proxy.example.com/?url=",
  });
  loadWebConfigMock.mockReturnValue({
    searchProvider: "brave",
    fetchProvider: "basic",
    apiKeys: { brave: "brave-key" },
  });
});

describe("webSearchTool", () => {
  it("is exposed under the expected direct tool name", () => {
    expect(webSearchTool.name).toBe("web-search");
  });

  it("uses saved web settings and formats text output", async () => {
    searchWebMock.mockResolvedValue([
      {
        title: "Match results",
        href: "https://example.com/matches",
        body: "Yesterday's matches.",
      },
    ]);

    const result = await webSearchTool.execute("call-1", {
      query: "Champions League matches March 10 2026",
      time: "d",
    });

    expect(searchWebMock).toHaveBeenCalledWith(
      "Champions League matches March 10 2026",
      {
        maxResults: undefined,
        region: undefined,
        timelimit: "d",
        page: undefined,
      },
      {
        proxyUrl: "https://proxy.example.com/?url=",
        apiKeys: { brave: "brave-key" },
      },
      "brave",
    );
    expect(result.content[0].text).toContain("1. Match results");
    expect(result.content[0].text).toContain("https://example.com/matches");
  });
});

describe("webFetchTool", () => {
  it("is exposed under the expected direct tool name", () => {
    expect(webFetchTool.name).toBe("web-fetch");
  });

  it("uses saved fetch settings and returns readable content", async () => {
    fetchWebMock.mockResolvedValue({
      kind: "text",
      contentType: "text/markdown",
      title: "Example page",
      metadata: { URL: "https://example.com/page" },
      text: "Useful page content",
    });

    const result = await webFetchTool.execute("call-2", {
      url: "https://example.com/page",
    });

    expect(fetchWebMock).toHaveBeenCalledWith(
      "https://example.com/page",
      {
        proxyUrl: "https://proxy.example.com/?url=",
        apiKeys: { brave: "brave-key" },
      },
      "basic",
    );
    expect(result.content[0].text).toContain("Title: Example page");
    expect(result.content[0].text).toContain("Useful page content");
  });
});