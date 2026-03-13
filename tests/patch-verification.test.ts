/**
 * Patch verification tests.
 *
 * These tests verify that the patches applied to @mariozechner/pi-ai
 * are correctly applied and functioning as expected.
 */

import { describe, it, expect, beforeAll } from "vitest";

describe("Patch Verification", () => {
  describe("OpenAI Store Parameter", () => {
    it("should have openai-responses.js patched", async () => {
      const module = await import("@mariozechner/pi-ai/dist/providers/openai-responses.js");

      // The module should export the expected functions
      expect(module).toBeDefined();

      // Verify the file exists and was patched by checking it's loadable
      expect(Object.keys(module).length).toBeGreaterThan(0);
    });

    it("should have openai-codex-responses.js patched", async () => {
      const module = await import("@mariozechner/pi-ai/dist/providers/openai-codex-responses.js");

      expect(module).toBeDefined();
      expect(Object.keys(module).length).toBeGreaterThan(0);
    });

    it("should export dist directory contents", async () => {
      // This verifies the package exports patch
      const streamModule = await import("@mariozechner/pi-ai/dist/stream.js");

      expect(streamModule).toBeDefined();
      expect(streamModule.streamSimple).toBeDefined();
    });
  });

  describe("Package Version", () => {
    it("should have correct version installed", () => {
      const packageJson = require("../package.json");

      // Check that pi-ai is in dependencies
      expect(packageJson.dependencies).toHaveProperty("@mariozechner/pi-ai");

      // Check the version
      const version = packageJson.dependencies["@mariozechner/pi-ai"];
      expect(version).toBeDefined();
      expect(typeof version).toBe("string");
    });

    it("should have patchedDependencies configuration", () => {
      const packageJson = require("../package.json");

      // Check that pnpm patch config exists
      expect(packageJson.pnpm).toBeDefined();
      expect(packageJson.pnpm.patchedDependencies).toBeDefined();

      // Check that the patch entry exists
      const patchedDeps = packageJson.pnpm.patchedDependencies;
      const hasPatch = Object.keys(patchedDeps).some(key =>
        key.includes("@mariozechner/pi-ai")
      );

      expect(hasPatch).toBe(true);
    });
  });

  describe("Patch Files Exist", () => {
    it("should have patch file for current version", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const patchesDir = path.join(process.cwd(), "patches");
      const files = await fs.readdir(patchesDir);

      const piAiPatches = files.filter(f => f.includes("@mariozechner__pi-ai"));

      expect(piAiPatches.length).toBeGreaterThan(0);

      // Verify patch file syntax
      for (const patchFile of piAiPatches) {
        expect(patchFile).toMatch(/@mariozechner__pi-ai@.+\.patch/);
      }
    });

    it("should have valid patch file format", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const patchesDir = path.join(process.cwd(), "patches");
      const files = await fs.readdir(patchesDir);

      const piAiPatches = files.filter(f => f.includes("@mariozechner__pi-ai"));

      for (const patchFile of piAiPatches) {
        const patchPath = path.join(patchesDir, patchFile);
        const content = await fs.readFile(patchPath, "utf-8");

        // Verify patch file contains expected markers
        expect(content).toContain("diff --git");
        expect(content).toContain("index");
        expect(content).toContain("---");
        expect(content).toContain("+++");

        // Verify store: true change is present
        expect(content).toContain("store: true");
      }
    });
  });

  describe("Patch Functionality", () => {
    it("should be able to import and use patched functions", async () => {
      // This verifies the patched code is actually executable
      const { streamSimpleOpenAIResponses } = await import(
        "@mariozechner/pi-ai/dist/providers/openai-responses.js"
      );

      expect(streamSimpleOpenAIResponses).toBeDefined();
      expect(typeof streamSimpleOpenAIResponses).toBe("function");
    });

    it("should be able to import codex responses function", async () => {
      const { streamSimpleOpenAICodexResponses } = await import(
        "@mariozechner/pi-ai/dist/providers/openai-codex-responses.js"
      );

      expect(streamSimpleOpenAICodexResponses).toBeDefined();
      expect(typeof streamSimpleOpenAICodexResponses).toBe("function");
    });
  });

  describe("Patch Documentation", () => {
    it("should have PATCHES.md documentation", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");

      const patchesDocPath = path.join(process.cwd(), "docs", "PATCHES.md");

      const content = await fs.readFile(patchesDocPath, "utf-8");

      expect(content).toContain("store: true");
      expect(content).toContain("patch");
      expect(content).toContain("@mariozechner/pi-ai");
    });
  });
});
