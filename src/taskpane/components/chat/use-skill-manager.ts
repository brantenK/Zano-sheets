import { useCallback } from "react";
import type { ProviderConfig } from "../../../lib/provider-config";
import {
  addSkill,
  getInstalledSkills,
  removeSkill,
  type SkillMeta,
} from "../../../lib/skills";

import type { ChatState } from "./chat-context";

export interface SkillManagerDeps {
  skillsRef: React.MutableRefObject<SkillMeta[]>;
  setState: React.Dispatch<React.SetStateAction<ChatState>>;
  applyConfig: (config: ProviderConfig) => void;
}

export function useSkillManager(deps: SkillManagerDeps) {
  const { skillsRef, setState, applyConfig } = deps;

  const refreshSkillsAndRebuildAgent = useCallback(async () => {
    skillsRef.current = await getInstalledSkills();
    setState((prev) => {
      // Re-apply config to rebuild agent with updated system prompt
      if (prev.providerConfig) {
        applyConfig(prev.providerConfig);
      }
      return { ...prev, skills: skillsRef.current };
    });
  }, [applyConfig, skillsRef, setState]);

  const installSkill = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      try {
        const inputs = await Promise.all(
          files.map(async (f) => {
            // For folder uploads, webkitRelativePath is "folderName/file.md"
            // Strip the top-level folder to get the relative path within the skill
            const fullPath = f.webkitRelativePath || f.name;
            const parts = fullPath.split("/");
            const path = parts.length > 1 ? parts.slice(1).join("/") : parts[0];
            return { path, data: new Uint8Array(await f.arrayBuffer()) };
          }),
        );
        await addSkill(inputs);
        await refreshSkillsAndRebuildAgent();
      } catch (err) {
        console.error("[Chat] Failed to install skill:", err);
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to install skill",
        }));
      }
    },
    [refreshSkillsAndRebuildAgent, setState],
  );

  const uninstallSkill = useCallback(
    async (name: string) => {
      try {
        await removeSkill(name);
        await refreshSkillsAndRebuildAgent();
      } catch (err) {
        console.error("[Chat] Failed to uninstall skill:", err);
      }
    },
    [refreshSkillsAndRebuildAgent],
  );

  return { installSkill, uninstallSkill };
}
