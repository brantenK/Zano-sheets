export type GeminiFileState = "PROCESSING" | "ACTIVE" | "FAILED";

export interface GeminiFileError {
  message: string;
}

export interface KnowledgeBaseFileRecord {
  name: string;
  uri: string;
  displayName: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  state: GeminiFileState;
  error?: GeminiFileError;
}
