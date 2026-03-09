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

async function loadPdfDocument(data: ArrayBuffer) {
  const pdfjsLib = await import("pdfjs-dist");
  return pdfjsLib.getDocument({
    data: new Uint8Array(data),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
}

async function extractPdfText(data: ArrayBuffer): Promise<PdfTextResult> {
  const doc = await loadPdfDocument(data);
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .filter((item) => "str" in item)
        .map((item) => (item as { str: string }).str)
        .join(" ");
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
): Promise<PdfImageResult> {
  const doc = await loadPdfDocument(data);
  try {
    const pageNumbers =
      pages ?? Array.from({ length: doc.numPages }, (_, i) => i + 1);
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
      return extractPdfText(request.data);
    case "pdf-to-images":
      return renderPdfImages(request.data, request.scale, request.pages);
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
