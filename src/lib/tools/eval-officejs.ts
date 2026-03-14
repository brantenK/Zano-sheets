import { Type } from "@sinclair/typebox";
import type { DirtyRange } from "../dirty-tracker";
import { createTrackedContext } from "../excel/tracked-context";
import { sandboxedEval } from "../sandbox";
import { checkToolApproval } from "../tool-approval";
import { defineTool, toolError, toolSuccess } from "./types";

/* global Excel */

const MUTATION_PATTERNS = [
  /\.(values|formulas|numberFormat)\s*=/,
  /\.clear\s*\(/,
  /\.delete\s*\(/,
  /\.insert\s*\(/,
  /\.copyFrom\s*\(/,
  /\.add\s*\(/,
];

const SECURITY_BLOCK_PATTERNS = [
  {
    regex: /while\s*\(\s*true\s*\)/i,
    label: "Potential infinite loop (while true)",
  },
  {
    regex: /for\s*\(\s*;\s*;\s*\)/i,
    label: "Potential infinite loop (for empty)",
  },
  { regex: /localStorage\./i, label: "Direct storage access blocked" },
  { regex: /indexedDB\./i, label: "Direct DB access blocked" },
  { regex: /\b(eval|Function)\s*\(/i, label: "Dynamic code execution blocked" },
];

const DEFAULT_EVAL_TIMEOUT_MS = 15000;
const MIN_EVAL_TIMEOUT_MS = 1000;
const MAX_EVAL_TIMEOUT_MS = 60000;
const LOOP_PATTERN = /\b(for|while|do)\b/;
const AWAIT_PATTERN = /\bawait\b/;

function hasLoopWithoutAwait(code: string): boolean {
  if (!LOOP_PATTERN.test(code)) return false;
  return !AWAIT_PATTERN.test(code);
}

function normalizeTimeoutMs(value?: number): number {
  if (!value || !Number.isFinite(value)) return DEFAULT_EVAL_TIMEOUT_MS;
  return Math.min(MAX_EVAL_TIMEOUT_MS, Math.max(MIN_EVAL_TIMEOUT_MS, value));
}

function securityScan(code: string): string | null {
  for (const pattern of SECURITY_BLOCK_PATTERNS) {
    if (pattern.regex.test(code)) {
      return pattern.label;
    }
  }
  return null;
}

function looksLikeMutation(code: string): boolean {
  return MUTATION_PATTERNS.some((p) => p.test(code));
}

export const evalOfficeJsTool = defineTool({
  name: "eval_officejs",
  label: "Execute Office.js Code",
  description:
    "Execute arbitrary Office.js code within an Excel.run context. " +
    "Use this as an escape hatch when existing tools don't cover your use case. " +
    "The code runs inside `Excel.run(async (context) => { ... })` with `context` available. " +
    "Return a value to get it back as the result.\n\n" +
    "CRITICAL -- Office.js lazy-loading rule: You CANNOT read any property of an Office.js object " +
    "until you have (1) called .load('propertyName') on the object AND (2) called `await context.sync()`. " +
    "Accessing a property before loading it throws: \"The property '...' is not available. " +
    "Before reading the property's value, call the load method...\"\n\n" +
    "Pattern for reading properties:\n" +
    "  const sheet = context.workbook.worksheets.getActiveWorksheet();\n" +
    "  sheet.load('name');          // must load before reading\n" +
    "  await context.sync();        // must sync before accessing\n" +
    "  return sheet.name;           // now safe to read\n\n" +
    "Pattern for reading a collection:\n" +
    "  const sheets = context.workbook.worksheets;\n" +
    "  sheets.load('items/name,items/id');  // load nested properties\n" +
    "  await context.sync();\n" +
    "  return sheets.items.map(s => s.name);\n\n" +
    "You can batch multiple loads before a single sync for efficiency.",
  parameters: Type.Object({
    code: Type.String({
      description:
        "JavaScript code to execute. Has access to `context` (Excel.RequestContext). " +
        "Must be valid async code. Return a value to get it as result. " +
        "ALWAYS call .load('property') before reading any property, then await context.sync(). " +
        "Example: `const range = context.workbook.worksheets.getActiveWorksheet().getRange('A1'); range.load('address,values'); await context.sync(); return { address: range.address, values: range.values };`",
    }),
    timeoutMs: Type.Optional(
      Type.Number({
        description: "Abort if execution exceeds this time (1s-60s).",
        minimum: 1000,
        maximum: 60000,
      }),
    ),
    explanation: Type.Optional(
      Type.String({
        description: "Brief explanation of what this code does (max 100 chars)",
        maxLength: 100,
      }),
    ),
  }),
  execute: async (_toolCallId, params) => {
    try {
      await checkToolApproval(_toolCallId, "eval_officejs");
      const securityViolation = securityScan(params.code);
      if (securityViolation) {
        return toolError(`Security Policy Violation: ${securityViolation}`);
      }

      if (hasLoopWithoutAwait(params.code)) {
        return toolError(
          "Potential infinite loop detected. Loops without `await` are blocked. Add an await (e.g., context.sync()) inside the loop or refactor the logic.",
        );
      }

      const timeoutMs = normalizeTimeoutMs(params.timeoutMs);
      let timeoutId: number | null = null;
      let timedOut = false;

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          timedOut = true;
          reject(new Error(`Execution timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      });

      let dirtyRanges: DirtyRange[] = [];

      const execPromise = Excel.run(async (context) => {
        const { trackedContext, getDirtyRanges } =
          createTrackedContext(context);

        const execResult = await sandboxedEval(params.code, {
          context: trackedContext,
          Excel,
        });

        dirtyRanges = getDirtyRanges();
        return execResult;
      }).catch((err) => {
        if (timedOut) {
          console.warn(
            "[eval_officejs] Execution finished after timeout.",
            err,
          );
          return undefined;
        }
        throw err;
      });

      let result: unknown;
      try {
        result = await Promise.race([execPromise, timeoutPromise]);
      } finally {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      }

      if (dirtyRanges.length === 0 && looksLikeMutation(params.code)) {
        dirtyRanges = [{ sheetId: -1, range: "*" }];
      }

      const response: Record<string, unknown> = {
        success: true,
        result: result ?? null,
      };
      if (dirtyRanges.length > 0) {
        response._dirtyRanges = dirtyRanges;
      }
      return toolSuccess(response);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error executing code";
      return toolError(message);
    }
  },
});
