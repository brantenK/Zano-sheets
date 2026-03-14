import { Agent } from "@mariozechner/pi-agent-core";
import {
  type Api,
  getModels,
  getProviders,
  type Model,
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
import { resolveAgentModel } from "../../../lib/chat/model-resolution";
import { streamWithRetry } from "../../../lib/chat/stream-with-retry";
import {
  buildSystemPrompt,
  thinkingLevelToAgent,
} from "../../../lib/chat/system-prompt";
import { useAgentEvents } from "../../../lib/chat/use-agent-events";
import { getErrorStatus } from "../../../lib/error-utils";
import { getWorkbookMetadata } from "../../../lib/excel/api";
import { recordIntegrationTelemetry } from "../../../lib/integration-telemetry";
import {
  type ChatMessage,
  deriveStats,
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
  evaluateProviderConfig,
  isProviderConfigReady,
  loadSavedConfig,
  type ProviderConfig,
  saveConfig,
} from "../../../lib/provider-config";
import type { KnowledgeBaseFileRecord } from "../../../lib/rag/types";
import type { SkillMeta } from "../../../lib/skills";
import type { ChatSession } from "../../../lib/storage";
import { beginToolApprovalTurn } from "../../../lib/tool-approval";
import { EXCEL_TOOLS } from "../../../lib/tools";
import { replaceKnowledgeBaseFiles } from "../../../lib/tools/query-knowledge-base";
import { useFileManager } from "./use-file-manager";
import { useSessionManager } from "./use-session-manager";
import { useSkillManager } from "./use-skill-manager";

export {
  getErrorMessage,
  getErrorStatus,
  isRetryableProviderError,
} from "../../../lib/error-utils";
export type {
  ChatMessage,
  MessagePart,
  SessionStats,
  ToolCallStatus,
} from "../../../lib/message-utils";
export type {
  ProviderConfig,
  ThinkingLevel,
} from "../../../lib/provider-config";
export { checkToolApproval } from "../../../lib/tool-approval";

import { formatProviderError as formatAgentErrorMessage } from "../../../lib/error-utils";

export interface UploadedFile {
  name: string;
  size: number;
}

export interface ChatState {
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
  clearError: () => void;
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
  clearError: () => {},
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
  const timeoutWarningRef = useRef<number | null>(null);

  // Tool-call loop breaker refs (now managed by useAgentEvents hook)
  const abortControllerRef = useRef<AbortController | null>(null);
  const replaceKnowledgeBaseToolFiles = useCallback(
    async (files: KnowledgeBaseFileRecord[]) =>
      replaceKnowledgeBaseFiles(files),
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

  // Use agent events hook to handle agent events (extracted 289 lines)
  const {
    handleAgentEvent,
    toolCallCountRef,
    lastToolSignatureRef,
    consecutiveIdenticalErrorsRef,
  } = useAgentEvents<ChatState>({
    setState,
    followModeRef,
    streamingTimeoutRef,
    timeoutWarningRef,
    isStreamingRef,
    agentRef,
    streamingMessageIdRef,
  });

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
      const resolved = resolveAgentModel(config);
      if (!resolved.baseModel) {
        console.warn("[Chat] Could not resolve model:", resolved.error);
        setState((prev) => ({
          ...prev,
          error:
            resolved.error ??
            "Could not resolve the configured model. Check Settings.",
        }));
        return;
      }
      const baseModel = resolved.baseModel;
      const contextWindow = baseModel.contextWindow ?? 0;
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
        // Cast streamFn to satisfy pi-agent-core's type which references
        // pi-ai@0.55.4 internally while we use pi-ai@0.57.1.  The runtime
        // signatures are identical; only the private `isComplete` property
        // changed between the two AssistantMessageEventStream versions.
        streamFn: ((model: unknown, context: unknown, options: unknown) => {
          const cfg = configRef.current ?? config;
          return streamWithRetry(
            model as Parameters<typeof streamWithRetry>[0],
            context as Parameters<typeof streamWithRetry>[1],
            options as Parameters<typeof streamWithRetry>[2],
            {
              apiKey: cfg.apiKey,
              authMethod: cfg.authMethod,
              refreshApiKey: (opts) => getActiveApiKey(cfg, opts),
            },
          );
        }) as never,
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
    // Clear timeout warning if set
    if (timeoutWarningRef.current !== null) {
      window.clearTimeout(timeoutWarningRef.current);
      timeoutWarningRef.current = null;
    }
    // Signal abort to any running tools
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
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

      // Reset tool-call loop breaker counters for new turn
      toolCallCountRef.current = 0;
      lastToolSignatureRef.current = null;
      consecutiveIdenticalErrorsRef.current = 0;
      beginToolApprovalTurn();

      // Create fresh AbortController for this turn
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

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
        const TIMEOUT_WARNING_MS = 4 * 60 * 1000; // 4 minutes

        // Set up timeout warning at 4 minutes
        timeoutWarningRef.current = window.setTimeout(() => {
          if (isStreamingRef.current) {
            setState((prev) => ({
              ...prev,
              error:
                "This is taking longer than usual. You can wait or cancel.",
            }));
          }
        }, TIMEOUT_WARNING_MS);

        streamingTimeoutRef.current = window.setTimeout(() => {
          // Clear warning timeout
          if (timeoutWarningRef.current !== null) {
            window.clearTimeout(timeoutWarningRef.current);
            timeoutWarningRef.current = null;
          }
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
        // Clear streaming timeout and warning timeout on error
        if (streamingTimeoutRef.current !== null) {
          window.clearTimeout(streamingTimeoutRef.current);
          streamingTimeoutRef.current = null;
        }
        if (timeoutWarningRef.current !== null) {
          window.clearTimeout(timeoutWarningRef.current);
          timeoutWarningRef.current = null;
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
    [
      state.providerConfig,
      applyConfig,
      toolCallCountRef,
      lastToolSignatureRef,
      consecutiveIdenticalErrorsRef,
    ],
  );

  const { newSession, switchSession, deleteCurrentSession, clearMessages } =
    useSessionManager({
      agentRef,
      isStreamingRef,
      currentSessionIdRef,
      workbookIdRef,
      sessionLoadedRef,
      skillsRef,
      setState,
      replaceKnowledgeBaseToolFiles,
      applyConfig,
      abort,
      isStreaming: state.isStreaming,
    });

  useEffect(() => {
    return () => {
      agentRef.current?.abort();
    };
  }, []);

  const getSheetName = useCallback(
    (sheetId: number): string | undefined => state.sheetNames[sheetId],
    [state.sheetNames],
  );

  const {
    processFiles,
    removeUpload,
    processKnowledgeBaseFiles,
    removeKnowledgeBaseFile,
  } = useFileManager({
    currentSessionIdRef,
    workbookIdRef,
    setState,
    uploads: state.uploads,
  });
  const { installSkill, uninstallSkill } = useSkillManager({
    skillsRef,
    setState,
    applyConfig,
  });

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

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return (
    <ChatContext.Provider
      value={{
        state,
        sendMessage,
        setProviderConfig,
        clearMessages,
        clearError,
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
