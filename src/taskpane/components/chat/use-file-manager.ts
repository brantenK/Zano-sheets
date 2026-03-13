import { useCallback } from "react";
import {
  addFileToKnowledgeBase,
  getKnowledgeBaseFiles,
  removeKnowledgeBaseFile as removeKnowledgeBaseFileRecord,
} from "../../../lib/tools/query-knowledge-base";
import {
  saveSessionKnowledgeBase,
  saveVfsFiles,
} from "../../../lib/storage";
import {
  deleteFile,
  snapshotVfs,
  writeFile,
} from "../../../lib/vfs";

import type { ChatState, UploadedFile } from "./chat-context";

export interface FileManagerDeps {
  currentSessionIdRef: React.MutableRefObject<string | null>;
  workbookIdRef: React.MutableRefObject<string | null>;
  setState: React.Dispatch<React.SetStateAction<ChatState>>;
  uploads: UploadedFile[];
}

export function useFileManager(deps: FileManagerDeps) {
  const { currentSessionIdRef, workbookIdRef, setState, uploads } = deps;

  const processFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setState((prev) => ({ ...prev, isUploading: true }));
      try {
        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        const MAX_VFS_SIZE = 150 * 1024 * 1024; // 150MB

        let currentVfsSize = uploads.reduce((acc, u) => acc + u.size, 0);

        const uploadSizeByName = new Map(
          uploads.map((u) => [u.name, u.size] as const),
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
    [uploads, currentSessionIdRef, workbookIdRef, setState],
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
  }, [currentSessionIdRef, workbookIdRef, setState]);

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
  }, [currentSessionIdRef, setState]);

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
  }, [currentSessionIdRef, setState]);

  return {
    processFiles,
    removeUpload,
    processKnowledgeBaseFiles,
    removeKnowledgeBaseFile,
  };
}
