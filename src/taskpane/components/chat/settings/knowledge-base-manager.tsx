import { useCallback, useRef } from "react";

interface KnowledgeBaseFile {
  name: string;
  displayName: string;
  createTime?: string;
}

interface KnowledgeBaseManagerProps {
  files: KnowledgeBaseFile[];
  countLabel: string;
  updatedLabel: string | null;
  isUploading: boolean;
  onFilesSelect: (files: File[]) => Promise<void>;
  onFileRemove: (file: KnowledgeBaseFile) => Promise<void>;
}

export function KnowledgeBaseManager({
  files,
  countLabel,
  updatedLabel,
  isUploading,
  onFilesSelect,
  onFileRemove,
}: KnowledgeBaseManagerProps) {
  const kbInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (!selectedFiles || selectedFiles.length === 0) return;
      await onFilesSelect(Array.from(selectedFiles));
      if (kbInputRef.current) kbInputRef.current.value = "";
    },
    [onFilesSelect],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted)">
          knowledge base
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-(--chat-text-muted)">
          <span className="px-2 py-0.5 border border-(--chat-border) bg-(--chat-bg)">
            {countLabel}
          </span>
          {updatedLabel && (
            <span className="px-2 py-0.5 border border-(--chat-border) bg-(--chat-bg)">
              Updated {updatedLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={kbInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.txt,.docx,.md,.csv,.json,.xml"
        />
        <button
          type="button"
          onClick={() => kbInputRef.current?.click()}
          className="px-3 py-2 text-xs bg-(--chat-input-bg) border border-(--chat-border) text-(--chat-text-primary) hover:border-(--chat-border-active)"
          style={{ borderRadius: "var(--chat-radius)" }}
        >
          Upload to Knowledge Base
        </button>
        {isUploading && (
          <span className="inline-flex items-center gap-1 text-[10px] text-(--chat-text-muted)">
            <span className="h-2 w-2 rounded-full bg-(--chat-accent) animate-pulse" />
            Uploading...
          </span>
        )}
      </div>

      {files.length > 0 ? (
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.name}
              className="flex items-center justify-between text-[11px] px-2 py-1 bg-(--chat-bg) border border-(--chat-border)"
              style={{ borderRadius: "var(--chat-radius)" }}
            >
              <span className="truncate" title={file.displayName}>
                {file.displayName}
              </span>
              <button
                type="button"
                onClick={() => onFileRemove(file)}
                className="text-(--chat-error) text-[10px] hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-(--chat-text-muted)">
          No knowledge base files yet.
        </p>
      )}
    </div>
  );
}
