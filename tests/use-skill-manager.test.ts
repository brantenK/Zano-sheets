import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  addSkill: vi.fn().mockResolvedValue(undefined),
  removeSkill: vi.fn().mockResolvedValue(undefined),
  getInstalledSkills: vi.fn().mockResolvedValue([]),

  // React
  useCallback: vi.fn((fn: unknown) => fn),
}));

vi.mock("react", () => ({
  useCallback: mocks.useCallback,
}));

vi.mock("../src/lib/skills", () => ({
  addSkill: mocks.addSkill,
  removeSkill: mocks.removeSkill,
  getInstalledSkills: mocks.getInstalledSkills,
}));

import { useSkillManager, type SkillManagerDeps } from "../src/taskpane/components/chat/use-skill-manager";

function makeDeps(overrides: Partial<SkillManagerDeps> = {}): SkillManagerDeps {
  return {
    skillsRef: { current: [] },
    setState: vi.fn(),
    applyConfig: vi.fn(),
    ...overrides,
  };
}

/** Create a minimal File-like object with webkitRelativePath. */
function fakeFile(name: string, relativePath?: string): File {
  return {
    name,
    size: 100,
    type: "text/plain",
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    webkitRelativePath: relativePath ?? "",
  } as unknown as File;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getInstalledSkills.mockResolvedValue([]);
});

describe("useSkillManager", () => {
  describe("installSkill", () => {
    it("reads file data and calls addSkill", async () => {
      const deps = makeDeps();
      const { installSkill } = useSkillManager(deps);

      const file = fakeFile("skill.md");
      await installSkill([file]);

      expect(mocks.addSkill).toHaveBeenCalledWith([
        { path: "skill.md", data: expect.any(Uint8Array) },
      ]);
    });

    it("strips top-level folder from webkitRelativePath", async () => {
      const deps = makeDeps();
      const { installSkill } = useSkillManager(deps);

      const file = fakeFile("README.md", "my-skill/README.md");
      await installSkill([file]);

      expect(mocks.addSkill).toHaveBeenCalledWith([
        { path: "README.md", data: expect.any(Uint8Array) },
      ]);
    });

    it("handles nested paths within a skill folder", async () => {
      const deps = makeDeps();
      const { installSkill } = useSkillManager(deps);

      const file = fakeFile("data.json", "my-skill/sub/data.json");
      await installSkill([file]);

      expect(mocks.addSkill).toHaveBeenCalledWith([
        { path: "sub/data.json", data: expect.any(Uint8Array) },
      ]);
    });

    it("refreshes skills and rebuilds agent after install", async () => {
      const skills = [{ name: "my-skill", description: "A skill" }];
      mocks.getInstalledSkills.mockResolvedValue(skills);

      const setState = vi.fn();
      const applyConfig = vi.fn();
      const skillsRef = { current: [] as any[] };

      const deps = makeDeps({ setState, applyConfig, skillsRef });
      const { installSkill } = useSkillManager(deps);
      await installSkill([fakeFile("skill.md")]);

      expect(mocks.getInstalledSkills).toHaveBeenCalled();
      expect(skillsRef.current).toEqual(skills);
      expect(setState).toHaveBeenCalled();

      // The setState updater should call applyConfig if providerConfig exists
      const updater = setState.mock.calls[0][0];
      const config = { provider: "openai", apiKey: "k" };
      const result = updater({ providerConfig: config, skills: [] });
      expect(applyConfig).toHaveBeenCalledWith(config);
      expect(result.skills).toEqual(skills);
    });

    it("does not call applyConfig when providerConfig is null", async () => {
      mocks.getInstalledSkills.mockResolvedValue([]);
      const applyConfig = vi.fn();
      const setState = vi.fn();

      const deps = makeDeps({ applyConfig, setState });
      const { installSkill } = useSkillManager(deps);
      await installSkill([fakeFile("skill.md")]);

      const updater = setState.mock.calls[0][0];
      updater({ providerConfig: null, skills: [] });
      expect(applyConfig).not.toHaveBeenCalled();
    });

    it("does nothing for empty files array", async () => {
      const deps = makeDeps();
      const { installSkill } = useSkillManager(deps);

      await installSkill([]);
      expect(mocks.addSkill).not.toHaveBeenCalled();
    });

    it("sets error state when addSkill throws", async () => {
      mocks.addSkill.mockRejectedValue(new Error("parse error"));

      const setState = vi.fn();
      const deps = makeDeps({ setState });
      const { installSkill } = useSkillManager(deps);

      await installSkill([fakeFile("bad.md")]);

      expect(setState).toHaveBeenCalled();
      const errorUpdater = setState.mock.calls.find((c: any) => {
        if (typeof c[0] !== "function") return false;
        const res = c[0]({ error: null });
        return res.error !== null;
      });
      expect(errorUpdater).toBeDefined();
      if (errorUpdater) {
        const result = errorUpdater[0]({ error: null });
        expect(result.error).toBe("parse error");
      }
    });
  });

  describe("uninstallSkill", () => {
    it("calls removeSkill and refreshes skills", async () => {
      const skills = [{ name: "other-skill", description: "Remaining" }];
      mocks.getInstalledSkills.mockResolvedValue(skills);

      const setState = vi.fn();
      const skillsRef = { current: [{ name: "my-skill" }, { name: "other-skill" }] as any[] };

      const deps = makeDeps({ setState, skillsRef });
      const { uninstallSkill } = useSkillManager(deps);
      await uninstallSkill("my-skill");

      expect(mocks.removeSkill).toHaveBeenCalledWith("my-skill");
      expect(mocks.getInstalledSkills).toHaveBeenCalled();
      expect(skillsRef.current).toEqual(skills);
    });

    it("does not throw when removeSkill fails", async () => {
      mocks.removeSkill.mockRejectedValue(new Error("not found"));

      const deps = makeDeps();
      const { uninstallSkill } = useSkillManager(deps);

      // Should not throw
      await expect(uninstallSkill("missing-skill")).resolves.toBeUndefined();
    });
  });
});
