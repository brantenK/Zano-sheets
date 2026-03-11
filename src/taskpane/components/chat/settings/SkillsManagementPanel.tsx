/**
 * Skills Management Panel Component
 *
 * Displays installed skills and allows users to add new skills from folders or files.
 */

import { FolderUp, Plus, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useChat } from "../chat-context";

export function SkillsManagementPanel() {
  const { state, installSkill, uninstallSkill } = useChat();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [installing, setInstalling] = useState(false);

  const handleFolderSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setInstalling(true);
      try {
        await installSkill(Array.from(files));
      } finally {
        setInstalling(false);
        if (folderInputRef.current) folderInputRef.current.value = "";
      }
    },
    [installSkill],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setInstalling(true);
      try {
        await installSkill(Array.from(files));
      } finally {
        setInstalling(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [installSkill],
  );

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-(--chat-text-muted) mb-4">
        agent skills
      </div>

      <div className="space-y-3">
        {state.skills.length > 0 ? (
          <div className="space-y-1">
            {state.skills.map((skill) => (
              <div
                key={skill.name}
                className="flex items-start justify-between gap-2 px-3 py-2 bg-(--chat-input-bg) border border-(--chat-border)"
                style={{ borderRadius: "var(--chat-radius)" }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-(--chat-text-primary) font-medium truncate">
                    {skill.name}
                  </div>
                  <div className="text-[10px] text-(--chat-text-muted) mt-0.5 line-clamp-2">
                    {skill.description}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => uninstallSkill(skill.name)}
                  className="shrink-0 p-1 text-(--chat-text-muted) hover:text-(--chat-error) transition-colors"
                  title="Remove skill"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-(--chat-text-muted)">
            No skills installed
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            disabled={installing}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs
                       bg-(--chat-input-bg) border border-(--chat-border) text-(--chat-text-secondary)
                       hover:border-(--chat-border-active) hover:text-(--chat-text-primary)
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ borderRadius: "var(--chat-radius)" }}
          >
            <FolderUp size={12} />
            {installing ? "Installing..." : "Add Folder"}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={installing}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs
                       bg-(--chat-input-bg) border border-(--chat-border) text-(--chat-text-secondary)
                       hover:border-(--chat-border-active) hover:text-(--chat-text-primary)
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ borderRadius: "var(--chat-radius)" }}
          >
            <Plus size={12} />
            {installing ? "Installing..." : "Add File"}
          </button>
        </div>
        <p className="text-[10px] text-(--chat-text-muted)">
          Add a skill folder or a single SKILL.md file. Skills must have valid
          frontmatter with name and description.
        </p>
      </div>

      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        {...({
          webkitdirectory: "",
          directory: "",
        } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={handleFolderSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".md"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
