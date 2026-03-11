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
      { apiKeys: { brave: "brave-key" } },
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
    expect(String(requestUrl)).toContain("https://api.search.brave.com/res/v1/web/search?");
    expect(String(requestUrl)).toContain("q=climate+risk");
    expect(String(requestUrl)).toContain("count=5");
    expect(String(requestUrl)).toContain("offset=5");
    expect(String(requestUrl)).toContain("country=DE");
    expect(String(requestUrl)).toContain("search_lang=de");
    expect(String(requestUrl)).toContain("ui_lang=de-DE");
    expect(String(requestUrl)).toContain("freshness=pw");
    expect(requestInit).toMatchObject({
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": "brave-key",
      },
    });
  });

  it("falls back to the configured proxy when direct Brave fetch fails", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ web: { results: [] } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    await searchWeb(
      "earnings",
      { maxResults: 3 },
      {
        proxyUrl: "https://proxy.example.com/?url=",
        apiKeys: { brave: "brave-key" },
      },
      "brave",
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "https://api.search.brave.com/res/v1/web/search?",
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "https://proxy.example.com/?url=https%3A%2F%2Fapi.search.brave.com%2Fres%2Fv1%2Fweb%2Fsearch",
    );
  });

  it("includes Brave response details in errors", async () => {
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
        { apiKeys: { brave: "brave-key" } },
        "brave",
      ),
    ).rejects.toThrow(
      "Brave search failed: 429 Too Many Requests - quota exceeded",
    );
  });
});