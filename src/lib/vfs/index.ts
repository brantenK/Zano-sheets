/**
 * Virtual Filesystem (VFS) for the agent
 *
 * Uses a lightweight in-memory file store for uploads, reads, and session restore.
 * The heavier just-bash runtime is only hydrated when the bash tool is invoked.
 */

import type { Bash, InMemoryFs } from "just-bash/browser";

type VfsEntryStat = {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
};

class LightweightVfs {
  private files = new Map<string, Uint8Array>();
  private directories = new Set<string>([
    "/",
    "/home",
    "/home/user",
    "/home/user/uploads",
  ]);

  constructor(initialFiles: Record<string, Uint8Array | string>) {
    for (const [path, data] of Object.entries(initialFiles)) {
      this.writeFileSync(path, data);
    }
  }

  cloneFileMap(): Record<string, Uint8Array> {
    const record: Record<string, Uint8Array> = {};
    for (const [path, data] of this.files.entries()) {
      record[path] = data;
    }
    return record;
  }

  getAllPaths(): string[] {
    return [...this.directories, ...this.files.keys()].sort();
  }

  async stat(path: string): Promise<VfsEntryStat> {
    const normalized = normalizePath(path);
    if (this.files.has(normalized)) {
      return {
        isFile: true,
        isDirectory: false,
        size: this.files.get(normalized)?.length ?? 0,
      };
    }
    if (this.directories.has(normalized)) {
      return { isFile: false, isDirectory: true, size: 0 };
    }
    throw new Error(`ENOENT: ${normalized}`);
  }

  async readFile(path: string): Promise<string> {
    return new TextDecoder().decode(await this.readFileBuffer(path));
  }

  async readFileBuffer(path: string): Promise<Uint8Array> {
    const normalized = normalizePath(path);
    const data = this.files.get(normalized);
    if (!data) throw new Error(`ENOENT: ${normalized}`);
    return data;
  }

  async writeFile(path: string, content: string | Uint8Array): Promise<void> {
    this.writeFileSync(path, content);
  }

  async mkdir(path: string, options?: { recursive: boolean }): Promise<void> {
    const normalized = normalizePath(path);
    if (!options?.recursive) {
      const parent = dirname(normalized);
      if (parent !== normalized && !this.directories.has(parent)) {
        throw new Error(`ENOENT: ${parent}`);
      }
    }
    this.ensureDirectory(normalized);
  }

  async exists(path: string): Promise<boolean> {
    const normalized = normalizePath(path);
    return this.files.has(normalized) || this.directories.has(normalized);
  }

  async rm(path: string): Promise<void> {
    const normalized = normalizePath(path);
    this.files.delete(normalized);
  }

  async readdir(path: string): Promise<string[]> {
    const normalized = normalizePath(path);
    if (!this.directories.has(normalized)) {
      throw new Error(`ENOENT: ${normalized}`);
    }

    const children = new Set<string>();
    const prefix = normalized === "/" ? "/" : `${normalized}/`;

    for (const entry of this.getAllPaths()) {
      if (!entry.startsWith(prefix) || entry === normalized) continue;
      const rest = entry.slice(prefix.length);
      const name = rest.split("/")[0];
      if (name) children.add(name);
    }

    return [...children].sort();
  }

  replaceFiles(initialFiles: Record<string, Uint8Array | string>) {
    this.files.clear();
    this.directories = new Set([
      "/",
      "/home",
      "/home/user",
      "/home/user/uploads",
    ]);
    for (const [path, data] of Object.entries(initialFiles)) {
      this.writeFileSync(path, data);
    }
  }

  private writeFileSync(path: string, content: string | Uint8Array) {
    const normalized = normalizePath(path);
    this.ensureDirectory(dirname(normalized));
    this.files.set(normalized, toUint8Array(content));
  }

  private ensureDirectory(path: string) {
    const normalized = normalizePath(path);
    const parts = normalized.split("/").filter(Boolean);
    let current = "";
    this.directories.add("/");
    for (const part of parts) {
      current += `/${part}`;
      this.directories.add(current);
    }
  }
}

let fs = new LightweightVfs({ "/home/user/uploads/.keep": "" });
let bash: Bash | null = null;
let bashFs: InMemoryFs | null = null;
let justBashModulePromise: Promise<typeof import("just-bash/browser")> | null =
  null;
let customCommandsPromise: Promise<
  ReturnType<typeof import("./custom-commands").getCustomCommands>
> | null = null;
let activeOperationCount = 0;
let skillFilesCache: Record<string, Uint8Array | string> = {};

function normalizePath(path: string): string {
  if (!path) return "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const normalized = withLeadingSlash.replace(/\\/g, "/").replace(/\/+/g, "/");
  return normalized.length > 1 && normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
}

function dirname(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : normalized.slice(0, lastSlash);
}

function toUint8Array(content: string | Uint8Array): Uint8Array {
  return typeof content === "string"
    ? new TextEncoder().encode(content)
    : content;
}

function createInitialFiles(
  sessionFiles?: { path: string; data: Uint8Array }[],
): Record<string, Uint8Array | string> {
  const initialFiles: Record<string, Uint8Array | string> = {
    "/home/user/uploads/.keep": "",
    ...skillFilesCache,
  };

  if (sessionFiles) {
    for (const file of sessionFiles) {
      initialFiles[file.path] = file.data;
    }
  }

  return initialFiles;
}

function invalidateBashRuntime() {
  bash = null;
  bashFs = null;
}

function refreshSkillFilesInVfs() {
  const sessionFiles = Object.entries(fs.cloneFileMap())
    .filter(([path]) => !path.startsWith("/home/skills/"))
    .map(([path, data]) => ({ path, data }));
  fs.replaceFiles(createInitialFiles(sessionFiles));
  invalidateBashRuntime();
}

function loadJustBash() {
  if (!justBashModulePromise) {
    justBashModulePromise = import("just-bash/browser");
  }
  return justBashModulePromise;
}

async function loadCustomCommands() {
  if (!customCommandsPromise) {
    customCommandsPromise = import("./custom-commands").then((module) =>
      module.getCustomCommands(),
    );
  }
  return customCommandsPromise;
}

export function setSkillFiles(
  files: Record<string, Uint8Array | string>,
): void {
  skillFilesCache = files;
  refreshSkillFilesInVfs();
}

export function clearSkillFiles(): void {
  skillFilesCache = {};
  refreshSkillFilesInVfs();
}

export function getSkillFiles(): Record<string, Uint8Array | string> {
  return { ...skillFilesCache };
}

export function getVfs(): LightweightVfs {
  return fs;
}

export async function getBash(): Promise<Bash> {
  if (!bash || !bashFs) {
    const [{ Bash, InMemoryFs }, customCommands] = await Promise.all([
      loadJustBash(),
      loadCustomCommands(),
    ]);
    bashFs = new InMemoryFs(
      createInitialFiles(
        Object.entries(fs.cloneFileMap())
          .filter(([path]) => !path.startsWith("/home/skills/"))
          .map(([path, data]) => ({ path, data })),
      ),
    );
    bash = new Bash({
      fs: bashFs,
      cwd: "/home/user",
      customCommands,
    });
  }
  return bash;
}

export async function syncBashState(): Promise<void> {
  if (!bashFs) return;

  const files: { path: string; data: Uint8Array }[] = [];
  for (const path of bashFs.getAllPaths()) {
    if (path.startsWith("/home/skills/")) continue;
    try {
      const stat = await bashFs.stat(path);
      if (stat.isFile) {
        files.push({ path, data: await bashFs.readFileBuffer(path) });
      }
    } catch {
      // skip unreadable entries
    }
  }

  fs.replaceFiles(createInitialFiles(files));
}

export function resetVfs(clearSkills: boolean = false): void {
  if (activeOperationCount > 0) {
    throw new Error(
      `Cannot reset VFS while ${activeOperationCount} operation(s) are active. ` +
        "Please wait for operations to complete.",
    );
  }

  if (clearSkills) {
    skillFilesCache = {};
  }
  fs = new LightweightVfs(createInitialFiles());
  invalidateBashRuntime();
}

export async function resetVfsWhenIdle(
  clearSkills: boolean = false,
  timeout: number = 5000,
): Promise<void> {
  const idle = await waitForVfsOperations(timeout);
  if (!idle) {
    throw new Error(
      "Timed out waiting for active file operations to finish before clearing session files.",
    );
  }
  resetVfs(clearSkills);
}

export async function restoreVfsWhenIdle(
  files: { path: string; data: Uint8Array }[],
  timeout: number = 5000,
): Promise<void> {
  const idle = await waitForVfsOperations(timeout);
  if (!idle) {
    throw new Error(
      "Timed out waiting for active file operations to finish before restoring session files.",
    );
  }
  await restoreVfs(files);
}

export async function snapshotVfs(): Promise<
  { path: string; data: Uint8Array }[]
> {
  const untrack = trackVfsOperation();
  try {
    const files: { path: string; data: Uint8Array }[] = [];
    for (const [path, data] of Object.entries(fs.cloneFileMap())) {
      if (path.startsWith("/home/skills/")) continue;
      files.push({ path, data });
    }
    return files;
  } finally {
    untrack();
  }
}

export async function restoreVfs(
  files: { path: string; data: Uint8Array }[],
): Promise<void> {
  resetVfs();

  const untrack = trackVfsOperation();
  try {
    fs.replaceFiles(createInitialFiles(files));
  } finally {
    untrack();
  }
}

export async function writeFile(
  path: string,
  content: string | Uint8Array,
): Promise<void> {
  const untrack = trackVfsOperation();
  try {
    const fullPath = path.startsWith("/") ? path : `/home/user/uploads/${path}`;
    await fs.writeFile(fullPath, content);
    invalidateBashRuntime();
  } finally {
    untrack();
  }
}

export async function readFile(path: string): Promise<string> {
  const fullPath = path.startsWith("/") ? path : `/home/user/uploads/${path}`;
  return fs.readFile(fullPath);
}

export async function readFileBuffer(path: string): Promise<Uint8Array> {
  const fullPath = path.startsWith("/") ? path : `/home/user/uploads/${path}`;
  return fs.readFileBuffer(fullPath);
}

export async function fileExists(path: string): Promise<boolean> {
  const fullPath = path.startsWith("/") ? path : `/home/user/uploads/${path}`;
  return fs.exists(fullPath);
}

export async function deleteFile(path: string): Promise<void> {
  const fullPath = path.startsWith("/") ? path : `/home/user/uploads/${path}`;
  await fs.rm(fullPath);
  invalidateBashRuntime();
}

export async function listUploads(): Promise<string[]> {
  try {
    const entries = await fs.readdir("/home/user/uploads");
    return entries.filter((entry) => entry !== ".keep");
  } catch {
    return [];
  }
}

export function trackVfsOperation(): () => void {
  activeOperationCount++;
  return () => {
    activeOperationCount--;
    if (activeOperationCount < 0) {
      activeOperationCount = 0;
    }
  };
}

export function hasActiveVfsOperations(): boolean {
  return activeOperationCount > 0;
}

export async function waitForVfsOperations(
  timeout: number = 5000,
): Promise<boolean> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (activeOperationCount === 0) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
}

export function getFileType(filename: string): {
  isImage: boolean;
  mimeType: string;
} {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const imageExts: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
    ico: "image/x-icon",
  };

  if (ext in imageExts) {
    return { isImage: true, mimeType: imageExts[ext] };
  }

  const mimeTypes: Record<string, string> = {
    txt: "text/plain",
    csv: "text/csv",
    json: "application/json",
    xml: "application/xml",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    ts: "application/typescript",
    md: "text/markdown",
    pdf: "application/pdf",
  };

  return {
    isImage: false,
    mimeType: mimeTypes[ext] || "application/octet-stream",
  };
}

export function toBase64(data: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}
