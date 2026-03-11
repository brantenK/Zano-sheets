import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    alias: [
      { find: /^@mariozechner\/pi-ai\/dist\/(.*)\.js$/, replacement: "@mariozechner/pi-ai/dist/$1" }
    ]
  },
});
