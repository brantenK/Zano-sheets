import { Type } from "@sinclair/typebox";
import { getGeminiApiKey } from "../rag/gemini-auth";
import type { GeminiFile } from "../rag/gemini-file-store";
import { defineTool, type ToolResult, toolText } from "./types";

// We'll maintain a list of active files uploaded by the user to their "Knowledge Base"
let knowledgeBaseFiles: GeminiFile[] = [];

export function addFileToKnowledgeBase(file: GeminiFile) {
  knowledgeBaseFiles.push(file);
}

export function getKnowledgeBaseFiles() {
  return [...knowledgeBaseFiles];
}

export function clearKnowledgeBaseFiles() {
  knowledgeBaseFiles = [];
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

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("Gemini API key is required to use the Knowledge Base.");
    }

    try {
      // Build the contents payload mapping the uploaded files + the user's query
      const contents = [
        {
          role: "user",
          parts: [
            ...knowledgeBaseFiles.map((file) => ({
              fileData: {
                mimeType: file.mimeType,
                fileUri: file.name, // e.g. "files/xyz123"
              },
            })),
            {
              text: `You are an expert financial consultant answering a specific question using ONLY the context of the attached corporate documents.\n\nQuestion: ${params.query}\n\nSearch through the attached files deeply. Return a highly detailed, concise answer citing the section or document where you found it. If the answer is not in the documents, state that clearly.`,
            },
          ],
        },
      ];

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error: ${res.status} ${errText}`);
      }

      const data = await res.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

      return toolText(
        textResponse || "No answer could be retrieved from the documents.",
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to query knowledge base: ${msg}`);
    }
  },
});
