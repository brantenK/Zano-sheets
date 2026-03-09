import type {
  ConversionResponse,
  DocxTextResult,
  PdfImageResult,
  PdfTextResult,
  XlsxCsvResult,
} from "./conversion-worker-types";

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

let worker: Worker | null = null;
let nextRequestId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function cloneBuffer(data: Uint8Array): ArrayBuffer {
  const clone = new Uint8Array(data.byteLength);
  clone.set(data);
  return clone.buffer;
}

function failPendingRequests(error: Error) {
  for (const pending of pendingRequests.values()) {
    pending.reject(error);
  }
  pendingRequests.clear();
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL("./conversion-worker.ts", import.meta.url), {
    type: "module",
    name: "zano-conversion-worker",
  });

  worker.onmessage = (event: MessageEvent<ConversionResponse>) => {
    const response = event.data;
    const pending = pendingRequests.get(response.id);
    if (!pending) return;

    pendingRequests.delete(response.id);
    if (response.success) {
      pending.resolve(response.result);
    } else {
      pending.reject(new Error(response.error));
    }
  };

  worker.onerror = (event) => {
    const error = new Error(
      event.message || "Document conversion worker failed.",
    );
    failPendingRequests(error);
    worker?.terminate();
    worker = null;
  };

  return worker;
}

function runRequest<T>(
  payload: object,
  transfer: Transferable[] = [],
): Promise<T> {
  const activeWorker = getWorker();
  const id = nextRequestId++;

  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    activeWorker.postMessage({ id, ...payload }, transfer);
  });
}

export function extractPdfTextInWorker(
  data: Uint8Array,
  maxPages?: number,
): Promise<PdfTextResult> {
  const buffer = cloneBuffer(data);
  return runRequest<PdfTextResult>(
    { kind: "pdf-to-text", data: buffer, maxPages },
    [buffer],
  );
}

export function renderPdfImagesInWorker(
  data: Uint8Array,
  scale: number,
  pages: number[] | null,
  maxPages?: number,
): Promise<PdfImageResult> {
  const buffer = cloneBuffer(data);
  return runRequest<PdfImageResult>(
    { kind: "pdf-to-images", data: buffer, scale, pages, maxPages },
    [buffer],
  );
}

export function extractDocxTextInWorker(
  data: Uint8Array,
): Promise<DocxTextResult> {
  const buffer = cloneBuffer(data);
  return runRequest<DocxTextResult>({ kind: "docx-to-text", data: buffer }, [
    buffer,
  ]);
}

export function convertWorkbookToCsvInWorker(
  data: Uint8Array,
  sheetArg?: string,
): Promise<XlsxCsvResult> {
  const buffer = cloneBuffer(data);
  return runRequest<XlsxCsvResult>(
    { kind: "xlsx-to-csv", data: buffer, sheetArg },
    [buffer],
  );
}
