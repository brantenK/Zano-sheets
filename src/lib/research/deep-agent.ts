import { loadSavedConfig } from "../provider-config";

export async function executeDeepResearch(
  query: string,
  onProgress: (msg: string) => void,
): Promise<string> {
  const config = loadSavedConfig();
  if (!config || !config.apiKey) {
    throw new Error(
      "No LLM API configuration found. Please setup OpenRouter, Gemini, or OpenAI in settings.",
    );
  }

  onProgress(`Starting research for: "${query}"...`);

  // 1. Search Web (using allorigins CORS proxy over DDG html)
  onProgress(`Searching the web for latest info...`);
  const ddgUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)}`;
  let searchHtml = "";
  try {
    const searchRes = await fetch(ddgUrl);
    searchHtml = await searchRes.text();
  } catch {
    throw new Error("Failed to reach search endpoint.");
  }

  // 2. Extract top 3 links
  const links: string[] = [];
  const linkRegex = /class="result__url" href="([^"]+)"/g;

  while (links.length < 3) {
    const match = linkRegex.exec(searchHtml);
    if (match === null) break;
    let rawLink = match[1];
    if (rawLink.startsWith("//duckduckgo.com/l/?uddg=")) {
      rawLink = decodeURIComponent(
        rawLink.replace("//duckduckgo.com/l/?uddg=", "").split("&")[0],
      );
    }
    if (rawLink && !rawLink.includes("youtube.com")) {
      links.push(rawLink);
    }
  }

  if (links.length === 0) {
    return "No reliable search results found. Please broaden your query.";
  }

  // 3. Fetch link contents
  let combinedContent = "";
  for (const link of links) {
    onProgress(`Reading source: ${link}...`);
    try {
      const pageUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(link)}`;
      const req = await fetch(pageUrl);
      const text = await req.text();
      // Basic HTML strip to conserve context window
      const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const body = bodyMatch ? bodyMatch[1] : text;
      // Truncate to ~10,000 chars per page to avoid massive tokens
      const cleanText = body
        .replace(/<[^>]*>?/gm, " ")
        .replace(/\s+/g, " ")
        .substring(0, 10000);
      combinedContent += `\n\n--- Source: ${link} ---\n${cleanText}\n`;
    } catch {
      onProgress(`Skipping source (timeout): ${link}`);
    }
  }

  // 4. Synthesize via Configured LLM Provider
  onProgress(`Synthesizing research data into structured assumptions...`);

  const systemPrompt = `You are a Deep Research Agent. Based on the following extracted web pages, synthesize a comprehensive answer to the user's query. Output a professional, highly structured summary (like a markdown table or cleanly bulleted Assumptions grid). Include citations linking to the URLs provided.\n\nQuery: ${query}\n\nWeb Data: ${combinedContent}`;

  // Choose standard completions endpoint based on Provider settings
  let apiUrl = "https://api.openai.com/v1/chat/completions";
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.provider === "openrouter") {
    apiUrl = "https://openrouter.ai/api/v1/chat/completions";
  } else if (config.provider === "anthropic") {
    apiUrl = "https://api.anthropic.com/v1/messages";
    headers = {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerously-allow-browser": "true",
    };
  } else if (config.provider === "google") {
    apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    headers = { "Content-Type": "application/json" };
  }

  let textResponse = "Failed to parse LLM synthesis.";

  try {
    if (config.provider === "google") {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: systemPrompt }] }],
        }),
      });
      const data = await res.json();
      textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } else if (config.provider === "anthropic") {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          max_tokens: 4000,
          messages: [{ role: "user", content: systemPrompt }],
        }),
      });
      const data = await res.json();
      textResponse = data.content?.[0]?.text;
    } else {
      // OpenAI-compatible (OpenAI, OpenRouter)
      const res = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: systemPrompt }],
        }),
      });
      const data = await res.json();
      textResponse = data.choices?.[0]?.message?.content;
    }
  } catch (e) {
    throw new Error(`Synthesis API failure: ${String(e)}`);
  }

  onProgress(`Research complete.`);
  return textResponse || "Research process yielded no answer.";
}
