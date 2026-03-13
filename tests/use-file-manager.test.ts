import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  // vfs
  deleteFile: vi.fn().mockResolvedValue(undefined),
  snapshotVfs: vi.fn().mockResolvedValue([]),
  writeFile: vi.fn().mockResolvedValue(undefined),

  // storage
  saveSessionKnowledgeBase: vi.fn().mockResolvedValue(undefined),
  saveVfsFiles: vi.fn().mockResolvedValue(undefined),

  // knowledge base
  addFileToKnowledgeBase: vi.fn(),
  getKnowledgeBaseFiles: vi.fn().mockReturnValue([]),
  removeKnowledgeBaseFile: vi.fn(),

  // React
  useCallback: vi.fn((fn: unknown) => fn),
}));

vi.mock("react", () => ({
  useCallback: mocks.useCallback,
}));

vi.mock("../src/lib/vfs", () => ({
  deleteFile: mocks.deleteFile,
  snapshotVfs: mocks.snapshotVfs,
  writeFile: mocks.writeFile,
}));

vi.mock("../src/lib/storage", () => ({
  saveSessionKnowledgeBase: mocks.saveSessionKnowledgeBase,
  saveVfsFiles: mocks.saveVfsFiles,
}));

vi.mock("../src/lib/tools/query-knowledge-base", () => ({
  addFileToKnowledgeBase: mocks.addFileToKnowledgeBase,
  getKnowledgeBaseFiles: mocks.getKnowledgeBaseFiles,
  removeKnowledgeBaseFile: mocks.removeKnowledgeBaseFile,
}));

// Mock the dynamic import for gemini-file-store used in processKnowledgeBaseFiles
vi.mock("../src/lib/rag/gemini-file-store", () => ({
  uploadFileToGemini: vi.fn().mockResolvedValue({
    name: "gemini-file",
    displayName: "test.pdf",
    createTime: "2025-01-01",
  }),
}));

import { useFileManager, type FileManagerDeps } from "../src/taskpane/components/chat/use-file-manager";

function makeDeps(overrides: Partial<FileManagerDeps> = {}): FileManagerDeps {
  return {
    currentSessionIdRef: { current: "sess-1" },
    workbookIdRef: { current: "wb1" },
    setState: vi.fn(),
    uploads: [],
    ...overrides,
  };
}

/** Create a minimal File-like object (no jsdom required). */
function fakeFile(name: string, size: number): File {
  const buf = new ArrayBuffer(size);
  return {
    name,
    size,
    type: "application/octet-stream",
    arrayBuffer: () => Promise.resolve(buf),
    webkitRelativePath: "",
  } as unknown as File;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleteFile.mockResolvedValue(undefined);
  mocks.snapshotVfs.mockResolvedValue([]);
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.getKnowledgeBaseFiles.mockReturnValue([]);
});

describe("useFileManager", () => {
  describe("processFiles", () => {
    it("writes files to VFS and updates state", async () => {
      const setState = vi.fn();
      const deps = makeDeps({ setState });
      const { processFiles } = useFileManager(deps);

      const file = fakeFile("data.csv", 1024);
      await processFiles([file]);

      expect(mocks.writeFile).toHaveBeenCalledWith("data.csv", expect.any(Uint8Array));
      // Should set isUploading true, then update uploads, then set isUploading false
      expect(setState).toHaveBeenCalled();
      // First call sets isUploading: true
      const firstUpdater = setState.mock.calls[0][0];
      expect(firstUpdater({ isUploading: false }).isUploading).toBe(true);
    });

    it("rejects files exceeding 50MB", async () => {
      const setState = vi.fn();
      const deps = makeDeps({ setState });
      const { processFiles } = useFileManager(deps);

      const bigFile = fakeFile("huge.bin", 51 * 1024 * 1024);
      await processFiles([bigFile]);

      // Should set error in state
      const errorCall = setState.mock.calls.find((c: any) => {
        if (typeof c[0] !== "function") return false;
        const result = c[0]({ error: null, uploads: [] });
        return result.error && result.error.includes("too large");
      });
      expect(errorCall).toBeDefined();
    });

    it("rejects when VFS total exceeds 150MB", async () => {
      const setState = vi.fn();
      // Existing uploads total ~140MB
      const existingUploads = [{ name: "existing.bin", size: 140 * 1024 * 1024 }];
      const deps = makeDeps({ setState, uploads: existingUploads });
      const { processFiles } = useFileManager(deps);

      // Try to add 20MB more (total would be 160MB > 150MB limit)
      const file = fakeFile("extra.bin", 20 * 1024 * 1024);
      await processFiles([file]);

      const errorCall = setState.mock.calls.find((c: any) => {
        if (typeof c[0] !== "function") return false;
        const result = c[0]({ error: null, uploads: [] });
        return result.error && result.error.includes("full");
      });
      expect(errorCall).toBeDefined();
    });

    it("does nothing for empty file array", async () => {
      const setState = vi.fn();
      const deps = makeDeps({ setState });
      const { processFiles } = useFileManager(deps);

      await processFiles([]);
      expect(mocks.writeFile).not.toHaveBeenCalled();
      expect(setState).not.toHaveBeenCalled();
    });

    it("persists VFS snapshot after upload", async () => {
      const snapshot = [{ path: "data.csv", data: new Uint8Array() }];
      mocks.snapshotVfs.mockResolvedValue(snapshot);

      const deps = makeDeps();
      const { processFiles } = useFileManager(deps);

      await processFiles([fakeFile("data.csv", 100)]);

      expect(mocks.snapshotVfs).toHaveBeenCalled();
      expect(mocks.saveVfsFiles).toHaveBeenCalledWith("wb1", "sess-1", snapshot);
    });

    it("replaces size when re-uploading same filename", async () => {
      const setState = vi.fn();
      const deps = makeDeps({
        setState,
        uploads: [{ name: "data.csv", size: 500 }],
      });
      const { processFiles } = useFileManager(deps);

      await processFiles([fakeFile("data.csv", 1024)]);

      // Find the specific updater that maps over uploads (not the isUploading toggles).
      // The upload-mutating updater explicitly returns an `uploads` array where
      // matching entries get their size replaced.  The isUploading toggles just
      // spread prev, so their result keeps the same size for data.csv.
      const uploadUpdater = setState.mock.calls
        .map((c: any) => c[0])
        .filter((fn: any) => typeof fn === "function")
        .find((fn: any) => {
          const prev = {
            uploads: [{ name: "data.csv", size: 500 }],
            isUploading: true,
          };
          const res = fn(prev);
          // The upload updater explicitly sets the uploads array with the new size
          return (
            res.uploads &&
            res.uploads.length === 1 &&
            res.uploads[0].name === "data.csv" &&
            res.uploads[0].size !== 500
          );
        });
      expect(uploadUpdater).toBeDefined();
      const result = uploadUpdater({
        uploads: [{ name: "data.csv", size: 500 }],
        isUploading: true,
      });
      expect(result.uploads[0].size).toBe(1024);
    });
  });

  describe("removeUpload", () => {
    it("deletes file from VFS and removes from state", async () => {
      const setState = vi.fn();
      const deps = makeDeps({ setState });
      const { removeUpload } = useFileManager(deps);

      await removeUpload("data.csv");

      expect(mocks.deleteFile).toHaveBeenCalledWith("data.csv");
      expect(setState).toHaveBeenCalled();
      // Verify the updater filters out the removed file
      const updater = setState.mock.calls[0][0];
      const result = updater({
        uploads: [
          { name: "data.csv", size: 100 },
          { name: "other.txt", size: 200 },
        ],
      });
      expect(result.uploads).toEqual([{ name: "other.txt", size: 200 }]);
    });

    it("persists VFS snapshot after removal", async () => {
      const snapshot = [{ path: "other.txt", data: new Uint8Array() }];
      mocks.snapshotVfs.mockResolvedValue(snapshot);

      const deps = makeDeps();
      const { removeUpload } = useFileManager(deps);
      await removeUpload("data.csv");

      expect(mocks.saveVfsFiles).toHaveBeenCalledWith("wb1", "sess-1", snapshot);
    });

    it("still removes from state when deleteFile throws", async () => {
      mocks.deleteFile.mockRejectedValue(new Error("disk error"));

      const setState = vi.fn();
      const deps = makeDeps({ setState });
      const { removeUpload } = useFileManager(deps);

      await removeUpload("data.csv");

      // Should still update state to remove the file even on error
      expect(setState).toHaveBeenCalled();
      const updater = setState.mock.calls[0][0];
      const result = updater({
        uploads: [{ name: "data.csv", size: 100 }],
      });
      expect(result.uploads).toEqual([]);
    });
  });

  describe("removeKnowledgeBaseFile", () => {
    it("removes the file record and updates state", async () => {
      const remaining = [{ name: "kb2", displayName: "KB File 2", createTime: "t2" }];
      mocks.getKnowledgeBaseFiles.mockReturnValue(remaining);

      const setState = vi.fn();
      const deps = makeDeps({ setState });
      const { removeKnowledgeBaseFile } = useFileManager(deps);

      const result = await removeKnowledgeBaseFile("kb1");

      expect(result).toBe(true);
      expect(mocks.removeKnowledgeBaseFile).toHaveBeenCalledWith("kb1");
      expect(setState).toHaveBeenCalled();
      expect(mocks.saveSessionKnowledgeBase).toHaveBeenCalledWith("sess-1", remaining);
    });

    it("returns false and sets error when removal throws", async () => {
      mocks.removeKnowledgeBaseFile.mockImplementation(() => {
        throw new Error("removal failed");
      });

      const setState = vi.fn();
      const deps = makeDeps({ setState });
      const { removeKnowledgeBaseFile } = useFileManager(deps);

      const result = await removeKnowledgeBaseFile("kb1");
      expect(result).toBe(false);

      const errorUpdater = setState.mock.calls.find((c: any) => {
        if (typeof c[0] !== "function") return false;
        const res = c[0]({ error: null });
        return res.error !== null;
      });
      expect(errorUpdater).toBeDefined();
    });
  });
});
