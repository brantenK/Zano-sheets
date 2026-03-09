import { Type } from "@sinclair/typebox";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,
} from "../truncate";
import {
  fileExists,
  getFileType,
  getVfs,
  listUploads,
  readFileBuffer,
  toBase64,
} from "../vfs";
import { defineTool, toolError, toolText } from "./types";

export const readTool = defineTool({
  name: "read",
  label: "Read",
  description:
    "Read a file from the virtual filesystem. " +
    "Files are uploaded by the user to /home/user/uploads/. " +
    "Specialized skill files are in /home/skills/{skillName}/. " +
    "If a file is not found in uploads, the tool will automatically search all skill directories for a match. " +
    "For images (png, jpg, gif, webp), returns the image for you to analyze visually. " +
    `For text files, output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). ` +
    "Use offset/limit for large files. When you need the full file, continue with offset until complete. " +
    "Use 'bash ls /home/user/uploads' to see available files.",
  parameters: Type.Object({
    path: Type.String({
      description:
        "Path to the file. Can be absolute (starting with /) or relative to /home/user/uploads/ or a skill directory.",
    }),
    offset: Type.Optional(
      Type.Number({
        description: "Line number to start reading from (1-indexed)",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: "Maximum number of lines to read",
      }),
    ),
    explanation: Type.Optional(
      Type.String({
        description: "Brief explanation (max 50 chars)",
        maxLength: 50,
      }),
    ),
  }),
  execute: async (_toolCallId, params) => {
    try {
      const path = params.path;
      let fullPath = path.startsWith("/") ? path : `/home/user/uploads/${path}`;

      if (!(await fileExists(fullPath))) {
        if (!path.startsWith("/")) {
          const vfs = await getVfs();
          const allPaths = vfs.getAllPaths();
          const skillMatches = allPaths.filter(
            (p) => p.startsWith("/home/skills/") && p.endsWith(`/${path}`),
          );

          if (skillMatches.length === 1) {
            fullPath = skillMatches[0];
          } else if (skillMatches.length > 1) {
            return toolError(
              `Ambiguous path: '${path}' exists in multiple skills: ${skillMatches.join(", ")}. Please use an absolute path.`,
            );
          } else {
            const uploads = await listUploads();
            const hint =
              uploads.length > 0
                ? `Available uploads: ${uploads.join(", ")}`
                : "No files uploaded yet.";
            return toolError(`File not found: ${path}. ${hint}`);
          }
        } else {
          return toolError(`File not found: ${fullPath}`);
        }
      }

      const filename = fullPath.split("/").pop() || "";
      const { isImage, mimeType } = getFileType(filename);

      if (isImage) {
        const data = await readFileBuffer(fullPath);
        const base64 = toBase64(data);
        return {
          content: [
            {
              type: "text" as const,
              text: `Read image file: ${filename} [${mimeType}]`,
            },
            { type: "image" as const, data: base64, mimeType },
          ],
          details: undefined,
        };
      }

      const data = await readFileBuffer(fullPath);
      const decoder = new TextDecoder();
      const text = decoder.decode(data);

      const allLines = text.split("\n");
      const totalFileLines = allLines.length;
      const startLine = params.offset ? Math.max(0, params.offset - 1) : 0;
      const startLineDisplay = startLine + 1;

      if (startLine >= allLines.length) {
        return toolError(
          `Offset ${params.offset} is beyond end of file (${allLines.length} lines total)`,
        );
      }

      let selectedContent: string;
      let userLimitedLines: number | undefined;

      if (params.limit !== undefined) {
        const endLine = Math.min(startLine + params.limit, allLines.length);
        selectedContent = allLines.slice(startLine, endLine).join("\n");
        userLimitedLines = endLine - startLine;
      } else {
        selectedContent = allLines.slice(startLine).join("\n");
      }

      const truncation = truncateHead(selectedContent);
      let outputText: string;

      if (truncation.truncated) {
        const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
        const nextOffset = endLineDisplay + 1;
        outputText = truncation.content;

        if (truncation.truncatedBy === "lines") {
          outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
        } else {
          outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
        }
      } else if (
        userLimitedLines !== undefined &&
        startLine + userLimitedLines < allLines.length
      ) {
        const remaining = allLines.length - (startLine + userLimitedLines);
        const nextOffset = startLine + userLimitedLines + 1;
        outputText = truncation.content;
        outputText += `\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
      } else {
        outputText = truncation.content;
      }

      return toolText(outputText);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error reading file";
      return toolError(message);
    }
  },
});
