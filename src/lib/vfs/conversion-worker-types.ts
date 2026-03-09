export interface PdfTextResult {
  pageCount: number;
  text: string;
}

export interface PdfImageResult {
  pageCount: number;
  images: Array<{
    pageNumber: number;
    width: number;
    height: number;
    data: ArrayBuffer;
  }>;
}

export interface DocxTextResult {
  text: string;
}

export interface XlsxCsvSheetResult {
  sheetName: string;
  csv: string;
}

export interface XlsxCsvResult {
  outputs: XlsxCsvSheetResult[];
}

export type ConversionRequest =
  | {
      id: number;
      kind: "pdf-to-text";
      data: ArrayBuffer;
      maxPages?: number;
    }
  | {
      id: number;
      kind: "pdf-to-images";
      data: ArrayBuffer;
      scale: number;
      pages: number[] | null;
      maxPages?: number;
    }
  | {
      id: number;
      kind: "docx-to-text";
      data: ArrayBuffer;
    }
  | {
      id: number;
      kind: "xlsx-to-csv";
      data: ArrayBuffer;
      sheetArg?: string;
    };

export type ConversionResult =
  | PdfTextResult
  | PdfImageResult
  | DocxTextResult
  | XlsxCsvResult;

export type ConversionResponse =
  | {
      id: number;
      success: true;
      result: ConversionResult;
    }
  | {
      id: number;
      success: false;
      error: string;
    };
