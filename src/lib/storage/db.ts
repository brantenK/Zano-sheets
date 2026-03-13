import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { UserMessage } from "@mariozechner/pi-ai";
import { type DBSchema, type IDBPDatabase, openDB } from "idb";
import { stripEnrichment } from "../message-utils";
import type { KnowledgeBaseFileRecord } from "../rag/types";
import { handleError } from "../silent-error-handler";
export interface ChatSession {
  id: string;
  workbookId: string;
  name: string;
  agentMessages: AgentMessage[];
  knowledgeBaseFiles: KnowledgeBaseFileRecord[];
  createdAt: number;
  updatedAt: number;
  lastVfsEviction?: number; // Timestamp of when VFS was cleared due to quota
}

export interface VfsFile {
  id: string; // "{workbookId}:{sessionId}:{path}" composite key
  workbookId: string;
  sessionId: string;
  path: string;
  data: Uint8Array;
}

export interface SkillFile {
  id: string; // "{skillName}:{path}" composite key
  skillName: string;
  path: string; // relative path within skill folder, e.g. "SKILL.md"
  data: Uint8Array;
}

interface OpenExcelSchema extends DBSchema {
  sessions: {
    key: string;
    value: ChatSession;
    indexes: { workbookId: string; updatedAt: number };
  };
  vfsFiles: {
    key: string;
    value: VfsFile;
    indexes: { sessionId: string; workbookId: string };
  };
  skillFiles: {
    key: string;
    value: SkillFile;
    indexes: { skillName: string };
  };
}

let dbPromise: Promise<IDBPDatabase<OpenExcelSchema>> | null = null;
const vfsWriteQueue = new Map<string, Promise<void>>();
const WORKBOOK_ID_KEY = "zanosheets-workbook-id";
const LEGACY_WORKBOOK_ID_KEY = "openexcel-workbook-id";

function enqueueVfsWrite(
  sessionId: string,
  operation: () => Promise<void>,
): Promise<void> {
  const previous = vfsWriteQueue.get(sessionId) ?? Promise.resolve();
  const queued = previous
    .catch((error) => {
      handleError(error, "VFS write queue previous operation failed");
    })
    .then(operation);
  vfsWriteQueue.set(sessionId, queued);

  void queued.finally(() => {
    if (vfsWriteQueue.get(sessionId) === queued) {
      vfsWriteQueue.delete(sessionId);
    }
  });

  return queued;
}

function getDb(): Promise<IDBPDatabase<OpenExcelSchema>> {
  if (!dbPromise) {
    // Dexie used version(3) which maps to IndexedDB version 30.
    // We must open at >=30 to be compatible with existing databases.
    dbPromise = openDB<OpenExcelSchema>("OpenExcelDB_v3", 30, {
      upgrade(db, oldVersion) {
        if (oldVersion < 10) {
          const sessions = db.createObjectStore("sessions", { keyPath: "id" });
          sessions.createIndex("workbookId", "workbookId");
          sessions.createIndex("updatedAt", "updatedAt");
        }
        if (oldVersion < 20) {
          const vfsFiles = db.createObjectStore("vfsFiles", { keyPath: "id" });
          vfsFiles.createIndex("sessionId", "sessionId");
          vfsFiles.createIndex("workbookId", "workbookId");
        }
        if (oldVersion < 30) {
          const skillFiles = db.createObjectStore("skillFiles", {
            keyPath: "id",
          });
          skillFiles.createIndex("skillName", "skillName");
        }
      },
    });
  }
  return dbPromise;
}

function extractUserText(msg: AgentMessage): string | null {
  if (msg.role !== "user") return null;
  const text = stripEnrichment((msg as UserMessage).content).trim();
  return text || null;
}

function deriveSessionName(agentMessages: AgentMessage[]): string | null {
  const firstUser = agentMessages.find((m) => m.role === "user");
  if (!firstUser) return null;
  const text = extractUserText(firstUser);
  if (!text) return null;
  return text.length > 40 ? `${text.slice(0, 37)}...` : text;
}

export function getSessionMessageCount(session: ChatSession): number {
  return (session.agentMessages ?? []).filter(
    (m) => m.role === "user" || m.role === "assistant",
  ).length;
}

export async function getOrCreateWorkbookId(): Promise<string> {
  return new Promise((resolve, reject) => {
    const settings = Office.context.document.settings;
    let workbookId = settings.get(WORKBOOK_ID_KEY) as string | null;

    if (!workbookId) {
      const legacyWorkbookId = settings.get(LEGACY_WORKBOOK_ID_KEY) as
        | string
        | null;
      if (legacyWorkbookId) {
        workbookId = legacyWorkbookId;
        settings.set(WORKBOOK_ID_KEY, legacyWorkbookId);
        settings.remove(LEGACY_WORKBOOK_ID_KEY);
        settings.saveAsync((result) => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            resolve(legacyWorkbookId);
          } else {
            reject(
              new Error(
                result.error?.message ?? "Failed to migrate workbook ID",
              ),
            );
          }
        });
        return;
      }
    }

    if (workbookId) {
      resolve(workbookId);
      return;
    }

    workbookId = crypto.randomUUID();
    settings.set(WORKBOOK_ID_KEY, workbookId);
    settings.saveAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve(workbookId);
      } else {
        reject(
          new Error(result.error?.message ?? "Failed to save workbook ID"),
        );
      }
    });
  });
}

export async function listSessions(workbookId: string): Promise<ChatSession[]> {
  const db = await getDb();
  const sessions = await db.getAllFromIndex(
    "sessions",
    "workbookId",
    workbookId,
  );
  for (const s of sessions) {
    if (!s.agentMessages) s.agentMessages = [];
    if (!s.knowledgeBaseFiles) s.knowledgeBaseFiles = [];
  }
  sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  return sessions;
}

export async function createSession(
  workbookId: string,
  name?: string,
): Promise<ChatSession> {
  const db = await getDb();
  const now = Date.now();
  const session: ChatSession = {
    id: crypto.randomUUID(),
    workbookId,
    name: name ?? "New Chat",
    agentMessages: [],
    knowledgeBaseFiles: [],
    createdAt: now,
    updatedAt: now,
  };
  await db.add("sessions", session);
  return session;
}

export async function getSession(
  sessionId: string,
): Promise<ChatSession | undefined> {
  const db = await getDb();
  const session = await db.get("sessions", sessionId);
  if (session && !session.agentMessages) {
    session.agentMessages = [];
  }
  if (session && !session.knowledgeBaseFiles) {
    session.knowledgeBaseFiles = [];
  }
  return session;
}

export async function saveSession(
  sessionId: string,
  agentMessages: AgentMessage[],
): Promise<void> {
  const db = await getDb();
  const session = await db.get("sessions", sessionId);
  if (!session) {
    console.error("[DB] Session not found for save:", sessionId);
    return;
  }
  let name = session.name;
  if (name === "New Chat") {
    const derivedName = deriveSessionName(agentMessages);
    if (derivedName) name = derivedName;
  }
  await db.put("sessions", {
    ...session,
    agentMessages,
    name,
    updatedAt: Date.now(),
  });
}

export async function saveSessionKnowledgeBase(
  sessionId: string,
  knowledgeBaseFiles: KnowledgeBaseFileRecord[],
): Promise<void> {
  const db = await getDb();
  const session = await db.get("sessions", sessionId);
  if (!session) {
    console.error("[DB] Session not found for KB save:", sessionId);
    return;
  }
  if (!session.knowledgeBaseFiles) session.knowledgeBaseFiles = [];

  await db.put("sessions", {
    ...session,
    knowledgeBaseFiles,
    updatedAt: Date.now(),
  });
}

export async function getLatestKnowledgeBaseFiles(
  workbookId: string,
): Promise<KnowledgeBaseFileRecord[]> {
  const sessions = await listSessions(workbookId);
  for (const s of sessions) {
    if (s.knowledgeBaseFiles?.length) return s.knowledgeBaseFiles;
  }
  return [];
}

export async function renameSession(
  sessionId: string,
  name: string,
): Promise<void> {
  const db = await getDb();
  const session = await db.get("sessions", sessionId);
  if (session) {
    await db.put("sessions", { ...session, name });
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.delete("sessions", sessionId);
}

export async function getOrCreateCurrentSession(
  workbookId: string,
): Promise<ChatSession> {
  const sessions = await listSessions(workbookId);
  if (sessions.length > 0) {
    const session = sessions[0];
    if (!session.agentMessages) session.agentMessages = [];
    return session;
  }
  return createSession(workbookId);
}

async function evictOldSessionsIfNeeded(
  protectedSessionId?: string,
): Promise<void> {
  if (!navigator.storage?.estimate) return;

  try {
    const estimate = await navigator.storage.estimate();
    if (!estimate.usage || !estimate.quota) return;

    const usagePercent = (estimate.usage / estimate.quota) * 100;
    // If we're over 80% full, start evicting
    if (usagePercent < 80) return;

    console.warn(
      `[DB] Storage usage high (${usagePercent.toFixed(1)}%). Evicting old VFS data...`,
    );

    const db = await getDb();
    // Get ALL sessions across ALL workbooks, sorted by updatedAt
    const allSessions = await db.getAll("sessions");
    allSessions.sort((a, b) => a.updatedAt - b.updatedAt);

    // Evict VFS files for the oldest 5 sessions that haven't been evicted yet
    let evictedCount = 0;
    for (const session of allSessions) {
      if (evictedCount >= 5) break;
      if (session.id === protectedSessionId) continue;
      if (session.lastVfsEviction) continue;

      const vfsKeys = await db
        .transaction("vfsFiles", "readonly")
        .store.index("sessionId")
        .getAllKeys(session.id);

      if (vfsKeys.length > 0) {
        const tx = db.transaction(["vfsFiles", "sessions"], "readwrite");
        for (const key of vfsKeys) {
          await tx.objectStore("vfsFiles").delete(key);
        }
        await tx.objectStore("sessions").put({
          ...session,
          lastVfsEviction: Date.now(),
        });
        await tx.done;
        evictedCount++;
      }
    }
  } catch (err) {
    handleError(err, "DB VFS eviction failed");
  }
}

export async function saveVfsFiles(
  workbookId: string,
  sessionId: string,
  files: { path: string; data: Uint8Array }[],
): Promise<void> {
  return enqueueVfsWrite(sessionId, async () => {
    await evictOldSessionsIfNeeded(sessionId);

    const db = await getDb();
    const tx = db.transaction(["vfsFiles", "sessions"], "readwrite");
    const vfsStore = tx.objectStore("vfsFiles");
    const sessionsStore = tx.objectStore("sessions");
    const existing = await vfsStore.index("sessionId").getAllKeys(sessionId);

    // Performance optimization: Use Promise.all for concurrent IndexedDB operations
    // within a transaction to avoid sequential N+1 bottlenecks.
    await Promise.all(existing.map((key) => vfsStore.delete(key)));
    await Promise.all(
      files.map((f) =>
        vfsStore.add({
          id: `${workbookId}:${sessionId}:${f.path}`,
          workbookId,
          sessionId,
          path: f.path,
          data: f.data,
        })
      )
    );

    const session = await sessionsStore.get(sessionId);
    if (session?.lastVfsEviction) {
      const { lastVfsEviction: _ignored, ...sessionWithoutEviction } = session;
      await sessionsStore.put(sessionWithoutEviction);
    }

    await tx.done;
  });
}

export async function loadVfsFiles(
  sessionId: string,
): Promise<{ path: string; data: Uint8Array }[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex("vfsFiles", "sessionId", sessionId);
  return rows.map((r) => ({ path: r.path, data: r.data }));
}

export async function deleteVfsFiles(sessionId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("vfsFiles", "readwrite");
  const keys = await tx.store.index("sessionId").getAllKeys(sessionId);

  // Performance optimization: Use Promise.all to avoid sequential awaits
  await Promise.all(keys.map((key) => tx.store.delete(key)));

  await tx.done;
}

export async function saveSkillFiles(
  skillName: string,
  files: { path: string; data: Uint8Array }[],
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("skillFiles", "readwrite");
  const store = tx.store;
  const existing = await store.index("skillName").getAllKeys(skillName);

  // Performance optimization: Parallelize IndexedDB queries
  await Promise.all(existing.map((key) => store.delete(key)));
  await Promise.all(
    files.map((f) =>
      store.add({
        id: `${skillName}:${f.path}`,
        skillName,
        path: f.path,
        data: f.data,
      })
    )
  );

  await tx.done;
}

export async function loadSkillFiles(
  skillName: string,
): Promise<{ path: string; data: Uint8Array }[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex("skillFiles", "skillName", skillName);
  return rows.map((r) => ({ path: r.path, data: r.data }));
}

export async function loadAllSkillFiles(): Promise<
  { skillName: string; path: string; data: Uint8Array }[]
> {
  const db = await getDb();
  const rows = await db.getAll("skillFiles");
  return rows.map((r) => ({
    skillName: r.skillName,
    path: r.path,
    data: r.data,
  }));
}

export async function deleteSkillFiles(skillName: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("skillFiles", "readwrite");
  const keys = await tx.store.index("skillName").getAllKeys(skillName);

  // Performance optimization: Use Promise.all for faster bulk deletion
  await Promise.all(keys.map((key) => tx.store.delete(key)));

  await tx.done;
}

export async function listSkillNames(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAll("skillFiles");
  const names = new Set(rows.map((r) => r.skillName));
  return [...names].sort();
}
