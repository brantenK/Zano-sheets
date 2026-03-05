import { spawn } from "node:child_process";

const READY_TIMEOUT_MS = 90_000;
const REQUEST_TIMEOUT_MS = 15_000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForReady(server) {
  const startedAt = Date.now();
  let output = "";

  return await new Promise((resolve, reject) => {
    const onData = (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      if (text.includes("Local:") || text.includes("ready in")) {
        resolve(output);
      }
    };

    const onExit = (code) => {
      reject(
        new Error(
          `Dev server exited before readiness (code ${code ?? "unknown"}).\n${output}`,
        ),
      );
    };

    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.once("exit", onExit);

    const interval = setInterval(() => {
      if (Date.now() - startedAt > READY_TIMEOUT_MS) {
        clearInterval(interval);
        reject(
          new Error(
            `Timed out waiting for dev server readiness after ${READY_TIMEOUT_MS}ms.\n${output}`,
          ),
        );
      }
    }, 250);
  });
}

async function probeTaskpane() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const urls = [
    "https://127.0.0.1:3000/taskpane.html",
    "http://127.0.0.1:3000/taskpane.html",
  ];

  let lastError;
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
      if (response.ok) {
        return url.startsWith("https:") ? "https" : "http";
      }
      lastError = new Error(`Unexpected status ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Taskpane probe failed: ${lastError}`);
}

async function assertPage(protocol, page) {
  const response = await fetchWithTimeout(
    `${protocol}://127.0.0.1:3000/${page}`,
    REQUEST_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw new Error(`${page} returned status ${response.status}`);
  }
}

async function main() {
  const server = spawn(
    "pnpm",
    ["exec", "vite", "--mode", "development", "--host", "127.0.0.1", "--port", "3000", "--strictPort"],
    {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env },
    },
  );

  try {
    await waitForReady(server);

    const protocol = await probeTaskpane();
    await assertPage(protocol, "taskpane.html");
    await assertPage(protocol, "commands.html");

    process.stdout.write("Smoke check passed: taskpane and commands are reachable.\n");
  } finally {
    if (!server.killed) {
      server.kill();
      await delay(500);
      if (!server.killed) {
        server.kill();
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
