import { Type } from "@sinclair/typebox";
import { checkToolApproval } from "../../taskpane/components/chat/chat-context";
import { startPerfSpan } from "../perf-telemetry";
import { markBashWorkflowStart } from "../startup-telemetry";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateTail,
} from "../truncate";
import { getBash, getVfs, syncBashState } from "../vfs";
import { defineTool, toolError, toolSuccess } from "./types";

export const bashTool = defineTool({
  name: "bash",
  label: "Bash",
  description:
    "Execute bash commands in a sandboxed virtual environment. " +
    `Output is truncated to last ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). ` +
    "DATA INTEGRITY WARNING: Because output is truncated, NEVER use 'cat', 'tail', or 'head' to read large files (e.g., General Ledgers) for the purpose of calculating totals or verifying data. " +
    "You will only see a fraction of the data and will produce WRONG results. " +
    "Instead, ALWAYS use processing tools like 'awk', 'grep', 'sed', or 'wc' to perform calculations INSIDE the sandbox and only output the final results/summaries. " +
    "Useful for: file operations (ls, cat, grep, find), text processing (awk, sed, jq, sort, uniq), " +
    "data analysis (wc, cut, paste), and general scripting. " +
    "Network access is disabled. No external runtimes (node, python, etc.) are available.",
  parameters: Type.Object({
    command: Type.String({
      description:
        "Bash command(s) to execute. Can be a single command or a script with multiple lines. " +
        "Supports pipes (|), redirections (>, >>), command chaining (&&, ||, ;), " +
        "variables, loops, conditionals, and functions.",
    }),
    explanation: Type.Optional(
      Type.String({
        description: "Brief explanation (max 50 chars)",
        maxLength: 50,
      }),
    ),
  }),
  execute: async (toolCallId, params) => {
    const span = startPerfSpan("bash_command_ms");
    try {
      await checkToolApproval(toolCallId);
      markBashWorkflowStart();

      const command = params.command.trim();
      const largeFileLimit = 1 * 1024 * 1024;

      const restrictedCommands = ["cat", "tail", "head"];
      const parts = command.split(/\s+/);
      const baseCmd = parts[0];

      if (restrictedCommands.includes(baseCmd)) {
        const filePath = parts.find((p) => p.includes("/") || p.includes("."));
        if (filePath) {
          const vfs = await getVfs();
          try {
            const absolutePath = filePath.startsWith("/")
              ? filePath
              : `/home/user/${filePath.replace(/^uploads\//, "uploads/")}`;

            if (await vfs.exists(absolutePath)) {
              const stat = await vfs.stat(absolutePath);
              if (stat.size > largeFileLimit) {
                return toolError(
                  `SECURITY/INTEGRITY BLOCK: The command '${baseCmd}' is disabled for files larger than 1MB (${formatSize(stat.size)}). ` +
                    "Reading large files directly causes truncation which leads to incorrect calculations. " +
                    "Please use 'awk', 'grep', or 'wc' to process data INSIDE the sandbox and only return the results.",
                );
              }
            }
          } catch {
            // file might not exist yet or be a pipe, let bash handle it
          }
        }
      }

      const bash = await getBash();
      const result = await bash.exec(params.command);
      await syncBashState();

      let output = "";

      if (result.stdout) {
        output += result.stdout;
      }

      if (result.stderr) {
        if (output && !output.endsWith("\n")) output += "\n";
        output += `stderr: ${result.stderr}`;
      }

      if (result.exitCode !== 0) {
        if (output && !output.endsWith("\n")) output += "\n";
        output += `[exit code: ${result.exitCode}]`;
      }

      if (!output) {
        output = "[no output]";
      }

      output = output.trim();

      const truncation = truncateTail(output);
      let outputText = truncation.content;

      if (truncation.truncated) {
        const startLine = truncation.totalLines - truncation.outputLines + 1;
        const endLine = truncation.totalLines;
        if (truncation.truncatedBy === "lines") {
          outputText += `\n\n[Showing last ${truncation.outputLines} of ${truncation.totalLines} lines. Output truncated.]`;
        } else {
          outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Output truncated.]`;
        }
      }

      return toolSuccess({ output: outputText, exitCode: result.exitCode });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error executing bash command";
      return toolError(message);
    } finally {
      span.end();
    }
  },
});
