import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchWeb } from "../src/lib/web/search";

const fetchMock = vi.fn<typeof fetch>();

vi.stubGlobal("fetch", fetchMock);

describe("searchWeb brave provider", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("maps region and freshness parameters for Brave", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          web: {
            results: [
              {
                title: "Result title",
                url: "https://example.com/article",
                description: "Snippet",
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const results = await searchWeb(
      "climate risk",
      { region: "de-de", timelimit: "w", maxResults: 5, page: 2 },
      {
        proxyUrl: "https://proxy.example.com/?url=",
        apiKeys: { brave: "brave-key" },
      },
      "brave",
    );

    expect(results).toEqual([
      {
        title: "Result title",
        href: "https://example.com/article",
        body: "Snippet",
      },
    ]);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toContain(
      "https://proxy.example.com/?url=https%3A%2F%2Fapi.search.brave.com%2Fres%2Fv1%2Fweb%2Fsearch",
    );
    expect(String(requestUrl)).toContain("q%3Dclimate%2Brisk");
    expect(String(requestUrl)).toContain("count%3D5");
    expect(String(requestUrl)).toContain("offset%3D5");
    expect(String(requestUrl)).toContain("country%3DDE");
    expect(String(requestUrl)).toContain("search_lang%3Dde");
    expect(String(requestUrl)).toContain("ui_lang%3Dde-DE");
    expect(String(requestUrl)).toContain("freshness%3Dpw");
    expect(requestInit).toMatchObject({
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": "brave-key",
      },
    });
  });

  it("returns a clear error when configured Brave proxy fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      searchWeb(
        "earnings",
        { maxResults: 3 },
        {
          proxyUrl: "https://proxy.example.com/?url=",
          apiKeys: { brave: "brave-key" },
        },
        "brave",
      ),
    ).rejects.toThrow("Configured CORS proxy search failed: Failed to fetch");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "https://proxy.example.com/?url=https%3A%2F%2Fapi.search.brave.com%2Fres%2Fv1%2Fweb%2Fsearch",
    );
  });

  it("includes configured proxy response details in errors", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "quota exceeded" }), {
        status: 429,
        statusText: "Too Many Requests",
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      searchWeb(
        "earnings",
        { maxResults: 3 },
        {
          proxyUrl: "https://proxy.example.com/?url=",
          apiKeys: { brave: "brave-key" },
        },
        "brave",
      ),
    ).rejects.toThrow(/Configured CORS proxy returned 429\..*quota exceeded/);
  });
});