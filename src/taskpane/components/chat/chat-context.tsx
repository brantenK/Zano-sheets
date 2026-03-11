import {
  Agent,
  type AgentEvent,
  type ThinkingLevel as AgentThinkingLevel,
} from "@mariozechner/pi-agent-core";
import {
  type Api,
  type AssistantMessage,
  getModel,
  getModels,
  getProviders,
  type Model,
  streamSimple,
} from "@mariozechner/pi-ai";
import type { Context, ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { parseDirtyRanges } from "../../../lib/dirty-tracker";
import { getWorkbookMetadata, navigateTo } from "../../../lib/excel/api";
import { recordIntegrationTelemetry } from "../../../lib/integration-telemetry";
import {
  agentMessagesToChatMessages,
  type ChatMessage,
  deriveStats,
  extractPartsFromAssistantMessage,
  generateId,
  type SessionStats,
} from "../../../lib/message-utils";
import {
  loadOAuthCredentials,
  refreshOAuthToken,
  saveOAuthCredentials,
} from "../../../lib/oauth";
import {
  applyProxyToModel,
  buildCustomModel,
  evaluateProviderConfig,
  isProviderConfigReady,
  loadSavedConfig,
  type ProviderConfig,
  saveConfig,
  type ThinkingLevel,
} from "../../../lib/provider-config";
import type { KnowledgeBaseFileRecord } from "../../../lib/rag/types";
import {
  addSkill,
  buildSkillsPromptSection,
  getInstalledSkills,
  removeSkill,
  type SkillMeta,
  syncSkillsToVfs,
} from "../../../lib/skills";
import {
  type ChatSession,
  createSession,
  deleteSession,
  getLatestKnowledgeBaseFiles,
  getOrCreateCurrentSession,
  getOrCreateWorkbookId,
  getSession,
  listSessions,
  loadVfsFiles,
  saveSession,
  saveSessionKnowledgeBase,
  saveVfsFiles,
} from "../../../lib/storage";
import { EXCEL_TOOLS } from "../../../lib/tools";
import {
  addFileToKnowledgeBase,
  getKnowledgeBaseFiles,
  removeKnowledgeBaseFile as removeKnowledgeBaseFileRecord,
  replaceKnowledgeBaseFiles,
} from "../../../lib/tools/query-knowledge-base";
import {
  deleteFile,
  listUploads,
  resetVfs,
  restoreVfs,
  snapshotVfs,
  writeFile,
} from "../../../lib/vfs";

export type {
  ChatMessage,
  MessagePart,
  SessionStats,
  ToolCallStatus,
} from "../../../lib/message-utils";
export type { ProviderConfig, ThinkingLevel };

type ToolApprovalSetting = "auto" | "prompt";

const TOOL_APPROVAL_KEY = "zanosheets-tool-approval";
const DEFAULT_TOOL_APPROVAL: ToolApprovalSetting = "prompt";
const DESTRUCTIVE_TOOLS = new Set([
  "bash",
  "clear_cell_range",
  "copy_to",
  "eval_officejs",
  "modify_object",
  "modify_sheet_structure",
  "modify_workbook_structure",
  "resize_range",
  "set_cell_range",
]);

function getToolApprovalSetting(): ToolApprovalSetting {
  try {
    const stored = localStorage.getItem(TOOL_APPROVAL_KEY);
    if (stored === "auto" || stored === "prompt") {
      return stored;
    }
  } catch {
    // ignore storage failures
  }
  return DEFAULT_TOOL_APPROVAL;
}

export async function checkToolApproval(
  _toolCallId: string,
  toolName?: string,
): Promise<void> {
  const setting = getToolApprovalSetting();
  if (setting === "auto") return;
  if (toolName && !DESTRUCTIVE_TOOLS.has(toolName)) return;

  const label = toolName
    ? `Allow "${toolName}" to run? It may modify your workbook.`
    : "Allow this tool to run? It may modify your workbook.";
  const ok = window.confirm(label);
  if (!ok) {
    throw new Error("Tool execution cancelled by user.");
  }
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

export function getErrorMessage(err: unknown): string {
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

function formatAgentErrorMessage(err: unknown): string {
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

export interface UploadedFile {
  name: string;
  size: number;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  providerConfig: ProviderConfig | null;
  sessionStats: SessionStats;
  currentSession: ChatSession | null;
  sessions: ChatSession[];
  sheetNames: Record<number, string>;
  uploads: UploadedFile[];
  knowledgeBaseUploads: {
    name: string;
    displayName: string;
    createTime?: string;
  }[];
  isUploading: boolean;
  skills: SkillMeta[];
}

const INITIAL_STATS: SessionStats = { ...deriveStats([]), contextWindow: 0 };

interface ChatContextValue {
  state: ChatState;
  sendMessage: (content: string, attachments?: string[]) => Promise<void>;
  setProviderConfig: (config: ProviderConfig) => void;
  clearMessages: () => void;
  abort: () => void;
  availableProviders: string[];
  getModelsForProvider: (provider: string) => Model<Api>[];
  newSession: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  deleteCurrentSession: () => Promise<void>;
  getSheetName: (sheetId: number) => string | undefined;
  toggleFollowMode: () => void;
  processFiles: (files: File[]) => Promise<void>;
  processKnowledgeBaseFiles: (files: File[]) => Promise<void>;
  removeKnowledgeBaseFile: (name: string) => Promise<boolean>;
  removeUpload: (name: string) => Promise<void>;
  installSkill: (files: File[]) => Promise<void>;
  uninstallSkill: (name: string) => Promise<void>;
}

const globalWithChatContext = globalThis as typeof globalThis & {
  __zanosheets_chat_context__?: Context<ChatContextValue | null>;
};

const ChatContext =
  globalWithChatContext.__zanosheets_chat_context__ ??
  createContext<ChatContextValue | null>(null);

if (!globalWithChatContext.__zanosheets_chat_context__) {
  globalWithChatContext.__zanosheets_chat_context__ = ChatContext;
}

const EMPTY_CHAT_STATE: ChatState = {
  messages: [],
  isStreaming: false,
  error: null,
  providerConfig: null,
  sessionStats: INITIAL_STATS,
  currentSession: null,
  sessions: [],
  sheetNames: {},
  uploads: [],
  knowledgeBaseUploads: [],
  isUploading: false,
  skills: [],
};

const FALLBACK_CHAT_CONTEXT: ChatContextValue = {
  state: EMPTY_CHAT_STATE,
  sendMessage: async () => {},
  setProviderConfig: () => {},
  clearMessages: () => {},
  abort: () => {},
  availableProviders: [],
  getModelsForProvider: () => [],
  newSession: async () => {},
  switchSession: async () => {},
  deleteCurrentSession: async () => {},
  getSheetName: () => undefined,
  toggleFollowMode: () => {},
  processFiles: async () => {},
  processKnowledgeBaseFiles: async () => {},
  removeKnowledgeBaseFile: async () => false,
  removeUpload: async () => {},
  installSkill: async () => {},
  uninstallSkill: async () => {},
};

function buildSystemPrompt(skills: SkillMeta[]): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

  return `IMPORTANT: Today's date is ${today}.

Current date reference: ${today}
- When answering questions about dates, time, or "today", use ${today} as the current date
- DO NOT make up or hallucinate dates - always use ${today} when the user asks about today
- If you need current date/time, use ${today}

You are an AI assistant integrated into Microsoft Excel with full access to read and modify spreadsheet data.

Available tools:

FILES & SHELL:
- read: Read uploaded files (images, PDFs, CSV, text). Images are returned for visual analysis. PDFs are rendered into page images for visual analysis.
- prepare_invoice_batch: Preflight multiple invoice PDFs. Renders lightweight preview pages into the VFS, checks whether embedded PDF text is usable, and returns structured per-file summaries plus preview image paths. Prefer this first when many invoices are attached.
- bash: Execute bash commands in a sandboxed virtual filesystem. User uploads are in /home/user/uploads/.
  Supports: ls, cat, grep, find, awk, sed, jq, sort, uniq, wc, cut, head, tail, etc.
- web-search: Search the web directly using the configured search provider. Prefer this for ordinary web lookups.
- web-fetch: Fetch a URL directly using the configured fetch provider and return readable page content. Prefer this for ordinary page retrieval.

  Bash custom commands for efficient data transfer (data flows directly, never enters your context):
  - csv-to-sheet <file> <sheetId> [startCell] [--force] -- Import CSV from VFS into spreadsheet. Auto-detects types.
    Fails if target cells already have data. Use --force to overwrite (confirm with user first).
  - sheet-to-csv <sheetId> [range] [file] -- Export range to CSV. Defaults to full used range if no range given. Prints to stdout if no file given (pipeable).
  - pdf-to-text <file> <outfile> -- Extract text from PDF to file. Use head/grep/tail to read selectively.
  - pdf-to-images <file> <outdir> [--scale=N] [--pages=1,3,5-8] -- Render PDF pages to PNG images. Use for scanned PDFs where text extraction won't work. Then use read to visually inspect the images.
  - docx-to-text <file> <outfile> -- Extract text from DOCX to file.
  - xlsx-to-csv <file> <outfile> [sheet] -- Convert XLSX/XLS/ODS sheet to CSV. Sheet by name or 0-based index.
  - image-to-sheet <file> <width> <height> <sheetId> [startCell] [--cell-size=N] -- Render an image as pixel art in Excel. Downsamples to target size and paints cell backgrounds. Cell size in points (default: 3). Max 500x500. Example: image-to-sheet uploads/logo.png 64 64 1 A1 --cell-size=4
  - web-search <query> [--max=N] [--region=REGION] [--time=d|w|m|y] [--page=N] [--json] -- Bash subcommand form for search when you need piping or shell workflows.
  - web-fetch <url> <outfile> -- Bash subcommand form for fetching into a sandbox file when you need piping or file output.

  Examples:
    csv-to-sheet uploads/data.csv 1 A1       # import CSV to sheet 1
    sheet-to-csv 1 export.csv                 # export entire sheet to file
    sheet-to-csv 1 A1:D100 export.csv         # export specific range to file
    sheet-to-csv 1 | sort -t, -k3 -rn | head -20   # pipe entire sheet to analysis
    cut -d, -f1,3 uploads/data.csv > filtered.csv && csv-to-sheet filtered.csv 1 A1  # filter then import
    bash: web-search "S&P 500 companies list"       # search the web inside bash
    bash: web-search "USD EUR exchange rate" --max=5 --time=w  # recent results only inside bash
    bash: web-fetch https://example.com/article page.txt && grep -i "revenue" page.txt  # fetch then grep

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
  - Prefer direct Excel/read/web tools first.
  - Use the direct web-search and web-fetch tools for ordinary web lookups.
  - Use bash only when you specifically need shell-style processing, pipes, or sandbox file output. If you use bash for web access, run the web-search/web-fetch subcommands inside the bash tool rather than calling them as separate tools.
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
    Do NOT just report the error and stop -- always prompt the user for confirmation first.
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

function thinkingLevelToAgent(level: ThinkingLevel): AgentThinkingLevel {
  return level === "none" ? "off" : level;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ChatState>(() => {
    const saved = loadSavedConfig();
    const initialConfig = saved ?? null;
    return {
      messages: [],
      isStreaming: false,
      error: null,
      providerConfig: initialConfig,
      sessionStats: INITIAL_STATS,
      currentSession: null,
      sessions: [],
      sheetNames: {},
      uploads: [],
      knowledgeBaseUploads: [],
      isUploading: false,
      skills: [],
    };
  });

  const agentRef = useRef<Agent | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);
  const isStreamingRef = useRef(false);
  const pendingConfigRef = useRef<ProviderConfig | null>(null);
  const workbookIdRef = useRef<string | null>(null);
  const sessionLoadedRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(null);
  const followModeRef = useRef(state.providerConfig?.followMode ?? true);
  const skillsRef = useRef<SkillMeta[]>([]);
  const streamingTimeoutRef = useRef<number | null>(null);
  const replaceKnowledgeBaseToolFiles = useCallback(
    async (files: KnowledgeBaseFileRecord[]) => {
      replaceKnowledgeBaseFiles(files);
    },
    [],
  );

  const availableProviders = getProviders();

  const getModelsForProvider = useCallback((provider: string): Model<Api>[] => {
    try {
      return getModels(provider as unknown as never) as Model<Api>[];
    } catch {
      return [];
    }
  }, []);

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case "message_start": {
        if (event.message.role === "assistant") {
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
                // Always use "running" status -- no pending/awaiting approval
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
              // For whole-sheet changes, just activate the sheet
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
        // Clear streaming timeout
        if (streamingTimeoutRef.current !== null) {
          window.clearTimeout(streamingTimeoutRef.current);
          streamingTimeoutRef.current = null;
        }
        isStreamingRef.current = false;
        setState((prev) => ({ ...prev, isStreaming: false }));
        streamingMessageIdRef.current = null;
        break;
      }
    }
    return undefined;
  }, []);

  const configRef = useRef<ProviderConfig | null>(null);

  const getActiveApiKey = useCallback(
    async (
      config: ProviderConfig,
      options?: { forceRefresh?: boolean },
    ): Promise<string> => {
      const forceRefresh = options?.forceRefresh ?? false;
      if (config.authMethod !== "oauth") {
        return config.apiKey;
      }
      const creds = loadOAuthCredentials(config.provider);
      if (!creds) return config.apiKey;
      if (!forceRefresh && Date.now() < creds.expires) {
        return creds.access;
      }
      const refreshed = await refreshOAuthToken(
        config.provider,
        creds.refresh,
        config.proxyUrl,
        config.useProxy,
      );
      saveOAuthCredentials(config.provider, refreshed);
      return refreshed.access;
    },
    [],
  );

  const applyConfig = useCallback(
    (config: ProviderConfig) => {
      let contextWindow = 0;
      let baseModel: Model<Api>;
      if (config.provider === "custom") {
        const custom = buildCustomModel(config);
        if (!custom) return;
        baseModel = custom;
      } else {
        try {
          baseModel = getModel(
            config.provider as unknown as never,
            config.model as unknown as never,
          ) as Model<Api>;
        } catch {
          return;
        }
      }
      contextWindow = baseModel.contextWindow;
      configRef.current = config;

      const proxiedModel = applyProxyToModel(baseModel, config);
      const existingMessages = agentRef.current?.state.messages ?? [];

      if (agentRef.current) {
        agentRef.current.abort();
      }

      const systemPrompt = buildSystemPrompt(skillsRef.current);

      const agent = new Agent({
        initialState: {
          model: proxiedModel,
          systemPrompt,
          thinkingLevel: thinkingLevelToAgent(config.thinking),
          tools: EXCEL_TOOLS,
          messages: existingMessages,
        },
        streamFn: async (model, context, options) => {
          const cfg = configRef.current ?? config;
          let apiKey = await getActiveApiKey(cfg);

          // Retry logic with exponential backoff + jitter for transient failures
          const maxRetries = 3;
          let lastError: unknown = null;

          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              return await streamSimple(model, context, {
                ...options,
                apiKey,
              });
            } catch (err: unknown) {
              lastError = err;

              const isUnauthorized =
                typeof err === "object" &&
                err !== null &&
                (("status" in err &&
                  (err as { status?: number }).status === 401) ||
                  ("message" in err &&
                    typeof (err as { message?: string }).message === "string" &&
                    ((err as { message: string }).message.includes("401") ||
                      (err as { message: string }).message
                        .toLowerCase()
                        .includes("unauthorized") ||
                      (err as { message: string }).message
                        .toLowerCase()
                        .includes("invalid api key"))));

              if (
                isUnauthorized &&
                cfg.authMethod === "oauth" &&
                attempt < maxRetries
              ) {
                recordIntegrationTelemetry("oauth_refresh_retry", 401);
                apiKey = await getActiveApiKey(cfg, { forceRefresh: true });
                continue;
              }

              if (isRetryableProviderError(err) && attempt < maxRetries) {
                recordIntegrationTelemetry(
                  "transient_retry",
                  getErrorStatus(err),
                );
                const baseDelayMs = 2 ** attempt * 1000;
                const jitterMs = Math.floor(Math.random() * 300);
                const delayMs = baseDelayMs + jitterMs;
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                continue;
              }

              // For non-rate-limit errors or final attempt, throw
              throw err;
            }
          }

          recordIntegrationTelemetry(
            "provider_final_error",
            getErrorStatus(lastError),
          );
          throw new Error(formatAgentErrorMessage(lastError));
        },
      });
      agentRef.current = agent;
      agent.subscribe(handleAgentEvent);
      pendingConfigRef.current = null;

      followModeRef.current = config.followMode ?? true;

      setState((prev) => ({
        ...prev,
        providerConfig: config,
        error: null,
        sessionStats: { ...prev.sessionStats, contextWindow },
      }));
    },
    [handleAgentEvent, getActiveApiKey],
  );

  const setProviderConfig = useCallback(
    (config: ProviderConfig) => {
      setState((prev) => ({ ...prev, providerConfig: config }));

      if (isStreamingRef.current) {
        pendingConfigRef.current = config;
        return;
      }

      if (!isProviderConfigReady(config)) {
        return;
      }

      applyConfig(config);
    },
    [applyConfig],
  );

  const abort = useCallback(() => {
    // Clear streaming timeout if set
    if (streamingTimeoutRef.current !== null) {
      window.clearTimeout(streamingTimeoutRef.current);
      streamingTimeoutRef.current = null;
    }
    agentRef.current?.abort();
    isStreamingRef.current = false;
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const sendMessage = useCallback(
    async (content: string, attachments?: string[]) => {
      if (!state.providerConfig) {
        setState((prev) => ({
          ...prev,
          error: "Please configure your API key first",
        }));
        return;
      }

      const configHealth = evaluateProviderConfig(state.providerConfig);
      if (configHealth.blocking.length > 0) {
        setState((prev) => ({
          ...prev,
          error: configHealth.blocking[0],
        }));
        return;
      }

      if (pendingConfigRef.current) {
        applyConfig(pendingConfigRef.current);
      }
      const agent = agentRef.current;
      if (!agent) {
        setState((prev) => ({
          ...prev,
          error: "Please configure your API key first",
        }));
        return;
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        parts: [{ type: "text", text: content }],
        timestamp: Date.now(),
      };

      isStreamingRef.current = true;
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isStreaming: true,
        error: null,
      }));

      try {
        let promptContent = content;
        const pdfAttachments = (attachments ?? []).filter((name) =>
          /\.pdf$/i.test(name),
        );
        try {
          const metadata = await getWorkbookMetadata();
          promptContent = `<wb_context>\n${JSON.stringify(metadata, null, 2)}\n</wb_context>\n\n${content}`;

          if (metadata.sheetsMetadata) {
            const newSheetNames: Record<number, string> = {};
            for (const sheet of metadata.sheetsMetadata) {
              newSheetNames[sheet.id] = sheet.name;
            }
            setState((prev) => ({ ...prev, sheetNames: newSheetNames }));
          }
        } catch (err) {
          console.error("[Chat] Failed to get workbook metadata:", err);
          setState((prev) => ({
            ...prev,
            error:
              prev.error ??
              "Could not read workbook context; continuing without workbook metadata.",
          }));
        }

        // Add attachments section if files are uploaded
        if (attachments && attachments.length > 0) {
          const paths = attachments
            .map((name) => `/home/user/uploads/${name}`)
            .join("\n");
          promptContent = `<attachments>\n${paths}\n</attachments>\n\n${promptContent}`;
        }

        if (pdfAttachments.length > 0) {
          promptContent = `<pdf_handling_hint>\n${[
            "For uploaded PDFs used for extraction tasks, prefer image-based OCR.",
            pdfAttachments.length >= 2
              ? "If multiple invoices are attached, call prepare_invoice_batch first so you can inspect them incrementally with preview summaries and preview image paths."
              : "",
            "If the document looks like a scanned invoice, receipt, or statement, use pdf-to-images first and inspect the resulting PNG pages with read.",
            "Use pdf-to-text only when the PDF clearly has an embedded text layer or the user explicitly asks for raw text extraction.",
            pdfAttachments.length >= 4
              ? "Multiple PDFs are attached. Process them incrementally: inspect one invoice at a time, start with the first page, and only read extra pages when needed. Avoid reading all invoice pages into context at once."
              : "",
          ].join("\n")}\n</pdf_handling_hint>\n\n${promptContent}`;
        }

        // Set up streaming timeout (5 minutes)
        const STREAMING_TIMEOUT_MS = 5 * 60 * 1000;
        streamingTimeoutRef.current = window.setTimeout(() => {
          console.error("[Chat] Streaming timeout reached, aborting agent");
          recordIntegrationTelemetry("stream_stall_timeout", undefined);
          // Abort the agent if it's still running
          if (isStreamingRef.current) {
            agentRef.current?.abort();
            isStreamingRef.current = false;
            streamingTimeoutRef.current = null;
            setState((prev) => ({
              ...prev,
              isStreaming: false,
              error: "Request timed out after 5 minutes. Please try again.",
            }));
          }
        }, STREAMING_TIMEOUT_MS);

        await agent.prompt(promptContent);
      } catch (err) {
        // Clear streaming timeout on error
        if (streamingTimeoutRef.current !== null) {
          window.clearTimeout(streamingTimeoutRef.current);
          streamingTimeoutRef.current = null;
        }
        console.error("[Chat] sendMessage error:", err);
        recordIntegrationTelemetry("send_message_error", getErrorStatus(err));
        isStreamingRef.current = false;
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: formatAgentErrorMessage(err),
        }));
      }
    },
    [state.providerConfig, applyConfig],
  );

  const clearMessages = useCallback(() => {
    abort();
    agentRef.current?.reset();
    resetVfs();
    if (currentSessionIdRef.current) {
      Promise.all([
        saveSession(currentSessionIdRef.current, []),
        saveVfsFiles(
          workbookIdRef.current || "",
          currentSessionIdRef.current,
          [],
        ),
      ]).catch(console.error);
    }
    setState((prev) => ({
      ...prev,
      messages: [],
      error: null,
      sessionStats: INITIAL_STATS,
      uploads: [],
    }));
  }, [abort]);

  const refreshSessions = useCallback(async () => {
    if (!workbookIdRef.current) return;
    const sessions = await listSessions(workbookIdRef.current);
    setState((prev) => ({ ...prev, sessions }));
  }, []);

  const newSession = useCallback(async () => {
    if (!workbookIdRef.current) {
      console.error("[Chat] Cannot create session: workbookId not set");
      return;
    }
    if (isStreamingRef.current) {
      return;
    }
    try {
      agentRef.current?.reset();
      resetVfs();
      const latestKb = await getLatestKnowledgeBaseFiles(workbookIdRef.current);
      await replaceKnowledgeBaseToolFiles(latestKb);
      const session = await createSession(workbookIdRef.current);
      currentSessionIdRef.current = session.id;
      await refreshSessions();
      if (latestKb.length > 0) {
        await saveSessionKnowledgeBase(session.id, latestKb);
      }
      setState((prev) => ({
        ...prev,
        messages: [],
        currentSession: session,
        error: null,
        sessionStats: INITIAL_STATS,
        uploads: [],
        knowledgeBaseUploads: latestKb.map((kb) => ({
          name: kb.name,
          displayName: kb.displayName,
          createTime: kb.createTime,
        })),
      }));
    } catch (err) {
      console.error("[Chat] Failed to create session:", err);
    }
  }, [refreshSessions, replaceKnowledgeBaseToolFiles]);

  const switchSession = useCallback(
    async (sessionId: string) => {
      if (currentSessionIdRef.current === sessionId) return;
      if (isStreamingRef.current) {
        return;
      }
      agentRef.current?.reset();
      try {
        const [session, vfsFiles] = await Promise.all([
          getSession(sessionId),
          loadVfsFiles(sessionId),
        ]);
        if (!session) {
          console.error("[Chat] Session not found:", sessionId);
          return;
        }
        await restoreVfs(vfsFiles);
        currentSessionIdRef.current = session.id;

        if (session.agentMessages.length > 0 && agentRef.current) {
          agentRef.current.replaceMessages(session.agentMessages);
        }

        const uploadNames = await listUploads();
        const stats = deriveStats(session.agentMessages);
        const latestKb = await getLatestKnowledgeBaseFiles(session.workbookId);
        await replaceKnowledgeBaseToolFiles(latestKb);

        setState((prev) => ({
          ...prev,
          messages: agentMessagesToChatMessages(session.agentMessages),
          currentSession: session,
          error: null,
          sessionStats: {
            ...stats,
            contextWindow: prev.sessionStats.contextWindow,
          },
          uploads: uploadNames.map((name) => ({ name, size: 0 })),
          knowledgeBaseUploads: latestKb.map((kb) => ({
            name: kb.name,
            displayName: kb.displayName,
            createTime: kb.createTime,
          })),
        }));
      } catch (err) {
        console.error("[Chat] Failed to switch session:", err);
      }
    },
    [replaceKnowledgeBaseToolFiles],
  );

  const deleteCurrentSession = useCallback(async () => {
    if (!currentSessionIdRef.current || !workbookIdRef.current) return;
    if (isStreamingRef.current) {
      return;
    }
    agentRef.current?.reset();
    const deletedId = currentSessionIdRef.current;
    await Promise.all([
      deleteSession(deletedId),
      saveVfsFiles(workbookIdRef.current || "", deletedId, []),
    ]);
    const session = await getOrCreateCurrentSession(workbookIdRef.current);
    currentSessionIdRef.current = session.id;
    const vfsFiles = await loadVfsFiles(session.id);
    await restoreVfs(vfsFiles);

    if (session.agentMessages.length > 0 && agentRef.current) {
      agentRef.current.replaceMessages(session.agentMessages);
    }

    await refreshSessions();
    const uploadNames = await listUploads();
    const stats = deriveStats(session.agentMessages);
    const latestKb = await getLatestKnowledgeBaseFiles(session.workbookId);
    await replaceKnowledgeBaseToolFiles(latestKb);

    setState((prev) => ({
      ...prev,
      messages: agentMessagesToChatMessages(session.agentMessages),
      currentSession: session,
      error: null,
      sessionStats: {
        ...stats,
        contextWindow: prev.sessionStats.contextWindow,
      },
      uploads: uploadNames.map((name) => ({ name, size: 0 })),
      knowledgeBaseUploads: latestKb.map((kb) => ({
        name: kb.name,
        displayName: kb.displayName,
        createTime: kb.createTime,
      })),
    }));
  }, [refreshSessions, replaceKnowledgeBaseToolFiles]);

  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (
      prevStreamingRef.current &&
      !state.isStreaming &&
      currentSessionIdRef.current
    ) {
      const sessionId = currentSessionIdRef.current;
      const agentMessages = agentRef.current?.state.messages ?? [];
      // Snapshot VFS first (returns native Promise), then save to IndexedDB.
      (async () => {
        try {
          const vfsFiles = await snapshotVfs();
          await Promise.all([
            saveSession(sessionId, agentMessages),
            saveVfsFiles(workbookIdRef.current || "", sessionId, vfsFiles),
          ]);
          await refreshSessions();
          const updated = await getSession(sessionId);
          if (updated) {
            setState((prev) => ({ ...prev, currentSession: updated }));
          }
        } catch (e) {
          console.error(e);
        }
      })();
    }
    prevStreamingRef.current = state.isStreaming;
  }, [state.isStreaming, refreshSessions]);

  useEffect(() => {
    return () => {
      agentRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (sessionLoadedRef.current) return;
    sessionLoadedRef.current = true;

    getOrCreateWorkbookId()
      .then(async (id) => {
        workbookIdRef.current = id;

        // Load skills into VFS cache BEFORE applyConfig so the system prompt includes them
        const skills = await getInstalledSkills();
        skillsRef.current = skills;
        await syncSkillsToVfs();

        // Now apply provider config -- agent gets the correct system prompt with skills
        const saved = loadSavedConfig();
        if (saved && isProviderConfigReady(saved)) {
          applyConfig(saved);
        }

        const session = await getOrCreateCurrentSession(id);
        currentSessionIdRef.current = session.id;
        const [sessions, vfsFiles] = await Promise.all([
          listSessions(id),
          loadVfsFiles(session.id),
        ]);
        if (vfsFiles.length > 0) {
          await restoreVfs(vfsFiles);
        }

        if (session.agentMessages.length > 0 && agentRef.current) {
          agentRef.current.replaceMessages(session.agentMessages);
        }

        const uploadNames = await listUploads();
        const stats = deriveStats(session.agentMessages);
        const latestKb = await getLatestKnowledgeBaseFiles(session.workbookId);
        await replaceKnowledgeBaseToolFiles(latestKb);
        setState((prev) => ({
          ...prev,
          messages: agentMessagesToChatMessages(session.agentMessages),
          currentSession: session,
          sessions,
          skills,
          sessionStats: {
            ...stats,
            contextWindow: prev.sessionStats.contextWindow,
          },
          uploads: uploadNames.map((name) => ({ name, size: 0 })),
          knowledgeBaseUploads: latestKb.map((kb) => ({
            name: kb.name,
            displayName: kb.displayName,
            createTime: kb.createTime,
          })),
        }));
      })
      .catch((err) => {
        console.error("[Chat] Failed to load session:", err);
      });
  }, [applyConfig, replaceKnowledgeBaseToolFiles]);

  const getSheetName = useCallback(
    (sheetId: number): string | undefined => state.sheetNames[sheetId],
    [state.sheetNames],
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setState((prev) => ({ ...prev, isUploading: true }));
      try {
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        const MAX_VFS_SIZE = 150 * 1024 * 1024; // 150MB

        let currentVfsSize = state.uploads.reduce((acc, u) => acc + u.size, 0);

        const uploadSizeByName = new Map(
          state.uploads.map((u) => [u.name, u.size] as const),
        );

        for (const file of files) {
          if (file.size > MAX_FILE_SIZE) {
            throw new Error(
              `File '${file.name}' is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max allowed is 50MB.`,
            );
          }
          const previousSize = uploadSizeByName.get(file.name) ?? 0;
          const nextSize = currentVfsSize - previousSize + file.size;
          if (nextSize > MAX_VFS_SIZE) {
            throw new Error(
              "Virtual Filesystem is full (150MB limit). Please remove some files before uploading more.",
            );
          }

          const buffer = await file.arrayBuffer();
          const data = new Uint8Array(buffer);
          await writeFile(file.name, data);
          uploadSizeByName.set(file.name, file.size);
          currentVfsSize = nextSize;
          setState((prev) => {
            const exists = prev.uploads.some((u) => u.name === file.name);
            if (exists) {
              return {
                ...prev,
                uploads: prev.uploads.map((u) =>
                  u.name === file.name
                    ? { name: file.name, size: file.size }
                    : u,
                ),
              };
            }
            return {
              ...prev,
              uploads: [...prev.uploads, { name: file.name, size: file.size }],
            };
          });
        }
        if (currentSessionIdRef.current && workbookIdRef.current) {
          const snapshot = await snapshotVfs();
          await saveVfsFiles(
            workbookIdRef.current,
            currentSessionIdRef.current,
            snapshot,
          );
        }
      } catch (err) {
        console.error("Failed to upload file:", err);
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to upload file",
        }));
      } finally {
        setState((prev) => ({ ...prev, isUploading: false }));
      }
    },
    [state.uploads],
  );

  const removeUpload = useCallback(async (name: string) => {
    try {
      await deleteFile(name);
      setState((prev) => ({
        ...prev,
        uploads: prev.uploads.filter((u) => u.name !== name),
      }));
      if (currentSessionIdRef.current && workbookIdRef.current) {
        const snapshot = await snapshotVfs();
        await saveVfsFiles(
          workbookIdRef.current,
          currentSessionIdRef.current,
          snapshot,
        );
      }
    } catch (err) {
      console.error("Failed to delete file:", err);
      setState((prev) => ({
        ...prev,
        uploads: prev.uploads.filter((u) => u.name !== name),
      }));
    }
  }, []);

  const processKnowledgeBaseFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    setState((prev) => ({ ...prev, isUploading: true }));
    try {
      const { uploadFileToGemini } = await import(
        "../../../lib/rag/gemini-file-store"
      );

      for (const file of files) {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `File '${file.name}' is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max allowed is 20MB.`,
          );
        }
        const geminiFile = await uploadFileToGemini(file, file.name, file.type);
        addFileToKnowledgeBase(geminiFile);
      }

      const knowledgeBaseFiles = getKnowledgeBaseFiles();
      setState((prev) => ({
        ...prev,
        knowledgeBaseUploads: knowledgeBaseFiles.map((kb) => ({
          name: kb.name,
          displayName: kb.displayName,
          createTime: kb.createTime,
        })),
      }));
      if (currentSessionIdRef.current) {
        await saveSessionKnowledgeBase(
          currentSessionIdRef.current,
          knowledgeBaseFiles,
        );
      }
    } catch (err) {
      console.error("Failed to upload to Knowledge Base:", err);
      setState((prev) => ({
        ...prev,
        error:
          err instanceof Error
            ? err.message
            : "Failed to upload to Knowledge Base",
      }));
    } finally {
      setState((prev) => ({ ...prev, isUploading: false }));
    }
  }, []);

  const removeKnowledgeBaseFile = useCallback(async (name: string) => {
    try {
      removeKnowledgeBaseFileRecord(name);
      const remaining = getKnowledgeBaseFiles();
      setState((prev) => ({
        ...prev,
        knowledgeBaseUploads: remaining.map((kb) => ({
          name: kb.name,
          displayName: kb.displayName,
          createTime: kb.createTime,
        })),
      }));
      if (currentSessionIdRef.current) {
        await saveSessionKnowledgeBase(currentSessionIdRef.current, remaining);
      }
      return true;
    } catch (err) {
      console.error("Failed to remove Knowledge Base file:", err);
      setState((prev) => ({
        ...prev,
        error:
          err instanceof Error
            ? err.message
            : "Failed to remove Knowledge Base file",
      }));
      return false;
    }
  }, []);
  const refreshSkillsAndRebuildAgent = useCallback(async () => {
    skillsRef.current = await getInstalledSkills();
    setState((prev) => {
      // Re-apply config to rebuild agent with updated system prompt
      if (prev.providerConfig) {
        applyConfig(prev.providerConfig);
      }
      return { ...prev, skills: skillsRef.current };
    });
  }, [applyConfig]);

  const installSkill = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      try {
        const inputs = await Promise.all(
          files.map(async (f) => {
            // For folder uploads, webkitRelativePath is "folderName/file.md"
            // Strip the top-level folder to get the relative path within the skill
            const fullPath = f.webkitRelativePath || f.name;
            const parts = fullPath.split("/");
            const path = parts.length > 1 ? parts.slice(1).join("/") : parts[0];
            return { path, data: new Uint8Array(await f.arrayBuffer()) };
          }),
        );
        await addSkill(inputs);
        await refreshSkillsAndRebuildAgent();
      } catch (err) {
        console.error("[Chat] Failed to install skill:", err);
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to install skill",
        }));
      }
    },
    [refreshSkillsAndRebuildAgent],
  );

  const uninstallSkill = useCallback(
    async (name: string) => {
      try {
        await removeSkill(name);
        await refreshSkillsAndRebuildAgent();
      } catch (err) {
        console.error("[Chat] Failed to uninstall skill:", err);
      }
    },
    [refreshSkillsAndRebuildAgent],
  );

  const toggleFollowMode = useCallback(() => {
    setState((prev) => {
      if (!prev.providerConfig) return prev;
      const newFollowMode = !prev.providerConfig.followMode;
      followModeRef.current = newFollowMode;
      const newConfig = { ...prev.providerConfig, followMode: newFollowMode };
      saveConfig(newConfig);
      return { ...prev, providerConfig: newConfig };
    });
  }, []);

  return (
    <ChatContext.Provider
      value={{
        state,
        sendMessage,
        setProviderConfig,
        clearMessages,
        abort,
        availableProviders,
        getModelsForProvider,
        newSession,
        switchSession,
        deleteCurrentSession,
        getSheetName,
        toggleFollowMode,
        processFiles,
        processKnowledgeBaseFiles,
        removeKnowledgeBaseFile,
        removeUpload,
        installSkill,
        uninstallSkill,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Chat] useChat called without ChatProvider; using fallback context",
      );
      return FALLBACK_CHAT_CONTEXT;
    }
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
