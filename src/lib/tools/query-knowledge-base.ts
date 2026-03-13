import { Type } from "@sinclair/typebox";
import { getGeminiRuntimeConfig } from "../rag/gemini-auth";
import type { KnowledgeBaseFileRecord } from "../rag/types";
import { defineTool, type ToolResult, toolText } from "./types";

// We'll maintain a list of active files uploaded by the user to their "Knowledge Base"
let knowledgeBaseFiles: KnowledgeBaseFileRecord[] = [];

function dedupeKnowledgeBaseFiles(
  files: KnowledgeBaseFileRecord[],
): KnowledgeBaseFileRecord[] {
  const byName = new Map<string, KnowledgeBaseFileRecord>();
  for (const file of files) {
    byName.set(file.name, file);
  }
  return [...byName.values()];
}

export function addFileToKnowledgeBase(file: KnowledgeBaseFileRecord) {
  knowledgeBaseFiles = dedupeKnowledgeBaseFiles([...knowledgeBaseFiles, file]);
}

export function getKnowledgeBaseFiles() {
  return [...knowledgeBaseFiles];
}

export function replaceKnowledgeBaseFiles(files: KnowledgeBaseFileRecord[]) {
  knowledgeBaseFiles = dedupeKnowledgeBaseFiles(files);
}

export function clearKnowledgeBaseFiles() {
  knowledgeBaseFiles = [];
}

export function removeKnowledgeBaseFile(name: string) {
  knowledgeBaseFiles = knowledgeBaseFiles.filter((file) => file.name !== name);
}

export const queryKnowledgeBaseTool = defineTool({
  name: "query_knowledge_base",
  label: "Query Knowledge Base",
  description:
    "Queries the user's uploaded corporate knowledge base (documents, manuals, PDFs) using Gemini's massive context window.",
  parameters: Type.Object({
    query: Type.String({
      description:
        "A highly specific question or lookup request (e.g., 'What is our policy on IFRS 15 revenue recognition?')",
    }),
  }),
  execute: async (_toolCallId, params): Promise<ToolResult> => {
    if (knowledgeBaseFiles.length === 0) {
      return toolText(
        "The knowledge base is empty. Ask the user to upload reference documents first.",
      );
    }

    const runtime = getGeminiRuntimeConfig();
    if (!runtime) {
      throw new Error(
        "Gemini is not configured. Use Google as the active chat provider or add a Gemini override key in Web settings.",
      );
    }

    const activeFiles = knowledgeBaseFiles.filter(
      (file) => file.state === "ACTIVE" && file.uri,
    );
    if (activeFiles.length === 0) {
      const processingCount = knowledgeBaseFiles.filter(
        (file) => file.state === "PROCESSING",
      ).length;
      return toolText(
        processingCount > 0
          ? "Knowledge base documents are still processing in Gemini. Retry in a moment."
          : "The knowledge base does not contain any active documents. Re-upload the reference files.",
      );
    }

    const contents = [
      {
        role: "user",
        parts: [
          ...activeFiles.map((file) => ({
            fileData: {
              mimeType: file.mimeType,
              fileUri: file.uri,
            },
          })),
          {
            text: `You are answering strictly from the attached knowledge-base documents.\n\nAvailable documents:\n${activeFiles.map((file) => `- ${file.displayName}`).join("\n")}\n\nQuestion: ${params.query}\n\nInstructions:\n- Use only the attached documents as evidence.\n- Cite the document name in every substantive part of the answer.\n- Mention section names, headings, or page cues when the document provides them.\n- If the answer is not supported by the attached files, say that clearly.`,
          },
        ],
      },
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(runtime.model)}:generateContent?key=${runtime.apiKey}`;
    const KB_TIMEOUT_MS = 30000;
    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), KB_TIMEOUT_MS);

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text();
          const isRetryable = res.status === 429 || res.status >= 500;
          if (isRetryable && attempt < MAX_RETRIES) {
            lastError = new Error(`Gemini API error: ${res.status} ${errText}`);
            await new Promise((r) => setTimeout(r, 2 ** attempt * 2000));
            continue;
          }
          throw new Error(`Gemini API error: ${res.status} ${errText}`);
        }

        const data = await res.json();
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

        return toolText(
          textResponse || "No answer could be retrieved from the documents.",
        );
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          lastError = new Error(
            `Knowledge base query timed out after ${KB_TIMEOUT_MS / 1000}s.`,
          );
        } else {
          lastError = e instanceof Error ? e : new Error(String(e));
        }
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 2000));
        }
      }
    }

    throw new Error(
      `Failed to query knowledge base: ${lastError?.message ?? "Unknown error"}`,
    );
  },
});
