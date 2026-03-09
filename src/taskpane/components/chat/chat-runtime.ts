import type {
  AgentEvent,
  ThinkingLevel as AgentThinkingLevel,
  Agent as PiAgent,
} from "@mariozechner/pi-agent-core";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { DirtyRange } from "../../../lib/dirty-tracker";
import { navigateTo } from "../../../lib/excel/api";
import {
  type ChatMessage,
  deriveStats,
  extractPartsFromAssistantMessage,
  generateId,
  type SessionStats,
} from "../../../lib/message-utils";
import type { BashMode, ThinkingLevel } from "../../../lib/provider-config";
import { buildSkillsPromptSection, type SkillMeta } from "../../../lib/skills";

export interface UploadedFile {
  name: string;
  size: number;
}

export interface AgentEventState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sessionStats: SessionStats;
}

type AgentRuntime = {
  Agent: typeof import("@mariozechner/pi-agent-core").Agent;
  streamSimple: typeof import("../../../lib/chat/provider-stream").streamSimple;
  resolveAgentModel: typeof import("../../../lib/chat/model-resolution").resolveAgentModel;
  EXCEL_TOOLS: typeof import("../../../lib/tools").EXCEL_TOOLS;
};

type VfsModule = typeof import("../../../lib/vfs");

let agentRuntimePromise: Promise<AgentRuntime> | null = null;
let vfsModulePromise: Promise<VfsModule> | null = null;

function parseDirtyRanges(result: string | undefined): DirtyRange[] | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result);
    if (parsed._dirtyRanges && Array.isArray(parsed._dirtyRanges)) {
      return parsed._dirtyRanges;
    }
  } catch {
    // Not valid JSON or no dirty ranges
  }
  return null;
}

export async function checkToolApproval(_toolCallId: string): Promise<void> {
  return;
}

function isToolResultErrorText(result: string | undefined): boolean {
  if (!result) return false;

  const trimmed = result.trim();
  if (trimmed.toLowerCase() === "unknown") {
    return true;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }

    if (
      "success" in parsed &&
      (parsed as { success?: unknown }).success === false
    ) {
      return true;
    }

    if (
      "error" in parsed &&
      typeof (parsed as { error?: unknown }).error === "string"
    ) {
      return true;
    }
  } catch {
    // ignore non-JSON tool output
  }

  return false;
}

function extractToolErrorMessage(result: string | undefined): string {
  if (!result) return "Tool execution failed.";

  const trimmed = result.trim();
  if (!trimmed) return "Tool execution failed.";

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      if (
        "error" in parsed &&
        typeof (parsed as { error?: unknown }).error === "string"
      ) {
        return (parsed as { error: string }).error;
      }
      if (
        "message" in parsed &&
        typeof (parsed as { message?: unknown }).message === "string"
      ) {
        return (parsed as { message: string }).message;
      }
    }
  } catch {
    // keep raw output fallback
  }

  return trimmed.length > 220 ? `${trimmed.slice(0, 220)}...` : trimmed;
}

export function getErrorStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  if (
    "status" in err &&
    typeof (err as { status?: unknown }).status === "number"
  ) {
    return (err as { status: number }).status;
  }
  return undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export function isRetryableProviderError(err: unknown): boolean {
  const status = getErrorStatus(err);
  if (status && [408, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const message = getErrorMessage(err).toLowerCase();
  return (
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("temporarily unavailable")
  );
}

export function formatAgentErrorMessage(err: unknown): string {
  const status = getErrorStatus(err);
  if (status === 401) {
    return "Authentication failed (401). Check your API key or reconnect OAuth.";
  }
  if (status === 403) {
    return "Access denied (403). Verify provider permissions, model access, and billing.";
  }
  if (status === 429) {
    return "Rate limited (429). Please retry in a moment.";
  }
  if (status && status >= 500) {
    return `Provider temporarily unavailable (${status}). Please retry shortly.`;
  }

  const message = getErrorMessage(err);
  const lower = message.toLowerCase();
  if (lower.includes("cors") || lower.includes("proxy")) {
    return "Request blocked by CORS/proxy configuration. Check proxy settings in Settings.";
  }
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "Network request failed. Check internet connectivity and proxy settings, then retry.";
  }

  return message || "An error occurred while contacting the model provider.";
}

export function buildSystemPrompt(
  skills: SkillMeta[],
  bashMode: BashMode,
): string {
  return `You are an AI assistant integrated into Microsoft Excel with full access to read and modify spreadsheet data.

Available tools:

FILES & SHELL:
- read: Read uploaded files (images, PDFs, CSV, text). Images are returned for visual analysis. PDFs are rendered into page images for visual analysis.
- prepare_invoice_batch: Preflight multiple invoice PDFs. Renders lightweight preview pages into the VFS, checks whether embedded PDF text is usable, and returns structured per-file summaries plus preview image paths. Prefer this first when many invoices are attached.
- bash: Execute bash commands in a sandboxed virtual filesystem. User uploads are in /home/user/uploads/.
  Supports: ls, cat, grep, find, awk, sed, jq, sort, uniq, wc, cut, head, tail, etc.
  Bash usage mode: ${bashMode === "on-demand" ? "on-demand only. Do not use bash unless the user explicitly asks for shell-style work or the direct tools cannot finish the task." : "automatic. You may use bash when it is the best available tool."}

  Custom commands for efficient data transfer (data flows directly, never enters your context):
  - csv-to-sheet <file> <sheetId> [startCell] [--force] - Import CSV from VFS into spreadsheet. Auto-detects types.
    Fails if target cells already have data. Use --force to overwrite (confirm with user first).
  - sheet-to-csv <sheetId> [range] [file] - Export range to CSV. Defaults to full used range if no range given. Prints to stdout if no file given (pipeable).
  - pdf-to-text <file> <outfile> - Extract text from PDF to file. Use head/grep/tail to read selectively.
  - pdf-to-images <file> <outdir> [--scale=N] [--pages=1,3,5-8] - Render PDF pages to PNG images. Use for scanned PDFs where text extraction won't work. Then use read to visually inspect the images.
  - docx-to-text <file> <outfile> - Extract text from DOCX to file.
  - xlsx-to-csv <file> <outfile> [sheet] - Convert XLSX/XLS/ODS sheet to CSV. Sheet by name or 0-based index.
  - image-to-sheet <file> <width> <height> <sheetId> [startCell] [--cell-size=N] - Render an image as pixel art in Excel. Downsamples to target size and paints cell backgrounds. Cell size in points (default: 3). Max 500x500. Example: image-to-sheet uploads/logo.png 64 64 1 A1 --cell-size=4
  - web-search <query> [--max=N] [--region=REGION] [--time=d|w|m|y] [--page=N] [--json] - Search the web. Returns title, URL, and snippet for each result.
  - web-fetch <url> <outfile> - Fetch a web page and extract its readable content to a file. Use head/grep/tail to read selectively.

  Examples:
    csv-to-sheet uploads/data.csv 1 A1       # import CSV to sheet 1
    sheet-to-csv 1 export.csv                 # export entire sheet to file
    sheet-to-csv 1 A1:D100 export.csv         # export specific range to file
    sheet-to-csv 1 | sort -t, -k3 -rn | head -20   # pipe entire sheet to analysis
    cut -d, -f1,3 uploads/data.csv > filtered.csv && csv-to-sheet filtered.csv 1 A1  # filter then import
    web-search "S&P 500 companies list"       # search the web
    web-search "USD EUR exchange rate" --max=5 --time=w  # recent results only
    web-fetch https://example.com/article page.txt && grep -i "revenue" page.txt  # fetch then grep

  IMPORTANT: When importing file data into the spreadsheet, ALWAYS prefer csv-to-sheet over reading
  the file content and calling set_cell_range. This avoids wasting tokens on data that doesn't need
  to pass through your context.

  PDF / OCR WORKFLOW:
  - For invoice, receipt, statement, or other document-extraction tasks involving PDFs, assume image-based OCR first.
  - When multiple invoice PDFs are attached, use prepare_invoice_batch first to get structured per-file summaries and preview paths before reading any individual invoice in depth.
  - Prefer pdf-to-images followed by read on the generated PNG pages whenever the PDF may be scanned, photographed, faxed, low-quality, or text extraction appears incomplete.
  - Use pdf-to-text first only when the user explicitly wants raw embedded text, or when you have reason to expect a born-digital PDF with a usable text layer.
  - If pdf-to-text returns sparse, garbled, or missing content, immediately switch to pdf-to-images instead of asking the user to retry.
  - When extracting from multipage invoices, read the page images directly and summarize the structured fields the user needs.

  EXECUTION HONESTY:
  - Prefer direct Excel/read/web tools first. Use bash only when it is explicitly needed for shell-style processing.
  - Never claim edits were completed unless write tools actually succeeded.
  - If any tool returns unknown/error (including JSON with success=false), clearly say it failed.
  - When a write fails, provide the exact failure and ask whether to retry.

When the user uploads files, an <attachments> section lists their paths. Use read to access them.

EXCEL READ:
- get_cell_ranges: Read cell values, formulas, and formatting. NOTE: This tool only returns VISIBLE data. Hidden/filtered rows and columns are automatically skipped.
- get_range_as_csv: Get data as CSV. Also skips hidden data.
- search_data: Find text across the spreadsheet
- get_all_objects: List charts, pivot tables, etc.

EXCEL WRITE:
- set_cell_range: Write values, formulas, and formatting.
  SAFETY: Never write directly to merged cells unless you target the top-left cell of the merge. If a write fails with an InvalidArgument error, check if the target range is merged.
  OVERWRITE PROTECTION: Fails by default if target cells already contain data. When this happens:
    1. Tell the user what cells already have data and ask if they want to overwrite.
    2. If yes, retry the exact same call with allow_overwrite=true.
    Do NOT just report the error and stop - always prompt the user for confirmation first.
- clear_cell_range: Clear contents or formatting. Useful for clearing merges.
- copy_to: Copy ranges with formula translation
- modify_sheet_structure: Insert/delete/hide rows/columns, freeze panes
- modify_workbook_structure: Create/delete/rename sheets
- resize_range: Adjust column widths and row heights
- modify_object: Create/update/delete charts and pivot tables

Citations: Use markdown links with #cite: hash to reference sheets/cells. Clicking navigates there.
- Sheet only: [Sheet Name](#cite:sheetId)
- Cell/range: [A1:B10](#cite:sheetId!A1:B10)
Example: [Exchange Ratio](#cite:3) or [see cell B5](#cite:3!B5)

When the user asks about their data, read it first. Be concise. Use A1 notation for cell references.

${buildSkillsPromptSection(skills)}
`;
}

export function thinkingLevelToAgent(level: ThinkingLevel): AgentThinkingLevel {
  return level === "none" ? "off" : level;
}

export function loadAgentRuntime(): Promise<AgentRuntime> {
  if (!agentRuntimePromise) {
    agentRuntimePromise = Promise.all([
      import("@mariozechner/pi-agent-core"),
      import("../../../lib/chat/provider-stream"),
      import("../../../lib/chat/model-resolution"),
      import("../../../lib/tools"),
    ]).then(([agentCore, piAi, modelResolution, tools]) => ({
      Agent: agentCore.Agent,
      streamSimple: piAi.streamSimple,
      resolveAgentModel: modelResolution.resolveAgentModel,
      EXCEL_TOOLS: tools.EXCEL_TOOLS,
    }));
  }

  return agentRuntimePromise;
}

export function loadVfsModule(): Promise<VfsModule> {
  if (!vfsModulePromise) {
    vfsModulePromise = import("../../../lib/vfs");
  }

  return vfsModulePromise;
}

export function getUploadNamesFromSnapshot(
  files: Array<{ path: string }>,
): UploadedFile[] {
  return files
    .filter(
      (file) =>
        file.path.startsWith("/home/user/uploads/") &&
        !file.path.endsWith("/.keep"),
    )
    .map((file) => ({
      name: file.path.split("/").pop() ?? file.path,
      size: 0,
    }));
}

export function createHandleAgentEvent<TState extends AgentEventState>(deps: {
  setState: Dispatch<SetStateAction<TState>>;
  agentRef: MutableRefObject<PiAgent | null>;
  streamingMessageIdRef: MutableRefObject<string | null>;
  followModeRef: MutableRefObject<boolean>;
  streamingTimeoutRef: MutableRefObject<number | null>;
  onFirstAssistantResponse?: () => void;
  onAgentEnd?: () => void;
}) {
  const {
    setState,
    agentRef,
    streamingMessageIdRef,
    followModeRef,
    streamingTimeoutRef,
    onFirstAssistantResponse,
    onAgentEnd,
  } = deps;

  return (event: AgentEvent) => {
    switch (event.type) {
      case "message_start": {
        if (event.message.role === "assistant") {
          onFirstAssistantResponse?.();
          const id = generateId();
          streamingMessageIdRef.current = id;
          const parts = extractPartsFromAssistantMessage(event.message);
          const chatMessage: ChatMessage = {
            id,
            role: "assistant",
            parts,
            timestamp: event.message.timestamp,
          };
          setState((prev) => ({
            ...prev,
            messages: [...prev.messages, chatMessage],
          }));
        }
        break;
      }
      case "message_update": {
        if (
          event.message.role === "assistant" &&
          streamingMessageIdRef.current
        ) {
          setState((prev) => {
            const messages = [...prev.messages];
            const idx = messages.findIndex(
              (m) => m.id === streamingMessageIdRef.current,
            );
            if (idx !== -1) {
              const parts = extractPartsFromAssistantMessage(
                event.message,
                messages[idx].parts,
              );
              messages[idx] = { ...messages[idx], parts };
            }
            return { ...prev, messages };
          });
        }
        break;
      }
      case "message_end": {
        if (event.message.role === "assistant") {
          const assistantMsg = event.message as AssistantMessage;
          const isError =
            assistantMsg.stopReason === "error" ||
            assistantMsg.stopReason === "aborted";

          setState((prev) => {
            const messages = [...prev.messages];
            const idx = messages.findIndex(
              (m) => m.id === streamingMessageIdRef.current,
            );

            if (isError) {
              if (idx !== -1) {
                messages.splice(idx, 1);
              }
            } else if (idx !== -1) {
              const parts = extractPartsFromAssistantMessage(
                event.message,
                messages[idx].parts,
              );
              messages[idx] = { ...messages[idx], parts };
            }

            return {
              ...prev,
              messages,
              error: isError
                ? assistantMsg.errorMessage || "Request failed"
                : prev.error,
              sessionStats: isError
                ? prev.sessionStats
                : {
                    ...deriveStats(agentRef.current?.state.messages ?? []),
                    contextWindow: prev.sessionStats.contextWindow,
                  },
            };
          });
          streamingMessageIdRef.current = null;
        }
        break;
      }
      case "tool_execution_start": {
        setState((prev) => {
          const messages = [...prev.messages];
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const partIdx = msg.parts.findIndex(
              (p) => p.type === "toolCall" && p.id === event.toolCallId,
            );
            if (partIdx !== -1) {
              const parts = [...msg.parts];
              const part = parts[partIdx];
              if (part.type === "toolCall") {
                parts[partIdx] = { ...part, status: "running" as const };
                messages[i] = { ...msg, parts };
              }
              break;
            }
          }
          return { ...prev, messages };
        });
        break;
      }
      case "tool_execution_update": {
        setState((prev) => {
          const messages = [...prev.messages];
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const partIdx = msg.parts.findIndex(
              (p) => p.type === "toolCall" && p.id === event.toolCallId,
            );
            if (partIdx !== -1) {
              const parts = [...msg.parts];
              const part = parts[partIdx];
              if (part.type === "toolCall") {
                let partialText: string;
                if (typeof event.partialResult === "string") {
                  partialText = event.partialResult;
                } else if (
                  event.partialResult?.content &&
                  Array.isArray(event.partialResult.content)
                ) {
                  partialText = event.partialResult.content
                    .filter((c: { type: string }) => c.type === "text")
                    .map((c: { text: string }) => c.text)
                    .join("\n");
                } else {
                  partialText = JSON.stringify(event.partialResult, null, 2);
                }
                parts[partIdx] = { ...part, result: partialText };
                messages[i] = { ...msg, parts };
              }
              break;
            }
          }
          return { ...prev, messages };
        });
        break;
      }
      case "tool_execution_end": {
        let resultText: string;
        let resultImages: { data: string; mimeType: string }[] | undefined;
        if (typeof event.result === "string") {
          resultText = event.result;
        } else if (
          event.result?.content &&
          Array.isArray(event.result.content)
        ) {
          resultText = event.result.content
            .filter((c: { type: string }) => c.type === "text")
            .map((c: { text: string }) => c.text)
            .join("\n");
          const images = event.result.content
            .filter((c: { type: string }) => c.type === "image")
            .map((c: { data: string; mimeType: string }) => ({
              data: c.data,
              mimeType: c.mimeType,
            }));
          if (images.length > 0) resultImages = images;
        } else {
          resultText = JSON.stringify(event.result, null, 2);
        }

        const toolFailed = event.isError || isToolResultErrorText(resultText);

        if (!toolFailed && followModeRef.current) {
          const dirtyRanges = parseDirtyRanges(resultText);
          if (dirtyRanges && dirtyRanges.length > 0) {
            const first = dirtyRanges[0];
            if (first.sheetId >= 0 && first.range !== "*") {
              navigateTo(first.sheetId, first.range).catch((err) => {
                console.error("[FollowMode] Navigation failed:", err);
              });
            } else if (first.sheetId >= 0) {
              navigateTo(first.sheetId).catch((err) => {
                console.error("[FollowMode] Navigation failed:", err);
              });
            }
          }
        }

        setState((prev) => {
          let toolErrorNotice: string | null = null;
          const messages = [...prev.messages];
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            const partIdx = msg.parts.findIndex(
              (p) => p.type === "toolCall" && p.id === event.toolCallId,
            );
            if (partIdx !== -1) {
              const parts = [...msg.parts];
              const part = parts[partIdx];
              if (part.type === "toolCall") {
                if (toolFailed) {
                  const reason = extractToolErrorMessage(resultText);
                  toolErrorNotice = `${part.name} failed: ${reason}`;
                }
                parts[partIdx] = {
                  ...part,
                  status: toolFailed ? "error" : "complete",
                  result: resultText,
                  images: resultImages,
                };
                messages[i] = { ...msg, parts };
              }
              break;
            }
          }
          return {
            ...prev,
            messages,
            error: toolErrorNotice ?? prev.error,
          };
        });
        break;
      }
      case "agent_end": {
        if (streamingTimeoutRef.current !== null) {
          window.clearTimeout(streamingTimeoutRef.current);
          streamingTimeoutRef.current = null;
        }
        setState((prev) => ({ ...prev, isStreaming: false }));
        streamingMessageIdRef.current = null;
        onAgentEnd?.();
        break;
      }
    }
    return undefined;
  };
}
