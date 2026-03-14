import { getGeminiRuntimeConfig } from "./gemini-auth";
import type { KnowledgeBaseFileRecord } from "./types";

const FILE_POLL_INTERVAL_MS = 1500;
const FILE_READY_TIMEOUT_MS = 2 * 60 * 1000;

function normalizeGeminiFile(
  file: Partial<KnowledgeBaseFileRecord> & { name: string },
): KnowledgeBaseFileRecord {
  return {
    name: file.name,
    uri: file.uri ?? "",
    displayName: file.displayName ?? file.name,
    mimeType: file.mimeType ?? "application/octet-stream",
    sizeBytes: file.sizeBytes ?? "0",
    createTime: file.createTime ?? new Date().toISOString(),
    state: file.state ?? "PROCESSING",
    error: file.error,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function uploadFileToGemini(
  file: File | Blob,
  displayName: string,
  mimeType: string,
): Promise<KnowledgeBaseFileRecord> {
  const runtime = await getGeminiRuntimeConfig();
  if (!runtime) {
    throw new Error(
      "Gemini is not configured. Use Google as the active chat provider or add a Gemini override key in Web settings.",
    );
  }

  // Upload requires two steps or a multipart request. We use multipart for simplicity.
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files`;

  const metadata = {
    file: { displayName, mimeType },
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  formData.append("file", file, displayName);

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "multipart",
      "x-goog-api-key": runtime.apiKey,
    },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to upload file to Gemini: ${res.status} ${errText}`,
    );
  }

  const data = await res.json();
  const uploaded = normalizeGeminiFile(data.file as { name: string });
  if (uploaded.state === "FAILED") {
    throw new Error(uploaded.error?.message || "Gemini rejected the file.");
  }
  if (uploaded.state === "ACTIVE" && uploaded.uri) {
    return uploaded;
  }

  return waitForFileToBecomeActive(uploaded.name);
}

export async function getFileStatus(
  fileName: string,
): Promise<KnowledgeBaseFileRecord> {
  const runtime = await getGeminiRuntimeConfig();
  if (!runtime) {
    throw new Error(
      "Gemini is not configured. Use Google as the active chat provider or add a Gemini override key in Web settings.",
    );
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/${fileName}`;
  const res = await fetch(url, {
    headers: {
      "x-goog-api-key": runtime.apiKey,
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to get file status: ${res.status} ${errText}`);
  }
  const data = await res.json();
  const file = "file" in data ? data.file : data;
  return normalizeGeminiFile(file as { name: string });
}

export async function waitForFileToBecomeActive(
  fileName: string,
  options?: { timeoutMs?: number; pollIntervalMs?: number },
): Promise<KnowledgeBaseFileRecord> {
  const timeoutMs = options?.timeoutMs ?? FILE_READY_TIMEOUT_MS;
  const pollIntervalMs = options?.pollIntervalMs ?? FILE_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const file = await getFileStatus(fileName);
    if (file.state === "FAILED") {
      throw new Error(file.error?.message || "Gemini file processing failed.");
    }
    if (file.state === "ACTIVE" && file.uri) {
      return file;
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(
    "Gemini file processing timed out before the document became queryable.",
  );
}
