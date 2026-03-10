/// <reference lib="webworker" />

import mammoth from "mammoth";
import * as XLSX from "xlsx";
import type {
  ConversionRequest,
  ConversionResponse,
  ConversionResult,
  DocxTextResult,
  PdfImageResult,
  PdfTextResult,
  XlsxCsvResult,
} from "./conversion-worker-types";

declare const self: DedicatedWorkerGlobalScope;

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist");
  }

  return pdfJsPromise;
}

async function loadPdfDocument(data: ArrayBuffer) {
  const pdfjsLib = await loadPdfJs();
  return pdfjsLib.getDocument({
    data: new Uint8Array(data),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
}

async function extractPdfText(
  data: ArrayBuffer,
  maxPages?: number,
): Promise<PdfTextResult> {
  const doc = await loadPdfDocument(data);
  try {
    const pages: string[] = [];
    const finalPage = Math.min(doc.numPages, maxPages ?? doc.numPages);
    for (let pageNumber = 1; pageNumber <= finalPage; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const items = content.items.filter((item) => "str" in item) as {
        str: string;
        transform: number[];
      }[];
      items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 5) return yDiff; // 5pt threshold for same line
        return a.transform[4] - b.transform[4];
      });

      const lines: string[] = [];
      let currentLine: string[] = [];
      let lastY = items.length > 0 ? items[0].transform[5] : 0;

      for (const item of items) {
        if (Math.abs(lastY - item.transform[5]) > 5) {
          lines.push(currentLine.join("  "));
          currentLine = [];
          lastY = item.transform[5];
        }
        if (item.str.trim()) {
          currentLine.push(item.str.trim());
        }
      }
      if (currentLine.length > 0) lines.push(currentLine.join("  "));
      const text = lines.join("\n");
      if (text.trim()) pages.push(text);
    }
    return { pageCount: doc.numPages, text: pages.join("\n\n") };
  } finally {
    await doc.destroy();
  }
}

async function renderPdfImages(
  data: ArrayBuffer,
  scale: number,
  pages: number[] | null,
  maxPages?: number,
): Promise<PdfImageResult> {
  const doc = await loadPdfDocument(data);
  try {
    const pageNumbers = pages
      ? pages
      : Array.from(
          { length: Math.min(doc.numPages, maxPages ?? doc.numPages) },
          (_, i) => i + 1,
        );
    const images: PdfImageResult["images"] = [];

    for (const pageNumber of pageNumbers) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = new OffscreenCanvas(
        Math.floor(viewport.width),
        Math.floor(viewport.height),
      );
      const canvasContext = canvas.getContext("2d");
      if (!canvasContext) {
        throw new Error("Failed to create canvas 2D context");
      }

      await page.render({
        canvasContext: canvasContext as unknown as CanvasRenderingContext2D,
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;
      const blob = await canvas.convertToBlob({ type: "image/png" });
      const buffer = await blob.arrayBuffer();
      images.push({
        pageNumber,
        width: canvas.width,
        height: canvas.height,
        data: buffer,
      });
    }

    return { pageCount: doc.numPages, images };
  } finally {
    await doc.destroy();
  }
}

async function extractDocxText(data: ArrayBuffer): Promise<DocxTextResult> {
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return { text: result.value };
}

async function convertWorkbookToCsv(
  data: ArrayBuffer,
  sheetArg?: string,
): Promise<XlsxCsvResult> {
  const workbook = XLSX.read(new Uint8Array(data), { type: "array" });

  if (sheetArg) {
    let sheetName: string;
    if (workbook.SheetNames.includes(sheetArg)) {
      sheetName = sheetArg;
    } else {
      const idx = Number.parseInt(sheetArg, 10);
      if (!Number.isNaN(idx) && idx >= 0 && idx < workbook.SheetNames.length) {
        sheetName = workbook.SheetNames[idx];
      } else {
        throw new Error(
          `Sheet not found: ${sheetArg}. Available: ${workbook.SheetNames.join(", ")}`,
        );
      }
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    return {
      outputs: [{ sheetName, csv: XLSX.utils.sheet_to_csv(sheet) }],
    };
  }

  return {
    outputs: workbook.SheetNames.flatMap((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return [];
      return [{ sheetName, csv: XLSX.utils.sheet_to_csv(sheet) }];
    }),
  };
}

async function handleRequest(
  request: ConversionRequest,
): Promise<ConversionResult> {
  switch (request.kind) {
    case "pdf-to-text":
      return extractPdfText(request.data, request.maxPages);
    case "pdf-to-images":
      return renderPdfImages(
        request.data,
        request.scale,
        request.pages,
        request.maxPages,
      );
    case "docx-to-text":
      return extractDocxText(request.data);
    case "xlsx-to-csv":
      return convertWorkbookToCsv(request.data, request.sheetArg);
  }
}

self.onmessage = async (event: MessageEvent<ConversionRequest>) => {
  const request = event.data;
  try {
    const result = await handleRequest(request);
    const transfer: Transferable[] = [];
    if (request.kind === "pdf-to-images" && "images" in result) {
      transfer.push(...result.images.map((image) => image.data));
    }
    const response: ConversionResponse = {
      id: request.id,
      success: true,
      result,
    };
    self.postMessage(response, transfer);
  } catch (error) {
    const response: ConversionResponse = {
      id: request.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
