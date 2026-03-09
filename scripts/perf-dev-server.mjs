import http from "node:http";
import https from "node:https";

const ITERATIONS = 20;
const REQUEST_TIMEOUT_MS = 10_000;

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * p) - 1);
  return sorted[index] ?? 0;
}

async function requestWithTimeout(url, timeoutMs) {
  const parsed = new URL(url);
  const client = parsed.protocol === "https:" ? https : http;
  const startedAt = performance.now();

  return await new Promise((resolve, reject) => {
    const req = client.request(
      url,
      {
        method: "GET",
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        res.resume();
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            elapsed: performance.now() - startedAt,
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`));
    });
    req.on("error", (err) => reject(err));
    req.end();
  });
}

async function runEndpoint(url) {
  const timings = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const { statusCode, elapsed } = await requestWithTimeout(
      url,
      REQUEST_TIMEOUT_MS,
    );
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(
        `${url} returned status ${statusCode} on iteration ${i + 1}`,
      );
    }
    timings.push(elapsed);
  }

  const avg = timings.reduce((sum, t) => sum + t, 0) / timings.length;
  const p95 = percentile(timings, 0.95);
  const max = Math.max(...timings);

  return {
    avg: Number(avg.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    max: Number(max.toFixed(2)),
  };
}

async function main() {
  const bases = [
    "https://localhost:3000",
    "https://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  const endpoints = ["taskpane.html", "commands.html"];

  for (const endpoint of endpoints) {
    let lastError = null;
    let done = false;
    for (const base of bases) {
      try {
        const stats = await runEndpoint(`${base}/${endpoint}`);
        process.stdout.write(
          `${endpoint} (${base}): avg=${stats.avg}ms p95=${stats.p95}ms max=${stats.max}ms (${ITERATIONS} reqs)\n`,
        );
        done = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!done) {
      throw lastError ?? new Error(`Failed to probe ${endpoint}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
