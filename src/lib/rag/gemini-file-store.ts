import { getGeminiApiKey } from "./gemini-auth";

/** Represents a file uploaded to Gemini */
export interface GeminiFile {
  name: string; // e.g. "files/xyz123"
  displayName: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  state: "PROCESSING" | "ACTIVE" | "FAILED";
  error?: { message: string };
}

export async function uploadFileToGemini(
  file: File | Blob,
  displayName: string,
  mimeType: string,
): Promise<GeminiFile> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Gemini API Key is not configured.");

  // Upload requires two steps or a multipart request. We use multipart for simplicity.
  const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;

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
  return data.file as GeminiFile;
}

export async function getFileStatus(fileName: string): Promise<GeminiFile> {
  const apiKey = getGeminiApiKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to get file status");
  return (await res.json()) as GeminiFile;
}
