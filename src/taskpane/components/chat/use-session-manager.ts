import type { Agent } from "@mariozechner/pi-agent-core";
import { useCallback, useEffect, useRef } from "react";
import { loadModelsForProvider } from "../../../lib/chat/provider-catalog";
import {
  agentMessagesToChatMessages,
  deriveStats,
  type SessionStats,
} from "../../../lib/message-utils";
import type { ProviderConfig } from "../../../lib/provider-config";
import {
  isProviderConfigReady,
  loadSavedConfig,
} from "../../../lib/provider-config";
import type { KnowledgeBaseFileRecord } from "../../../lib/rag/types";
import {
  getInstalledSkills,
  type SkillMeta,
  syncSkillsToVfs,
} from "../../../lib/skills";
import {
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
import {
  listUploads,
  resetVfs,
  restoreVfs,
  snapshotVfs,
} from "../../../lib/vfs";

import type { ChatState } from "./chat-context";

const INITIAL_STATS: SessionStats = { ...deriveStats([]), contextWindow: 0 };

export interface SessionManagerDeps {
  agentRef: React.RefObject<Agent | null>;
  isStreamingRef: React.RefObject<boolean>;
  currentSessionIdRef: React.MutableRefObject<string | null>;
  workbookIdRef: React.MutableRefObject<string | null>;
  sessionLoadedRef: React.MutableRefObject<boolean>;
  skillsRef: React.MutableRefObject<SkillMeta[]>;
  setState: React.Dispatch<React.SetStateAction<ChatState>>;
  replaceKnowledgeBaseToolFiles: (
    files: KnowledgeBaseFileRecord[],
  ) => Promise<void>;
  applyConfig: (config: ProviderConfig) => void;
  abort: () => void;
  isStreaming: boolean;
}

export function useSessionManager(deps: SessionManagerDeps) {
  const {
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
    isStreaming,
  } = deps;

  const refreshSessions = useCallback(async () => {
    if (!workbookIdRef.current) return;
    const sessions = await listSessions(workbookIdRef.current);
    setState((prev) => ({ ...prev, sessions }));
  }, [workbookIdRef, setState]);

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
  }, [
    agentRef,
    isStreamingRef,
    workbookIdRef,
    currentSessionIdRef,
    refreshSessions,
    replaceKnowledgeBaseToolFiles,
    setState,
  ]);

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
    [
      agentRef,
      isStreamingRef,
      currentSessionIdRef,
      replaceKnowledgeBaseToolFiles,
      setState,
    ],
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
  }, [
    agentRef,
    isStreamingRef,
    currentSessionIdRef,
    workbookIdRef,
    refreshSessions,
    replaceKnowledgeBaseToolFiles,
    setState,
  ]);

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
  }, [abort, agentRef, currentSessionIdRef, workbookIdRef, setState]);

  // Persist session when streaming ends
  const prevStreamingRef = useRef(false);
  useEffect(() => {
    if (
      prevStreamingRef.current &&
      !isStreaming &&
      currentSessionIdRef.current
    ) {
      const sessionId = currentSessionIdRef.current;
      const agentMessages = agentRef.current?.state.messages ?? [];
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
    prevStreamingRef.current = isStreaming;
  }, [
    isStreaming,
    refreshSessions,
    agentRef,
    currentSessionIdRef,
    workbookIdRef,
    setState,
  ]);

  // Load initial session on mount
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
          // Preload models for the provider so that manually-added or extra models
          // (e.g. new OpenRouter models) are available to resolveAgentModel.
          await loadModelsForProvider(saved.provider).catch(() => {});
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
  }, [
    applyConfig,
    replaceKnowledgeBaseToolFiles,
    agentRef,
    currentSessionIdRef,
    workbookIdRef,
    sessionLoadedRef,
    skillsRef,
    setState,
  ]);

  return {
    refreshSessions,
    newSession,
    switchSession,
    deleteCurrentSession,
    clearMessages,
  };
}
