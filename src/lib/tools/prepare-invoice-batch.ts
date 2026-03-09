import { Type } from "@sinclair/typebox";
import { extractPdfTextInWorker, renderPdfImagesInWorker } from "../vfs/conversion-worker-client";
import { fileExists, getFileType, getVfs, listUploads, readFileBuffer } from "../vfs";
import { defineTool, toolError, toolSuccess } from "./types";

const DEFAULT_PREVIEW_PAGES = 1;
const DEFAULT_RENDER_SCALE = 1.25;
const DEFAULT_TEXT_PAGES = 2;
const MAX_FILES_PER_BATCH = 10;
const MAX_PREVIEW_PAGES = 2;
const MAX_TEXT_PREVIEW_CHARS = 1200;

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "invoice";
}

function buildFingerprint(data: Uint8Array): string {
  let hash = data.byteLength.toString(16);
  const step = Math.max(1, Math.floor(data.byteLength / 64));
  for (let index = 0; index < data.byteLength; index += step) {
    hash = `${hash}${data[index].toString(16).padStart(2, "0")}`;
  }
  return hash.slice(0, 24);
}

async function resolveUploadPath(path: string): Promise<string> {
  const fullPath = path.startsWith("/") ? path : `/home/user/uploads/${path}`;
  if (await fileExists(fullPath)) return fullPath;

  const uploads = await listUploads();
  throw new Error(
    `File not found: ${path}. ${uploads.length > 0 ? `Available uploads: ${uploads.join(", ")}` : "No files uploaded yet."}`,
  );
}

function normalizePreviewText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_PREVIEW_CHARS);
}

function classifyTextLayer(text: string): {
  textLayerLikelyUsable: boolean;
  boxedGlyphRatio: number;
  recommendedSource: "text" | "image";
} {
  const normalized = normalizePreviewText(text);
  const boxedMatches = normalized.match(/[□▢▣▤▥▦▧▨▩◻◼◽◾]/g) ?? [];
  const alphaNumericMatches = normalized.match(/[A-Za-z0-9]/g) ?? [];
  const boxedGlyphRatio = normalized.length > 0 ? boxedMatches.length / normalized.length : 0;
  const textLayerLikelyUsable = alphaNumericMatches.length >= 40 && boxedGlyphRatio < 0.08;

  return {
    textLayerLikelyUsable,
    boxedGlyphRatio,
    recommendedSource: textLayerLikelyUsable ? "text" : "image",
  };
}

export const prepareInvoiceBatchTool = defineTool({
  name: "prepare_invoice_batch",
  label: "Prepare Invoice Batch",
  description:
    "Preflight multiple invoice PDFs for batch extraction. " +
    "Processes files one by one, renders lightweight preview page images into the VFS, " +
    "checks whether a usable PDF text layer exists, and returns a structured summary so you can " +
    "work through many invoices incrementally without loading every page image into context.",
  parameters: Type.Object({
    files: Type.Array(
      Type.String({
        description:
          "Invoice PDF paths. Use uploaded filenames like 'invoice1.pdf' or absolute VFS paths.",
      }),
      {
        minItems: 1,
        maxItems: MAX_FILES_PER_BATCH,
      },
    ),
    previewPagesPerFile: Type.Optional(
      Type.Number({
        description:
          "How many preview pages to render per invoice. Default 1, max 2.",
      }),
    ),
    renderScale: Type.Optional(
      Type.Number({
        description:
          "Preview render scale between 1 and 2. Default 1.25.",
      }),
    ),
    textPreviewPages: Type.Optional(
      Type.Number({
        description:
          "How many pages to inspect for embedded text. Default 2.",
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
      const previewPagesPerFile = Math.min(
        MAX_PREVIEW_PAGES,
        Math.max(1, params.previewPagesPerFile ?? DEFAULT_PREVIEW_PAGES),
      );
      const textPreviewPages = Math.max(1, params.textPreviewPages ?? DEFAULT_TEXT_PAGES);
      const renderScale = params.renderScale ?? DEFAULT_RENDER_SCALE;

      if (renderScale < 1 || renderScale > 2) {
        return toolError("renderScale must be between 1 and 2.");
      }

      const vfs = getVfs();
      const summaries = [] as Array<Record<string, unknown>>;

      for (const inputPath of params.files) {
        const fullPath = await resolveUploadPath(inputPath);
        const filename = fullPath.split("/").pop() || inputPath;
        const { mimeType } = getFileType(filename);

        if (mimeType !== "application/pdf") {
          summaries.push({
            file: filename,
            path: fullPath,
            success: false,
            error: "Only PDF files are supported by prepare_invoice_batch.",
          });
          continue;
        }

        const data = await readFileBuffer(fullPath);
        const fingerprint = buildFingerprint(data);
        const previewDir = `/home/user/uploads/.invoice-previews/${sanitizeSegment(filename)}-${fingerprint}`;

        const [textResult, imageResult] = await Promise.all([
          extractPdfTextInWorker(data, textPreviewPages),
          renderPdfImagesInWorker(data, renderScale, null, previewPagesPerFile),
        ]);

        const previewImagePaths: string[] = [];
        for (const image of imageResult.images) {
          const pagePath = `${previewDir}/page-${image.pageNumber}.png`;
          await vfs.writeFile(pagePath, new Uint8Array(image.data));
          previewImagePaths.push(pagePath);
        }

        const previewText = normalizePreviewText(textResult.text);
        const classification = classifyTextLayer(previewText);

        summaries.push({
          file: filename,
          path: fullPath,
          success: true,
          pageCount: imageResult.pageCount,
          previewImagePaths,
          previewImageDir: previewDir,
          previewText,
          textPreviewLength: previewText.length,
          textLayerLikelyUsable: classification.textLayerLikelyUsable,
          boxedGlyphRatio: Number(classification.boxedGlyphRatio.toFixed(3)),
          recommendedSource: classification.recommendedSource,
          recommendedNextStep:
            classification.recommendedSource === "text"
              ? "Use previewText first, then read previewImagePaths only if layout or values are ambiguous."
              : "Read the first preview image path for visual OCR, then inspect additional pages only if needed.",
        });
      }

      return toolSuccess({
        filesProcessed: summaries.length,
        previewPagesPerFile,
        renderScale,
        textPreviewPages,
        summaries,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error preparing invoice batch";
      return toolError(message);
    }
  },
});