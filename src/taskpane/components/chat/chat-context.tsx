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
import type { DirtyRange } from "../../../lib/dirty-tracker";
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
  getOrCreateCurrentSession,
  getOrCreateWorkbookId,
  getSession,
  listSessions,
  loadVfsFiles,
  saveSession,
  saveVfsFiles,
} from "../../../lib/storage";
import { EXCEL_TOOLS } from "../../../lib/tools";
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

// --- Global Tool Approval Gate ---
let globalConfirmToolCall: ((id: string, confirmed: boolean) => void) | null =
  null;
// Tracks whether review mode is currently active — kept in sync with
// reviewModeRef so checkToolApproval can short-circuit without React state.
let reviewModeActive = false;
const pendingApprovals = new Map<string, (confirmed: boolean) => void>();

/**
 * Resolve or reject every pending approval promise.
 * Pass confirmed=true to auto-approve (e.g. review mode toggled off mid-stream).
 * Pass confirmed=false to reject (e.g. stream ended with tools still waiting).
 */
function drainPendingApprovals(confirmed: boolean): void {
  for (const [id, cb] of pendingApprovals) {
    cb(confirmed);
    pendingApprovals.delete(id);
  }
}

export async function checkToolApproval(toolCallId: string): Promise<void> {
  // Short-circuit when review mode is inactive — no gate needed.
  if (!globalConfirmToolCall || !reviewModeActive) return;

  return new Promise((resolve, reject) => {
    pendingApprovals.set(toolCallId, (confirmed) => {
      if (confirmed) resolve();
      else reject(new Error("Action declined by user."));
    });
  });
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

  return trimmed.length > 220 ? `${trimmed.slice(0, 220)}…` : trimmed;
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
  isUploading: boolean;
  skills: SkillMeta[];
  reviewMode: boolean;
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
  toggleReviewMode: () => void;
  confirmToolCall: (toolCallId: string, confirmed: boolean) => void;
  processFiles: (files: File[]) => Promise<void>;
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
  isUploading: false,
  skills: [],
  reviewMode: false,
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
  toggleReviewMode: () => {},
  confirmToolCall: () => {},
  processFiles: async () => {},
  removeUpload: async () => {},
  installSkill: async () => {},
  uninstallSkill: async () => {},
};

function buildSystemPrompt(skills: SkillMeta[]): string {
  return `You are an AI assistant integrated into Microsoft Excel with full access to read and modify spreadsheet data.

Available tools:

FILES & SHELL:
- read: Read uploaded files (images, CSV, text). Images are returned for visual analysis.
- bash: Execute bash commands in a sandboxed virtual filesystem. User uploads are in /home/user/uploads/.
  Supports: ls, cat, grep, find, awk, sed, jq, sort, uniq, wc, cut, head, tail, etc.

  Custom commands for efficient data transfer (data flows directly, never enters your context):
  - csv-to-sheet <file> <sheetId> [startCell] [--force] — Import CSV from VFS into spreadsheet. Auto-detects types.
    Fails if target cells already have data. Use --force to overwrite (confirm with user first).
  - sheet-to-csv <sheetId> [range] [file] — Export range to CSV. Defaults to full used range if no range given. Prints to stdout if no file given (pipeable).
  - pdf-to-text <file> <outfile> — Extract text from PDF to file. Use head/grep/tail to read selectively.
  - pdf-to-images <file> <outdir> [--scale=N] [--pages=1,3,5-8] — Render PDF pages to PNG images. Use for scanned PDFs where text extraction won't work. Then use read to visually inspect the images.
  - docx-to-text <file> <outfile> — Extract text from DOCX to file.
  - xlsx-to-csv <file> <outfile> [sheet] — Convert XLSX/XLS/ODS sheet to CSV. Sheet by name or 0-based index.
  - image-to-sheet <file> <width> <height> <sheetId> [startCell] [--cell-size=N] — Render an image as pixel art in Excel. Downsamples to target size and paints cell backgrounds. Cell size in points (default: 3). Max 500×500. Example: image-to-sheet uploads/logo.png 64 64 1 A1 --cell-size=4
  - web-search <query> [--max=N] [--region=REGION] [--time=d|w|m|y] [--page=N] [--json] — Search the web. Returns title, URL, and snippet for each result.
  - web-fetch <url> <outfile> — Fetch a web page and extract its readable content to a file. Use head/grep/tail to read selectively.

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

  EXECUTION HONESTY:
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
    Do NOT just report the error and stop — always prompt the user for confirmation first.
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
      isUploading: false,
      skills: [],
      reviewMode: false,
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
  const reviewModeRef = useRef(false);
  const skillsRef = useRef<SkillMeta[]>([]);

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
                const status = reviewModeRef.current ? "pending" : "running";
                parts[partIdx] = { ...part, status };
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

        await agent.prompt(promptContent);
      } catch (err) {
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
      const session = await createSession(workbookIdRef.current);
      currentSessionIdRef.current = session.id;
      await refreshSessions();
      setState((prev) => ({
        ...prev,
        messages: [],
        currentSession: session,
        error: null,
        sessionStats: INITIAL_STATS,
        uploads: [],
      }));
    } catch (err) {
      console.error("[Chat] Failed to create session:", err);
    }
  }, [refreshSessions]);

  const switchSession = useCallback(async (sessionId: string) => {
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
      }));
    } catch (err) {
      console.error("[Chat] Failed to switch session:", err);
    }
  }, []);

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
    }));
  }, [refreshSessions]);

  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (
      prevStreamingRef.current &&
      !state.isStreaming &&
      currentSessionIdRef.current
    ) {
      const sessionId = currentSessionIdRef.current;
      const agentMessages = agentRef.current?.state.messages ?? [];
      // Reject any approvals left hanging after an Abort so the promises
      // don't leak across sessions.
      drainPendingApprovals(false);
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

        // Now apply provider config — agent gets the correct system prompt with skills
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
        }));
      })
      .catch((err) => {
        console.error("[Chat] Failed to load session:", err);
      });
  }, [applyConfig]);

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

        for (const file of files) {
          if (file.size > MAX_FILE_SIZE) {
            throw new Error(
              `File '${file.name}' is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max allowed is 50MB.`,
            );
          }

          const currentVfsSize = state.uploads.reduce(
            (acc, u) => acc + u.size,
            0,
          );
          if (currentVfsSize + file.size > MAX_VFS_SIZE) {
            throw new Error(
              "Virtual Filesystem is full (150MB limit). Please remove some files before uploading more.",
            );
          }

          const buffer = await file.arrayBuffer();
          const data = new Uint8Array(buffer);
          await writeFile(file.name, data);
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

  const toggleReviewMode = useCallback(() => {
    setState((prev) => {
      const next = !prev.reviewMode;
      reviewModeRef.current = next;
      reviewModeActive = next;
      // When turning review mode OFF, auto-approve any tools that were
      // suspended mid-stream waiting for user confirmation.
      if (!next) {
        drainPendingApprovals(true);
      }
      return { ...prev, reviewMode: next };
    });
  }, []);

  useEffect(() => {
    globalConfirmToolCall = (id, confirmed) => {
      const cb = pendingApprovals.get(id);
      if (cb) {
        cb(confirmed);
        pendingApprovals.delete(id);

        // If confirmed, update UI to running
        if (confirmed) {
          setState((prev) => {
            const messages = [...prev.messages];
            for (let i = messages.length - 1; i >= 0; i--) {
              const msg = messages[i];
              const partIdx = msg.parts.findIndex(
                (p) => p.type === "toolCall" && p.id === id,
              );
              if (partIdx !== -1) {
                const parts = [...msg.parts];
                const part = parts[partIdx];
                if (part.type === "toolCall") {
                  parts[partIdx] = { ...part, status: "running" };
                  messages[i] = { ...msg, parts };
                }
                break;
              }
            }
            return { ...prev, messages };
          });
        }
      }
    };
    return () => {
      globalConfirmToolCall = null;
    };
  }, []);

  const confirmToolCall = useCallback(
    (toolCallId: string, confirmed: boolean) => {
      if (globalConfirmToolCall) {
        globalConfirmToolCall(toolCallId, confirmed);
      }
    },
    [],
  );

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
        toggleReviewMode,
        confirmToolCall,
        processFiles,
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
