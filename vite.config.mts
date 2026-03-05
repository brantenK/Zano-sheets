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
      },
    },

    resolve: {
      alias: {
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
        "node:path": path.resolve(__dirname, "src/shims/empty.js"),
        "node:crypto": path.resolve(__dirname, "src/shims/empty.js"),
        "node:http": path.resolve(__dirname, "src/shims/empty.js"),
        "node:zlib": path.resolve(__dirname, "src/shims/empty.js"),
        http: path.resolve(__dirname, "src/shims/empty.js"),
      },
    },

    define: {
      "process.env": JSON.stringify({}),
      "process.versions": "undefined",
      "process.browser": JSON.stringify(true),
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
