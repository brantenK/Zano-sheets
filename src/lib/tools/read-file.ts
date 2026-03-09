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
import { renderPdfImagesInWorker } from "../vfs/conversion-worker-client";
import { defineTool, toolError, toolText } from "./types";

const DEFAULT_PDF_RENDER_SCALE = 1.5;
const DEFAULT_PDF_MAX_PAGES = 3;
const MAX_PDF_PAGES_PER_READ = 5;
const MAX_PDF_RENDER_CACHE_ENTRIES = 24;

type CachedPdfRender = {
  fingerprint: string;
  pageCount: number;
  images: Array<{
    pageNumber: number;
    base64: string;
  }>;
};

const pdfRenderCache = new Map<string, CachedPdfRender>();

function parsePdfPageSelection(spec: string): number[] {
  const pages = new Set<number>();

  for (const part of spec.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const rangeParts = trimmed.split("-");
    if (rangeParts.length === 2) {
      const start = Number.parseInt(rangeParts[0], 10);
      const end = Number.parseInt(rangeParts[1], 10);
      if (Number.isNaN(start) || Number.isNaN(end) || start < 1 || end < start) {
        throw new Error(
          `Invalid PDF page selection: ${spec}. Use formats like 1,3,5-8.`,
        );
      }
      for (let page = start; page <= end; page++) {
        pages.add(page);
      }
      continue;
    }

    const page = Number.parseInt(trimmed, 10);
    if (Number.isNaN(page) || page < 1) {
      throw new Error(
        `Invalid PDF page selection: ${spec}. Use formats like 1,3,5-8.`,
      );
    }
    pages.add(page);
  }

  const selectedPages = [...pages].sort((a, b) => a - b);
  if (selectedPages.length === 0) {
    throw new Error("PDF page selection was empty.");
  }
  if (selectedPages.length > MAX_PDF_PAGES_PER_READ) {
    throw new Error(
      `Read supports up to ${MAX_PDF_PAGES_PER_READ} PDF pages at once. Narrow the page selection and try again.`,
    );
  }

  return selectedPages;
}

function buildPdfFingerprint(data: Uint8Array): string {
  let hash = data.byteLength.toString(16);
  const step = Math.max(1, Math.floor(data.byteLength / 64));
  for (let index = 0; index < data.byteLength; index += step) {
    hash = `${hash}:${data[index].toString(16).padStart(2, "0")}`;
  }
  if (data.byteLength > 0) {
    hash = `${hash}:${data[data.byteLength - 1].toString(16).padStart(2, "0")}`;
  }
  return hash;
}

function buildPdfCacheKey(
  path: string,
  fingerprint: string,
  renderScale: number,
  pages: number[] | null,
  maxPages?: number,
): string {
  const pageKey = pages ? pages.join(",") : `first:${maxPages ?? DEFAULT_PDF_MAX_PAGES}`;
  return `${path}|${fingerprint}|${renderScale}|${pageKey}`;
}

function getCachedPdfRender(key: string): CachedPdfRender | null {
  const cached = pdfRenderCache.get(key);
  if (!cached) return null;

  pdfRenderCache.delete(key);
  pdfRenderCache.set(key, cached);
  return cached;
}

function setCachedPdfRender(key: string, value: CachedPdfRender) {
  if (pdfRenderCache.has(key)) {
    pdfRenderCache.delete(key);
  }
  pdfRenderCache.set(key, value);

  while (pdfRenderCache.size > MAX_PDF_RENDER_CACHE_ENTRIES) {
    const oldestKey = pdfRenderCache.keys().next().value;
    if (!oldestKey) break;
    pdfRenderCache.delete(oldestKey);
  }
}

export const readTool = defineTool({
  name: "read",
  label: "Read",
  description:
    "Read a file from the virtual filesystem. " +
    "Files are uploaded by the user to /home/user/uploads/. " +
    "Specialized skill files are in /home/skills/{skillName}/. " +
    "If a file is not found in uploads, the tool will automatically search all skill directories for a match. " +
    "For images (png, jpg, gif, webp), returns the image for you to analyze visually. " +
    "For PDFs, renders page images for visual analysis by default (first 3 pages unless you request specific pages). " +
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
    pages: Type.Optional(
      Type.String({
        description:
          "For PDF files only: page selection like '1', '1,3', or '2-4'. Max 5 pages per read.",
      }),
    ),
    renderScale: Type.Optional(
      Type.Number({
        description:
          "For PDF files only: render scale between 1 and 3. Higher values improve OCR readability but increase image size. Default 1.5.",
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

      if (mimeType === "application/pdf") {
        const renderScale =
          params.renderScale === undefined
            ? DEFAULT_PDF_RENDER_SCALE
            : params.renderScale;
        if (renderScale < 1 || renderScale > 3) {
          return toolError("PDF renderScale must be between 1 and 3.");
        }

        const selectedPages = params.pages
          ? parsePdfPageSelection(params.pages)
          : null;
        const fingerprint = buildPdfFingerprint(data);
        const cacheKey = buildPdfCacheKey(
          fullPath,
          fingerprint,
          renderScale,
          selectedPages,
          selectedPages ? undefined : DEFAULT_PDF_MAX_PAGES,
        );

        const cached = getCachedPdfRender(cacheKey);
        const result = cached
          ? {
              pageCount: cached.pageCount,
              images: cached.images.map((image) => ({
                pageNumber: image.pageNumber,
                width: 0,
                height: 0,
                data: new Uint8Array(),
                base64: image.base64,
              })),
            }
          : await renderPdfImagesInWorker(
              data,
              renderScale,
              selectedPages,
              selectedPages ? undefined : DEFAULT_PDF_MAX_PAGES,
            );

        if (!cached) {
          setCachedPdfRender(cacheKey, {
            fingerprint,
            pageCount: result.pageCount,
            images: result.images.map((image) => ({
              pageNumber: image.pageNumber,
              base64: toBase64(new Uint8Array(image.data)),
            })),
          });
        }

        const previewedPages = result.images.map((image) => image.pageNumber);
        const remainingPages = Math.max(0, result.pageCount - previewedPages.length);
        const selectionNote = params.pages
          ? `Requested pages: ${previewedPages.join(", ")}.`
          : `Showing first ${previewedPages.length} page(s).`;
        const moreNote =
          remainingPages > 0
            ? ` ${remainingPages} more page(s) are available. Use pages=... to read specific pages.`
            : "";
        const cacheNote = cached ? " Served from PDF render cache." : "";

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Read PDF file: ${filename} [${mimeType}]\n` +
                `${selectionNote} Total pages: ${result.pageCount}.${moreNote}${cacheNote}`,
            },
            ...result.images.map((image) => ({
              type: "image" as const,
              data:
                "base64" in image && typeof image.base64 === "string"
                  ? image.base64
                  : toBase64(new Uint8Array(image.data)),
              mimeType: "image/png",
            })),
          ],
          details: undefined,
        };
      }

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
