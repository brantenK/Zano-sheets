import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  // storage
  listSessions: vi.fn().mockResolvedValue([]),
  createSession: vi.fn().mockResolvedValue({ id: "new-sess", workbookId: "wb1", agentMessages: [] }),
  deleteSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn().mockResolvedValue(null),
  getOrCreateCurrentSession: vi.fn().mockResolvedValue({ id: "sess-1", workbookId: "wb1", agentMessages: [] }),
  getOrCreateWorkbookId: vi.fn().mockResolvedValue("wb1"),
  loadVfsFiles: vi.fn().mockResolvedValue([]),
  saveSession: vi.fn().mockResolvedValue(undefined),
  saveSessionKnowledgeBase: vi.fn().mockResolvedValue(undefined),
  saveVfsFiles: vi.fn().mockResolvedValue(undefined),
  getLatestKnowledgeBaseFiles: vi.fn().mockResolvedValue([]),

  // vfs
  listUploads: vi.fn().mockResolvedValue([]),
  resetVfs: vi.fn(),
  restoreVfs: vi.fn().mockResolvedValue(undefined),
  snapshotVfs: vi.fn().mockResolvedValue([]),

  // message-utils
  agentMessagesToChatMessages: vi.fn().mockReturnValue([]),
  deriveStats: vi.fn().mockReturnValue({ inputTokens: 0, outputTokens: 0, totalTokens: 0 }),

  // skills
  getInstalledSkills: vi.fn().mockResolvedValue([]),
  syncSkillsToVfs: vi.fn().mockResolvedValue(undefined),

  // provider-config
  loadSavedConfig: vi.fn().mockReturnValue(null),
  isProviderConfigReady: vi.fn().mockReturnValue(false),

  // provider-catalog
  loadModelsForProvider: vi.fn().mockResolvedValue([]),

  // React hooks replaced with passthrough
  useCallback: vi.fn((fn: unknown) => fn),
  useEffect: vi.fn(),
  useRef: vi.fn((val: unknown) => ({ current: val })),
}));

vi.mock("react", () => ({
  useCallback: mocks.useCallback,
  useEffect: mocks.useEffect,
  useRef: mocks.useRef,
}));

vi.mock("../src/lib/storage", () => ({
  listSessions: mocks.listSessions,
  createSession: mocks.createSession,
  deleteSession: mocks.deleteSession,
  getSession: mocks.getSession,
  getOrCreateCurrentSession: mocks.getOrCreateCurrentSession,
  getOrCreateWorkbookId: mocks.getOrCreateWorkbookId,
  loadVfsFiles: mocks.loadVfsFiles,
  saveSession: mocks.saveSession,
  saveSessionKnowledgeBase: mocks.saveSessionKnowledgeBase,
  saveVfsFiles: mocks.saveVfsFiles,
  getLatestKnowledgeBaseFiles: mocks.getLatestKnowledgeBaseFiles,
}));

vi.mock("../src/lib/vfs", () => ({
  listUploads: mocks.listUploads,
  resetVfs: mocks.resetVfs,
  restoreVfs: mocks.restoreVfs,
  snapshotVfs: mocks.snapshotVfs,
}));

vi.mock("../src/lib/message-utils", () => ({
  agentMessagesToChatMessages: mocks.agentMessagesToChatMessages,
  deriveStats: mocks.deriveStats,
}));

vi.mock("../src/lib/skills", () => ({
  getInstalledSkills: mocks.getInstalledSkills,
  syncSkillsToVfs: mocks.syncSkillsToVfs,
}));

vi.mock("../src/lib/provider-config", () => ({
  loadSavedConfig: mocks.loadSavedConfig,
  isProviderConfigReady: mocks.isProviderConfigReady,
}));

vi.mock("../src/lib/chat/provider-catalog", () => ({
  loadModelsForProvider: mocks.loadModelsForProvider,
}));

import { useSessionManager, type SessionManagerDeps } from "../src/taskpane/components/chat/use-session-manager";

function makeDeps(overrides: Partial<SessionManagerDeps> = {}): SessionManagerDeps {
  return {
    agentRef: { current: null } as any,
    isStreamingRef: { current: false },
    currentSessionIdRef: { current: "sess-1" },
    workbookIdRef: { current: "wb1" },
    sessionLoadedRef: { current: false },
    skillsRef: { current: [] },
    setState: vi.fn(),
    replaceKnowledgeBaseToolFiles: vi.fn().mockResolvedValue(undefined),
    applyConfig: vi.fn(),
    abort: vi.fn(),
    isStreaming: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset mock implementations to defaults
  mocks.listSessions.mockResolvedValue([]);
  mocks.createSession.mockResolvedValue({ id: "new-sess", workbookId: "wb1", agentMessages: [] });
  mocks.getSession.mockResolvedValue(null);
  mocks.getOrCreateCurrentSession.mockResolvedValue({ id: "sess-1", workbookId: "wb1", agentMessages: [] });
  mocks.loadVfsFiles.mockResolvedValue([]);
  mocks.listUploads.mockResolvedValue([]);
  mocks.getLatestKnowledgeBaseFiles.mockResolvedValue([]);
  mocks.agentMessagesToChatMessages.mockReturnValue([]);
  mocks.deriveStats.mockReturnValue({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
});

describe("useSessionManager", () => {
  describe("refreshSessions", () => {
    it("lists sessions and updates state", async () => {
      const sessions = [{ id: "s1" }, { id: "s2" }];
      mocks.listSessions.mockResolvedValue(sessions);
      const setState = vi.fn();
      const deps = makeDeps({ setState });
      const { refreshSessions } = useSessionManager(deps);

      await refreshSessions();

      expect(mocks.listSessions).toHaveBeenCalledWith("wb1");
      expect(setState).toHaveBeenCalled();
      // Execute the updater function to verify it sets sessions
      const updater = setState.mock.calls[0][0];
      const result = updater({ sessions: [] });
      expect(result.sessions).toEqual(sessions);
    });

    it("does nothing when workbookId is null", async () => {
      const deps = makeDeps({ workbookIdRef: { current: null } as any });
      const { refreshSessions } = useSessionManager(deps);

      await refreshSessions();
      expect(mocks.listSessions).not.toHaveBeenCalled();
    });
  });

  describe("newSession", () => {
    it("creates a new session and resets VFS", async () => {
      const setState = vi.fn();
      const replaceKnowledgeBaseToolFiles = vi.fn().mockResolvedValue(undefined);
      const agentRef = { current: { reset: vi.fn() } } as any;
      const currentSessionIdRef = { current: "old-sess" };

      const deps = makeDeps({
        setState,
        replaceKnowledgeBaseToolFiles,
        agentRef,
        currentSessionIdRef: currentSessionIdRef as any,
      });

      const { newSession } = useSessionManager(deps);
      await newSession();

      expect(agentRef.current.reset).toHaveBeenCalled();
      expect(mocks.resetVfs).toHaveBeenCalled();
      expect(mocks.createSession).toHaveBeenCalledWith("wb1");
      expect(currentSessionIdRef.current).toBe("new-sess");
      expect(replaceKnowledgeBaseToolFiles).toHaveBeenCalled();
      // setState should be called to clear messages
      expect(setState).toHaveBeenCalled();
      // Find the updater that clears messages (not the refreshSessions one)
      const updater = setState.mock.calls
        .filter((c: any) => typeof c[0] === "function")
        .map((c: any) => c[0])
        .find((fn: any) => {
          const r = fn({ messages: ["old"], uploads: ["old"], sessions: [] });
          return Array.isArray(r.messages) && r.messages.length === 0;
        });
      expect(updater).toBeDefined();
      const result = updater({ messages: ["old"], uploads: ["old"], sessions: [] });
      expect(result.messages).toEqual([]);
      expect(result.uploads).toEqual([]);
    });

    it("does nothing when workbookId is null", async () => {
      const deps = makeDeps({ workbookIdRef: { current: null } as any });
      const { newSession } = useSessionManager(deps);

      await newSession();
      expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("does nothing when currently streaming", async () => {
      const deps = makeDeps({ isStreamingRef: { current: true } });
      const { newSession } = useSessionManager(deps);

      await newSession();
      expect(mocks.createSession).not.toHaveBeenCalled();
    });

    it("saves knowledge base when latestKb has entries", async () => {
      const kbFiles = [{ name: "f1", displayName: "File 1", createTime: "t1" }];
      mocks.getLatestKnowledgeBaseFiles.mockResolvedValue(kbFiles);
      const deps = makeDeps();
      const { newSession } = useSessionManager(deps);

      await newSession();

      expect(mocks.saveSessionKnowledgeBase).toHaveBeenCalledWith("new-sess", kbFiles);
    });
  });

  describe("switchSession", () => {
    it("loads session data and restores VFS", async () => {
      const session = { id: "sess-2", workbookId: "wb1", agentMessages: [] };
      mocks.getSession.mockResolvedValue(session);
      mocks.listUploads.mockResolvedValue(["file1.txt"]);

      const setState = vi.fn();
      const agentRef = { current: { reset: vi.fn(), replaceMessages: vi.fn() } } as any;
      const currentSessionIdRef = { current: "sess-1" };
      const replaceKnowledgeBaseToolFiles = vi.fn().mockResolvedValue(undefined);

      const deps = makeDeps({
        setState,
        agentRef,
        currentSessionIdRef: currentSessionIdRef as any,
        replaceKnowledgeBaseToolFiles,
      });

      const { switchSession } = useSessionManager(deps);
      await switchSession("sess-2");

      expect(agentRef.current.reset).toHaveBeenCalled();
      expect(mocks.getSession).toHaveBeenCalledWith("sess-2");
      expect(mocks.restoreVfs).toHaveBeenCalled();
      expect(currentSessionIdRef.current).toBe("sess-2");
      expect(setState).toHaveBeenCalled();
    });

    it("skips if same session is already active", async () => {
      const deps = makeDeps({ currentSessionIdRef: { current: "sess-1" } as any });
      const { switchSession } = useSessionManager(deps);

      await switchSession("sess-1");
      expect(mocks.getSession).not.toHaveBeenCalled();
    });

    it("skips if currently streaming", async () => {
      const deps = makeDeps({ isStreamingRef: { current: true } });
      const { switchSession } = useSessionManager(deps);

      await switchSession("sess-2");
      expect(mocks.getSession).not.toHaveBeenCalled();
    });

    it("replays agent messages when session has them", async () => {
      const agentMessages = [{ role: "user", content: "hi" }];
      const session = { id: "sess-2", workbookId: "wb1", agentMessages };
      mocks.getSession.mockResolvedValue(session);

      const agentRef = {
        current: { reset: vi.fn(), replaceMessages: vi.fn() },
      } as any;

      const deps = makeDeps({ agentRef, currentSessionIdRef: { current: "sess-1" } as any });
      const { switchSession } = useSessionManager(deps);
      await switchSession("sess-2");

      expect(agentRef.current.replaceMessages).toHaveBeenCalledWith(agentMessages);
    });

    it("does nothing when session is not found", async () => {
      mocks.getSession.mockResolvedValue(null);
      const setState = vi.fn();
      const deps = makeDeps({ setState, currentSessionIdRef: { current: "sess-1" } as any });
      const { switchSession } = useSessionManager(deps);
      await switchSession("sess-999");

      // setState should NOT be called with session data
      const updaterCalls = setState.mock.calls.filter(
        (c: any) => typeof c[0] === "function",
      );
      // No state update for session data (only potential error logging)
      expect(updaterCalls.length).toBe(0);
    });
  });

  describe("deleteCurrentSession", () => {
    it("deletes current session and loads a replacement", async () => {
      const replacement = { id: "sess-new", workbookId: "wb1", agentMessages: [] };
      mocks.getOrCreateCurrentSession.mockResolvedValue(replacement);
      mocks.listUploads.mockResolvedValue([]);

      const agentRef = { current: { reset: vi.fn(), replaceMessages: vi.fn() } } as any;
      const setState = vi.fn();
      const currentSessionIdRef = { current: "sess-1" };

      const deps = makeDeps({
        agentRef,
        setState,
        currentSessionIdRef: currentSessionIdRef as any,
      });

      const { deleteCurrentSession } = useSessionManager(deps);
      await deleteCurrentSession();

      expect(mocks.deleteSession).toHaveBeenCalledWith("sess-1");
      expect(mocks.saveVfsFiles).toHaveBeenCalledWith("wb1", "sess-1", []);
      expect(agentRef.current.reset).toHaveBeenCalled();
      expect(currentSessionIdRef.current).toBe("sess-new");
      expect(setState).toHaveBeenCalled();
    });

    it("does nothing when no current session or workbook", async () => {
      const deps = makeDeps({
        currentSessionIdRef: { current: null } as any,
        workbookIdRef: { current: null } as any,
      });
      const { deleteCurrentSession } = useSessionManager(deps);
      await deleteCurrentSession();
      expect(mocks.deleteSession).not.toHaveBeenCalled();
    });

    it("does nothing when streaming", async () => {
      const deps = makeDeps({ isStreamingRef: { current: true } });
      const { deleteCurrentSession } = useSessionManager(deps);
      await deleteCurrentSession();
      expect(mocks.deleteSession).not.toHaveBeenCalled();
    });
  });

  describe("clearMessages", () => {
    it("aborts, resets agent, resets VFS, and clears state", () => {
      const abort = vi.fn();
      const agentRef = { current: { reset: vi.fn() } } as any;
      const setState = vi.fn();

      const deps = makeDeps({ abort, agentRef, setState });
      const { clearMessages } = useSessionManager(deps);
      clearMessages();

      expect(abort).toHaveBeenCalled();
      expect(agentRef.current.reset).toHaveBeenCalled();
      expect(mocks.resetVfs).toHaveBeenCalled();
      expect(mocks.saveSession).toHaveBeenCalledWith("sess-1", []);
      expect(setState).toHaveBeenCalled();

      const updater = setState.mock.calls[0][0];
      const result = updater({ messages: ["old"], uploads: ["old"], sessionStats: {} });
      expect(result.messages).toEqual([]);
      expect(result.uploads).toEqual([]);
      expect(result.error).toBeNull();
    });

    it("skips persistence when no current session", () => {
      const deps = makeDeps({ currentSessionIdRef: { current: null } as any });
      const { clearMessages } = useSessionManager(deps);
      clearMessages();

      expect(mocks.saveSession).not.toHaveBeenCalled();
    });
  });
});
