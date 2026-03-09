import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require("./package.json");

// just-bash ships a dedicated browser bundle; point directly at it so Vite keeps the browser-only graph.
const justBashBrowserPath = fileURLToPath(import.meta.resolve("just-bash/browser"));

async function getHttpsOptions() {
  try {
    const devCerts = await import("office-addin-dev-certs");
    const certs = await devCerts.getHttpsServerOptions();
    return { ca: certs.ca, key: certs.key, cert: certs.cert };
  } catch {
    console.warn("Could not load office-addin-dev-certs, HTTPS disabled");
    return undefined;
  }
}

export default defineConfig(async ({ mode }) => {
  const dev = mode === "development";
  const urlDev = "https://localhost:3000/";
  const urlProd = "https://zano-sheets.pages.dev/";

  return {
    root: "src",
    publicDir: "../public",

    build: {
      outDir: "../dist",
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: {
          taskpane: path.resolve(__dirname, "src/taskpane.html"),
          commands: path.resolve(__dirname, "src/commands.html"),
        },
        output: {
          manualChunks: (id: string) => {
            const normalizedId = id.replace(/\\/g, "/");
            if (normalizedId.includes("vite/preload-helper.js")) {
              return "ui-vendor";
            }
            if (!normalizedId.includes("/node_modules/")) {
              return undefined;
            }

            if (
              normalizedId.includes("/react/") ||
              normalizedId.includes("/react-dom/") ||
              normalizedId.includes("/scheduler/") ||
              normalizedId.includes("/@sentry/")
            ) {
              return "ui-vendor";
            }
            if (normalizedId.includes("/@mariozechner/pi-agent-core/")) {
              return "agent";
            }
            if (
              normalizedId.includes("/@mariozechner/pi-ai/dist/models") ||
              normalizedId.includes("/@mariozechner/pi-ai/dist/models.generated")
            ) {
              return "ai-models";
            }
            if (
              normalizedId.includes("/@mariozechner/pi-ai/dist/stream") ||
              normalizedId.includes("/@mariozechner/pi-ai/dist/providers/") ||
              normalizedId.includes("/@mariozechner/pi-ai/dist/api-registry") ||
              normalizedId.includes("/@mariozechner/pi-ai/dist/env-api-keys") ||
              normalizedId.includes("/@mariozechner/pi-ai/dist/utils/")
            ) {
              return "ai-stream";
            }
            if (normalizedId.includes("/@mariozechner/pi-ai/")) {
              return "ai-core";
            }

            if (normalizedId.includes("/streamdown/")) {
              return "markdown";
            }
            if (normalizedId.includes("/pdfjs-dist/")) {
              return "pdfjs";
            }
            if (normalizedId.includes("/xlsx/")) {
              return "xlsx";
            }

            if (normalizedId.includes("/just-bash/")) {
              return "bash-runtime";
            }
            if (normalizedId.includes("/mammoth/")) {
              return "docx-tools";
            }
            if (
              normalizedId.includes("/turndown/") ||
              normalizedId.includes("/@mozilla/readability/")
            ) {
              return "web-document-tools";
            }
            return undefined;
          },
        },
      },
    },

    resolve: {
      alias: {
        "just-bash/browser": justBashBrowserPath,
        "node:util/types": path.resolve(__dirname, "src/shims/util-types-shim.js"),
        process: "rollup/empty",
        // Shim server-only Node.js built-ins pulled in by pi-ai's OAuth/streaming code.
        // These modules are never actually called in the browser add-in context.
        "node:fs": path.resolve(__dirname, "src/shims/node-fs"),
        "node:fs/promises": path.resolve(
          __dirname,
          "src/shims/node-fs/promises.js",
        ),
        "fs/promises": path.resolve(__dirname, "src/shims/node-fs/promises.js"),
        "node:os": path.resolve(__dirname, "src/shims/empty.js"),
        "node:module": path.resolve(__dirname, "src/shims/empty.js"),
        "node:path": path.resolve(__dirname, "src/shims/empty.js"),
        "node:url": path.resolve(__dirname, "src/shims/empty.js"),
        "node:crypto": path.resolve(__dirname, "src/shims/empty.js"),
        "node:http": path.resolve(__dirname, "src/shims/empty.js"),
        "node:worker_threads": path.resolve(__dirname, "src/shims/empty.js"),
        "node:zlib": path.resolve(__dirname, "src/shims/empty.js"),
        "node-liblzma": path.resolve(__dirname, "src/shims/empty.js"),
        "@mongodb-js/zstd": path.resolve(__dirname, "src/shims/empty.js"),
        http: path.resolve(__dirname, "src/shims/empty.js"),
      },
    },

    worker: {
      format: "es",
    },

    optimizeDeps: {
      // just-bash ships browser code with top-level await that the dev optimizer
      // tries to downlevel for older targets, which breaks local dev startup.
      exclude: ["just-bash/browser", "just-bash"],
    },

    define: {
      "process.env": JSON.stringify({}),
      "process.versions": "undefined",
      "process.browser": JSON.stringify(true),
      __BROWSER__: JSON.stringify(true),
      __APP_VERSION__: JSON.stringify(pkg.version),
      global: "globalThis",
    },

    css: {
      postcss: {
        plugins: [tailwindcss(), autoprefixer()],
      },
    },

    plugins: [
      react(),

      viteStaticCopy({
        targets: [
          {
            src: "../manifest*.xml",
            dest: ".",
            transform: {
              encoding: "utf8",
              handler(content: string) {
                if (dev) return content;
                return content.replace(new RegExp(urlDev, "g"), urlProd);
              },
            },
          },
        ],
      }),
    ],

    server: {
      https: await getHttpsOptions(),
      port: 3000,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  };
});
