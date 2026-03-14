/* global Excel */

import { columnIndexToLetter } from "./excel-utils";
import { createSearchPageCollector } from "./search-data-pagination";
import { getStableSheetId, preloadSheetIds } from "./sheet-id-map";

export { getStableSheetId, preloadSheetIds };
export { columnIndexToLetter };

export interface CellData {
  value: string | number | boolean | null;
  formula?: string;
}

async function runWithRetry<T>(
  batch: (context: Excel.RequestContext) => Promise<T>,
  retries = 3,
  delayMs = 300,
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await Excel.run(batch);
    } catch (error) {
      attempt++;
      if (attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export interface CellStyle {
  sz?: number;
  color?: string;
  family?: string;
  fgColor?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface WorksheetInfo {
  name: string;
  sheetId: number;
  dimension: string;
  cells: Record<string, string | number | boolean | null>;
  formulas?: Record<string, string>;
  styles?: Record<string, CellStyle>;
  borders?: Record<string, unknown>;
}

export interface GetCellRangesResult {
  success: boolean;
  hasMore: boolean;
  worksheet: WorksheetInfo;
}

export function cellAddress(rowIndex: number, colIndex: number): string {
  return `${columnIndexToLetter(colIndex)}${rowIndex + 1}`;
}

export function letterToColumnIndex(letter: string): number {
  return (
    letter
      .toUpperCase()
      .split("")
      .reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1
  );
}

export function parseRangeAddress(address: string): {
  startCol: number;
  startRow: number;
} {
  // Handle quoted sheet names correctly (e.g., 'Sheet!1'!A1:B2)
  let rangePart = address;
  const lastBang = address.lastIndexOf("!");
  if (lastBang !== -1) {
    rangePart = address.substring(lastBang + 1);
  }

  const clean = rangePart.split(":")[0].replace(/\$/g, "");
  const match = clean.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return { startCol: 0, startRow: 0 };

  return {
    startCol: letterToColumnIndex(match[1]),
    startRow: Number.parseInt(match[2], 10) - 1,
  };
}

export function parseSheetQualifiedAddress(address: string): {
  sheetName?: string;
  rangeAddress: string;
} {
  const lastBang = address.lastIndexOf("!");
  if (lastBang === -1) {
    return { rangeAddress: address };
  }

  const rawSheetName = address.slice(0, lastBang).trim();
  const rangeAddress = address.slice(lastBang + 1).trim();

  if (!rawSheetName) {
    return { rangeAddress };
  }

  const sheetName =
    rawSheetName.startsWith("'") && rawSheetName.endsWith("'")
      ? rawSheetName.slice(1, -1).replace(/''/g, "'")
      : rawSheetName;

  return {
    sheetName,
    rangeAddress,
  };
}

function getRangeFromAddress(
  context: Excel.RequestContext,
  currentSheet: Excel.Worksheet,
  address: string,
): Excel.Range {
  const { sheetName, rangeAddress } = parseSheetQualifiedAddress(address);
  const targetSheet = sheetName
    ? context.workbook.worksheets.getItem(sheetName)
    : currentSheet;

  return targetSheet.getRange(rangeAddress);
}

function excelColorToHex(
  color: Excel.RangeFont | Excel.RangeFill,
): string | undefined {
  const c = color as { color?: string };
  if (!c.color || c.color === "null") return undefined;
  if (c.color.startsWith("#")) return c.color.toUpperCase();
  return c.color;
}

async function getPointsPerStandardColumnWidth(
  context: Excel.RequestContext,
  sheet: Excel.Worksheet,
): Promise<number> {
  const probe = sheet.getRange("XFD:XFD");
  probe.format.load("columnWidth");
  sheet.load("standardWidth");
  await resilientSync(context);

  const originalWidth = probe.format.columnWidth;
  probe.format.useStandardWidth = true;
  probe.format.load("columnWidth");
  await resilientSync(context);

  const standardWidthPoints = probe.format.columnWidth;
  probe.format.columnWidth = originalWidth;
  await resilientSync(context);

  if (sheet.standardWidth && standardWidthPoints) {
    return standardWidthPoints / sheet.standardWidth;
  }
  return 1;
}

export async function getWorksheetById(
  context: Excel.RequestContext,
  sheetId: number,
): Promise<Excel.Worksheet | null> {
  const sheets = context.workbook.worksheets;
  sheets.load("items");
  await resilientSync(context);

  for (const sheet of sheets.items) {
    sheet.load("id");
  }
  await resilientSync(context);

  const idMap = await preloadSheetIds(sheets.items);

  for (const sheet of sheets.items) {
    const stableId = idMap.get(sheet.id);
    if (stableId === sheetId) {
      return sheet;
    }
  }

  return null;
}

export async function getWorksheetStableId(
  context: Excel.RequestContext,
  sheet: Excel.Worksheet,
): Promise<number> {
  sheet.load("id");
  await resilientSync(context);
  return getStableSheetId(sheet.id);
}

/**
 * Helper to sync Excel context with automatic retry on 'Host is Busy' errors.
 */
export async function resilientSync(
  context: Excel.RequestContext,
): Promise<void> {
  const maxRetries = 5;
  const delayMs = 500;
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      await context.sync();
      return;
    } catch (error: unknown) {
      lastError = error;
      const errorMessage =
        error instanceof Error ? error.message.toLowerCase() : "";
      const isBusy =
        (typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: unknown }).code === "HostIsBusy") ||
        errorMessage.includes("host is busy");

      if (isBusy) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * High-level wrapper for Excel operations.
 * Individual syncs inside the batch use resilientSync() for retry-on-busy.
 */
async function runBatch<T>(
  batch: (context: Excel.RequestContext) => Promise<T>,
): Promise<T> {
  return Excel.run(batch);
}

export async function getCellRanges(
  sheetId: number,
  ranges: string[],
  options: { includeStyles?: boolean; cellLimit?: number } = {},
): Promise<GetCellRangesResult> {
  const { includeStyles = true, cellLimit = 2000 } = options;

  return runBatch(async (context) => {
    const sheet = await getWorksheetById(context, sheetId);
    if (!sheet) {
      throw new Error(`Worksheet with ID ${sheetId} not found`);
    }

    sheet.load("name,id");
    const usedRange = sheet.getUsedRangeOrNullObject();
    usedRange.load("address");
    await resilientSync(context);

    const dimension = usedRange.isNullObject
      ? "A1"
      : usedRange.address.split("!")[1] || "A1";

    const cells: Record<string, string | number | boolean | null> = {};
    const formulas: Record<string, string> = {};
    const styles: Record<string, CellStyle> = {};
    let totalCells = 0;
    let hasMore = false;

    for (const rangeAddr of ranges) {
      if (totalCells >= cellLimit) {
        hasMore = true;
        break;
      }

      const range = sheet.getRange(rangeAddr);
      // Load visibility to ensure we don't return hidden/filtered data to the AI
      range.load(
        "values,formulas,address,rowCount,columnCount,rowHidden,columnHidden",
      );
      await resilientSync(context);

      const { startCol, startRow } = parseRangeAddress(range.address);

      const styleTargetsMap = new Map<string, Excel.Range>();

      // Office.js returns boolean[][] at runtime even though @types/office-js
      // declares rowHidden/columnHidden as boolean. The casts below are safe.
      const rowHidden = range.rowHidden as unknown as boolean[][];
      const colHidden = range.columnHidden as unknown as boolean[][];

      for (let r = 0; r < range.rowCount && totalCells < cellLimit; r++) {
        // Skip hidden rows (filtered or manually hidden)
        if (rowHidden[r]?.[0]) continue;

        for (let c = 0; c < range.columnCount && totalCells < cellLimit; c++) {
          // Skip hidden columns
          if (colHidden[0]?.[c]) continue;

          const addr = cellAddress(startRow + r, startCol + c);
          const value = range.values[r][c];
          const formula = range.formulas[r][c];

          if (value !== null && value !== "" && value !== undefined) {
            cells[addr] = value as string | number | boolean;
            totalCells++;
            if (includeStyles) {
              styleTargetsMap.set(addr, range.getCell(r, c));
            }
          }

          if (typeof formula === "string" && formula.startsWith("=")) {
            formulas[addr] = formula;
            if (includeStyles) {
              styleTargetsMap.set(addr, range.getCell(r, c));
            }
          }
        }
      }

      if (includeStyles && styleTargetsMap.size > 0) {
        const styleTargets = Array.from(styleTargetsMap.entries());
        for (const [, cell] of styleTargets) {
          cell.format.font.load("name,size,color,bold,italic");
          cell.format.fill.load("color");
        }
        await resilientSync(context);

        for (const [addr, cell] of styleTargets) {
          const rangeStyle: CellStyle = {};
          const font = cell.format.font;
          const fill = cell.format.fill;

          if (font.size) rangeStyle.sz = font.size;
          if (font.name) rangeStyle.family = font.name;
          if (font.bold !== null && font.bold !== undefined)
            rangeStyle.bold = font.bold;
          if (font.italic !== null && font.italic !== undefined)
            rangeStyle.italic = font.italic;

          const fontColor = excelColorToHex(font as Excel.RangeFont);
          if (fontColor) rangeStyle.color = fontColor;

          const fillColor = excelColorToHex(fill as Excel.RangeFill);
          if (fillColor) rangeStyle.fgColor = fillColor;

          if (Object.keys(rangeStyle).length > 0) {
            styles[addr] = rangeStyle;
          }
        }
      }
    }

    return {
      success: true,
      hasMore,
      worksheet: {
        name: sheet.name,
        sheetId,
        dimension,
        cells,
        ...(Object.keys(formulas).length > 0 && { formulas }),
        ...(includeStyles && Object.keys(styles).length > 0 && { styles }),
        borders: {},
      },
    };
  });
}

export interface GetRangeAsCsvResult {
  success: boolean;
  csv: string;
  rowCount: number;
  columnCount: number;
  hasMore: boolean;
  sheetName: string;
}

export async function getRangeAsCsv(
  sheetId: number,
  rangeAddr: string,
  options: { includeHeaders?: boolean; maxRows?: number } = {},
): Promise<GetRangeAsCsvResult> {
  const { includeHeaders = true, maxRows = 500 } = options;

  return runWithRetry(async (context) => {
    const sheet = await getWorksheetById(context, sheetId);
    if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);

    sheet.load("name");
    const range = sheet.getRange(rangeAddr);
    range.load("values,rowCount,columnCount");
    await resilientSync(context);

    const startRow = includeHeaders ? 0 : 1;
    const availableRows = range.rowCount - startRow;
    const actualRows = Math.min(availableRows, maxRows);
    const hasMore = availableRows > maxRows;

    const rows: string[] = [];
    for (let r = startRow; r < startRow + actualRows; r++) {
      const row = range.values[r].map((v) => {
        if (v === null || v === undefined) return "";
        const str = String(v);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      rows.push(row.join(","));
    }

    return {
      success: true,
      csv: rows.join("\n"),
      rowCount: actualRows,
      columnCount: range.columnCount,
      hasMore,
      sheetName: sheet.name,
    };
  });
}

export interface SearchMatch {
  sheetName: string;
  sheetId: number;
  a1: string;
  value: string | number | boolean;
  formula: string | null;
  row: number;
  column: number;
}

export interface SearchDataResult {
  success: boolean;
  matches: SearchMatch[];
  totalFound: number;
  returned: number;
  offset: number;
  hasMore: boolean;
  searchTerm: string;
  searchScope: string;
  nextOffset: number | null;
}

export async function searchData(
  searchTerm: string,
  options: {
    sheetId?: number;
    range?: string;
    offset?: number;
    matchCase?: boolean;
    matchEntireCell?: boolean;
    matchFormulas?: boolean;
    useRegex?: boolean;
    maxResults?: number;
  } = {},
): Promise<SearchDataResult> {
  const {
    sheetId,
    range,
    offset = 0,
    matchCase = false,
    matchEntireCell = false,
    matchFormulas = false,
    useRegex = false,
    maxResults = 500,
  } = options;

  return runWithRetry(async (context) => {
    const sheets = context.workbook.worksheets;
    sheets.load("items");
    await resilientSync(context);

    for (const sheet of sheets.items) {
      sheet.load("id");
    }
    await resilientSync(context);

    const stableIdMap = await preloadSheetIds(sheets.items);

    const pageCollector = createSearchPageCollector<SearchMatch>(
      offset,
      maxResults,
    );

    let stopSearch = false;

    const sheetsToSearch = sheetId
      ? ([await getWorksheetById(context, sheetId)].filter(
          Boolean,
        ) as Excel.Worksheet[])
      : sheets.items;

    const pattern = useRegex
      ? new RegExp(searchTerm, matchCase ? "" : "i")
      : null;

    for (const sheet of sheetsToSearch) {
      if (stopSearch) break;

      sheet.load("name,id");
      const searchRange = range
        ? sheet.getRange(range)
        : sheet.getUsedRangeOrNullObject();
      searchRange.load("values,formulas,address,rowCount,columnCount");
      await resilientSync(context);

      if (searchRange.isNullObject) continue;

      const { startCol, startRow } = parseRangeAddress(searchRange.address);
      const stableSheetId =
        stableIdMap.get(sheet.id) || (await getStableSheetId(sheet.id));

      for (let r = 0; r < searchRange.rowCount && !stopSearch; r++) {
        for (let c = 0; c < searchRange.columnCount; c++) {
          const value = searchRange.values[r][c];
          const formula = searchRange.formulas[r][c];
          const searchTarget =
            matchFormulas && formula ? String(formula) : String(value ?? "");

          let isMatch = false;
          if (pattern) {
            isMatch = pattern.test(searchTarget);
          } else {
            const compareVal = matchCase
              ? searchTarget
              : searchTarget.toLowerCase();
            const compareTerm = matchCase
              ? searchTerm
              : searchTerm.toLowerCase();
            isMatch = matchEntireCell
              ? compareVal === compareTerm
              : compareVal.includes(compareTerm);
          }

          if (!isMatch) continue;

          const shouldStop = pageCollector.add({
            sheetName: sheet.name,
            sheetId: stableSheetId,
            a1: cellAddress(startRow + r, startCol + c),
            value: value as string | number | boolean,
            formula:
              typeof formula === "string" && formula.startsWith("=")
                ? formula
                : null,
            row: startRow + r + 1,
            column: startCol + c + 1,
          });

          if (shouldStop) {
            stopSearch = true;
            break;
          }
        }
      }
    }

    const page = pageCollector.toPage();

    return {
      success: true,
      matches: pageCollector.matches,
      totalFound: page.totalFound,
      returned: page.returned,
      offset: page.offset,
      hasMore: page.hasMore,
      searchTerm,
      searchScope: sheetId ? `Sheet ${sheetId}` : "All sheets",
      nextOffset: page.nextOffset,
    };
  });
}

export interface ExcelObject {
  id: string;
  type: "chart" | "pivotTable";
  name: string;
  sheetId: number;
  sheetName: string;
}

export interface GetAllObjectsResult {
  success: boolean;
  objects: ExcelObject[];
}

export async function getAllObjects(
  options: { sheetId?: number; id?: string } = {},
): Promise<GetAllObjectsResult> {
  const { sheetId, id } = options;

  return runWithRetry(async (context) => {
    const sheets = context.workbook.worksheets;
    sheets.load("items");
    await resilientSync(context);

    for (const sheet of sheets.items) {
      sheet.load("id");
    }
    await resilientSync(context);

    const stableIdMap = await preloadSheetIds(sheets.items);

    const objects: ExcelObject[] = [];
    const sheetsToCheck = sheetId
      ? ([await getWorksheetById(context, sheetId)].filter(
          Boolean,
        ) as Excel.Worksheet[])
      : sheets.items;

    for (const sheet of sheetsToCheck) {
      sheet.load("name,id");
      const charts = sheet.charts;
      const pivotTables = sheet.pivotTables;
      charts.load("items");
      pivotTables.load("items");
      await resilientSync(context);

      const stableSheetId =
        stableIdMap.get(sheet.id) || (await getStableSheetId(sheet.id));

      for (const chart of charts.items) {
        chart.load("id,name");
        await resilientSync(context);
        if (!id || chart.id === id) {
          objects.push({
            id: chart.id,
            type: "chart",
            name: chart.name,
            sheetId: stableSheetId,
            sheetName: sheet.name,
          });
        }
      }

      for (const pivot of pivotTables.items) {
        pivot.load("id,name");
        await resilientSync(context);
        if (!id || pivot.id === id) {
          objects.push({
            id: pivot.id,
            type: "pivotTable",
            name: pivot.name,
            sheetId: stableSheetId,
            sheetName: sheet.name,
          });
        }
      }
    }

    return { success: true, objects };
  });
}

export type CellInput =
  | string
  | number
  | boolean
  | null
  | {
      value?: unknown;
      formula?: string;
      note?: string;
      cellStyles?: {
        fontWeight?: "normal" | "bold";
        fontStyle?: "normal" | "italic";
        fontLine?: "none" | "underline" | "line-through";
        fontSize?: number;
        fontFamily?: string;
        fontColor?: string;
        backgroundColor?: string;
        horizontalAlignment?:
          | "left"
          | "center"
          | "right"
          | "centre"
          | "middle"
          | "start"
          | "end";
        numberFormat?: string;
      };
      borderStyles?: {
        top?: { style?: string; weight?: string; color?: string };
        bottom?: { style?: string; weight?: string; color?: string };
        left?: { style?: string; weight?: string; color?: string };
        right?: { style?: string; weight?: string; color?: string };
      };
    };

// Extracts the object variant of CellInput so properties like cellStyles and
// borderStyles can be referenced without indexing into the full union type.
type CellInputObject = Extract<CellInput, { cellStyles?: unknown }>;

export interface SetCellRangeResult {
  success: boolean;
  cellsWritten: number;
  formulaResults?: Record<string, unknown>;
  messages?: string[];
}

function normalizeHorizontalAlignment(
  alignment:
    | "left"
    | "center"
    | "right"
    | "centre"
    | "middle"
    | "start"
    | "end"
    | undefined,
): "left" | "center" | "right" | undefined {
  if (!alignment) return undefined;
  switch (alignment) {
    case "left":
    case "start":
      return "left";
    case "center":
    case "centre":
    case "middle":
      return "center";
    case "right":
    case "end":
      return "right";
    default:
      return undefined;
  }
}

export async function setCellRange(
  sheetId: number,
  rangeAddr: string,
  cells: CellInput[][],
  options: {
    copyToRange?: string;
    resizeWidth?: { type: "points" | "standard"; value: number };
    resizeHeight?: { type: "points" | "standard"; value: number };
    allowOverwrite?: boolean;
    forceCalculation?: boolean;
  } = {},
): Promise<SetCellRangeResult> {
  const {
    copyToRange,
    resizeWidth,
    resizeHeight,
    allowOverwrite,
    forceCalculation,
  } = options;

  return runWithRetry(async (context) => {
    const sheet = await getWorksheetById(context, sheetId);
    if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);

    const messages: string[] = [];
    let range = sheet.getRange(rangeAddr);
    range.load("rowCount,columnCount,values,formulas,address");
    await resilientSync(context);

    const inputRows = cells.length;
    const inputCols = Math.max(...cells.map((r) => r.length));

    // Auto-expand range if needed
    if (inputRows !== range.rowCount || inputCols !== range.columnCount) {
      const { startCol, startRow } = parseRangeAddress(range.address);
      const endRow = startRow + inputRows - 1;
      const endCol = startCol + inputCols - 1;
      const newAddr = `${cellAddress(startRow, startCol)}:${cellAddress(endRow, endCol)}`;
      messages.push(
        `Adjusted range from ${rangeAddr} to ${newAddr} (row diff: ${inputRows - range.rowCount}, col diff: ${inputCols - range.columnCount})`,
      );
      range = sheet.getRange(newAddr);
      range.load("rowCount,columnCount,values,formulas,address");
      await resilientSync(context);
    }

    const { startCol, startRow } = parseRangeAddress(range.address);

    if (!allowOverwrite) {
      const nonEmptyCells: string[] = [];
      for (let r = 0; r < range.rowCount; r++) {
        for (let c = 0; c < range.columnCount; c++) {
          const value = range.values[r][c];
          const formula = range.formulas[r][c];
          const hasValue =
            value !== null && value !== "" && value !== undefined;
          const hasFormula =
            typeof formula === "string" && formula.startsWith("=");

          if (hasValue || hasFormula) {
            nonEmptyCells.push(cellAddress(startRow + r, startCol + c));
          }
        }
      }

      if (nonEmptyCells.length > 0) {
        const cellList =
          nonEmptyCells.length <= 10
            ? nonEmptyCells.join(", ")
            : `${nonEmptyCells.slice(0, 10).join(", ")}...`;
        throw new Error(
          `Would overwrite ${nonEmptyCells.length} non-empty cell(s): ${cellList}. ` +
            `To proceed with overwriting existing data, retry with allow_overwrite set to true.`,
        );
      }
    }

    const values: unknown[][] = [];
    const formulas: (string | null)[][] = [];
    let hasFormulas = false;

    // Collect styles for batching and notes for individual processing
    const styleBatches = new Map<
      string,
      {
        styles: NonNullable<CellInputObject["cellStyles"]>;
        borders: CellInputObject["borderStyles"];
        addrs: string[];
      }
    >();
    const notes: { addr: string; note: string }[] = [];

    for (let r = 0; r < inputRows; r++) {
      values[r] = [];
      formulas[r] = [];
      for (let c = 0; c < inputCols; c++) {
        let cell = cells[r]?.[c];
        const addr = cellAddress(startRow + r, startCol + c);

        if (cell !== undefined) {
          // Normalize primitive to object
          if (typeof cell !== "object" || cell === null) {
            cell = { value: cell };
          }

          if (cell.formula) {
            formulas[r][c] = cell.formula;
            values[r][c] = null;
            hasFormulas = true;
          } else {
            values[r][c] =
              cell.value === undefined || cell.value === "" ? null : cell.value;
            formulas[r][c] = null;
          }

          if (cell.note) {
            notes.push({ addr, note: cell.note });
          }

          if (cell.cellStyles || cell.borderStyles) {
            const key = JSON.stringify([cell.cellStyles, cell.borderStyles]);
            let batch = styleBatches.get(key);
            if (!batch) {
              batch = {
                styles: cell.cellStyles || {},
                borders: cell.borderStyles,
                addrs: [],
              };
              styleBatches.set(key, batch);
            }
            batch.addrs.push(addr);
          }
        } else {
          values[r][c] = null;
          formulas[r][c] = null;
        }
      }
    }

    if (hasFormulas) {
      range.formulas = formulas.map((row, r) =>
        row.map((f, c) => f ?? (values[r][c] as string | number | boolean)),
      );
    } else {
      range.values = values;
    }

    // Apply styles in batches to minimize round-trips
    for (const batch of styleBatches.values()) {
      // Office JS getRanges string limit is ~2000 chars; chunk addresses to be safe
      for (let i = 0; i < batch.addrs.length; i += 100) {
        const chunk = batch.addrs.slice(i, i + 100);
        const batchRange = sheet.getRanges(chunk.join(","));

        const s = batch.styles;
        const font = batchRange.format.font;
        if (s.fontWeight !== undefined) font.bold = s.fontWeight === "bold";
        if (s.fontStyle !== undefined) font.italic = s.fontStyle === "italic";

        if (s.fontLine === "underline") font.underline = "Single";
        else if (s.fontLine === "line-through") font.strikethrough = true;
        else if (s.fontLine === "none") {
          font.strikethrough = false;
          font.underline = "None";
        }

        if (s.fontSize) font.size = s.fontSize;
        if (s.fontFamily) font.name = s.fontFamily;
        if (s.fontColor) font.color = s.fontColor;
        if (s.backgroundColor) batchRange.format.fill.color = s.backgroundColor;
        if (s.horizontalAlignment) {
          const normalizedAlignment = normalizeHorizontalAlignment(
            s.horizontalAlignment,
          );
          if (normalizedAlignment) {
            batchRange.format.horizontalAlignment =
              normalizedAlignment as Excel.HorizontalAlignment;
          }
        }
        if (s.numberFormat) {
          batchRange.load("areas");
          await resilientSync(context);
          for (const area of batchRange.areas.items) {
            // Office.js accepts a plain string at runtime even though the type
            // declares numberFormat as any[][]. Cast to satisfy the compiler.
            area.numberFormat =
              s.numberFormat as unknown as Excel.Range["numberFormat"];
          }
        }

        if (batch.borders) {
          const b = batch.borders;
          const sides: (keyof typeof b)[] = ["top", "bottom", "left", "right"];
          const excelSides = [
            Excel.BorderIndex.edgeTop,
            Excel.BorderIndex.edgeBottom,
            Excel.BorderIndex.edgeLeft,
            Excel.BorderIndex.edgeRight,
          ];

          for (let j = 0; j < sides.length; j++) {
            const sideData = b[sides[j]];
            if (!sideData) continue;

            const border = batchRange.format.borders.getItem(excelSides[j]);
            if (sideData.style) {
              const styleMap: Record<string, Excel.BorderLineStyle> = {
                solid: Excel.BorderLineStyle.continuous,
                dashed: Excel.BorderLineStyle.dash,
                dotted: Excel.BorderLineStyle.dot,
                double: Excel.BorderLineStyle.double,
              };
              border.style =
                styleMap[sideData.style] ?? Excel.BorderLineStyle.continuous;
            }
            if (sideData.weight) {
              const weightMap: Record<string, Excel.BorderWeight> = {
                thin: Excel.BorderWeight.thin,
                medium: Excel.BorderWeight.medium,
                thick: Excel.BorderWeight.thick,
              };
              border.weight =
                weightMap[sideData.weight] ?? Excel.BorderWeight.thin;
            }
            if (sideData.color) {
              border.color = sideData.color;
            }
          }
        }
      }
    }

    // Individual notes must still be added one by one
    for (const { addr, note } of notes) {
      sheet.notes.add(addr, note);
    }

    if (hasFormulas || forceCalculation) {
      context.workbook.application.load("calculationMode");
      await resilientSync(context);
      if (
        forceCalculation ||
        context.workbook.application.calculationMode ===
          Excel.CalculationMode.manual
      ) {
        context.workbook.application.calculate(Excel.CalculationType.full);
      }
    }

    await resilientSync(context);

    if (copyToRange) {
      const destRange = sheet.getRange(copyToRange);
      destRange.copyFrom(range, Excel.RangeCopyType.all);
    }

    if (resizeWidth) {
      const cols = range.getEntireColumn();
      if (resizeWidth.type === "standard") {
        const pointsPerStandard = await getPointsPerStandardColumnWidth(
          context,
          sheet,
        );
        cols.format.columnWidth = resizeWidth.value * pointsPerStandard;
      } else {
        cols.format.columnWidth = resizeWidth.value;
      }
    }
    if (resizeHeight) {
      const rows = range.getEntireRow();
      rows.format.rowHeight = resizeHeight.value;
    }

    // Single final sync for all mutations
    await resilientSync(context);

    const formulaResults: Record<string, unknown> = {};
    if (hasFormulas) {
      range.load("values,address");
      await resilientSync(context);
      const { startCol, startRow } = parseRangeAddress(range.address);
      for (let r = 0; r < range.values.length; r++) {
        for (let c = 0; c < range.values[r].length; c++) {
          if (formulas[r]?.[c]) {
            formulaResults[cellAddress(startRow + r, startCol + c)] =
              range.values[r][c];
          }
        }
      }
    }

    return {
      success: true,
      cellsWritten: cells.flat().length,
      ...(Object.keys(formulaResults).length > 0 && { formulaResults }),
      ...(messages.length > 0 && { messages }),
    };
  });
}

export interface ClearCellRangeResult {
  success: boolean;
  clearedRange: string;
}

export async function clearCellRange(
  sheetId: number,
  rangeAddr: string,
  clearType: "contents" | "all" | "formats" = "contents",
): Promise<ClearCellRangeResult> {
  return runWithRetry(async (context) => {
    const sheet = await getWorksheetById(context, sheetId);
    if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);

    const range = sheet.getRange(rangeAddr);

    switch (clearType) {
      case "contents":
        range.clear(Excel.ClearApplyTo.contents);
        break;
      case "formats":
        range.clear(Excel.ClearApplyTo.formats);
        break;
      case "all":
        range.clear(Excel.ClearApplyTo.all);
        break;
    }

    await resilientSync(context);

    return { success: true, clearedRange: rangeAddr };
  });
}

export interface CopyToResult {
  success: boolean;
  source: string;
  destination: string;
}

export async function copyTo(
  sheetId: number,
  sourceRange: string,
  destinationRange: string,
): Promise<CopyToResult> {
  return runWithRetry(async (context) => {
    const sheet = await getWorksheetById(context, sheetId);
    if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);

    const source = sheet.getRange(sourceRange);
    const dest = sheet.getRange(destinationRange);
    dest.copyFrom(source, Excel.RangeCopyType.all);
    await resilientSync(context);

    return {
      success: true,
      source: sourceRange,
      destination: destinationRange,
    };
  });
}

export interface ModifySheetStructureResult {
  success: boolean;
  operation: string;
}

export async function modifySheetStructure(
  sheetId: number,
  params: {
    operation: "insert" | "delete" | "hide" | "unhide" | "freeze" | "unfreeze";
    dimension?: "rows" | "columns"; // not required for 'unfreeze'
    reference?: string;
    count?: number;
    position?: "before" | "after";
  },
): Promise<ModifySheetStructureResult> {
  const {
    operation,
    dimension,
    reference,
    count = 1,
    position = "before",
  } = params;

  return runWithRetry(async (context) => {
    const sheet = await getWorksheetById(context, sheetId);
    if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);

    if (operation === "freeze") {
      sheet.freezePanes.freezeAt(sheet.getRange(reference || "A1"));
    } else if (operation === "unfreeze") {
      sheet.freezePanes.unfreeze();
    } else if (reference) {
      const isRow = dimension === "rows";
      let rangeRef: string;
      let afterRangeRef: string;

      if (isRow) {
        const startRow = Number.parseInt(reference, 10);
        const endRow = startRow + count - 1;
        rangeRef = `${startRow}:${endRow}`;
        afterRangeRef = `${startRow + 1}:${endRow + 1}`;
      } else {
        const startCol = letterToColumnIndex(reference);
        const endCol = startCol + count - 1;
        rangeRef = `${reference}:${columnIndexToLetter(endCol)}`;
        afterRangeRef = `${columnIndexToLetter(startCol + 1)}:${columnIndexToLetter(endCol + 1)}`;
      }

      const targetRange = sheet.getRange(rangeRef);

      switch (operation) {
        case "insert": {
          const shiftDir = isRow
            ? Excel.InsertShiftDirection.down
            : Excel.InsertShiftDirection.right;
          if (position === "after") {
            sheet.getRange(afterRangeRef).insert(shiftDir);
          } else {
            targetRange.insert(shiftDir);
          }
          break;
        }
        case "delete":
          targetRange.delete(
            isRow
              ? Excel.DeleteShiftDirection.up
              : Excel.DeleteShiftDirection.left,
          );
          break;
        case "hide":
          if (isRow) {
            targetRange.rowHidden = true;
          } else {
            targetRange.columnHidden = true;
          }
          break;
        case "unhide":
          if (isRow) {
            targetRange.rowHidden = false;
          } else {
            targetRange.columnHidden = false;
          }
          break;
      }
    }

    await resilientSync(context);
    return { success: true, operation };
  });
}

export interface ModifyWorkbookStructureResult {
  success: boolean;
  operation: string;
  sheetId?: number;
  sheetName?: string;
}

export async function modifyWorkbookStructure(params: {
  operation: "create" | "delete" | "rename" | "duplicate";
  sheetId?: number;
  sheetName?: string;
  newName?: string;
  tabColor?: string;
}): Promise<ModifyWorkbookStructureResult> {
  const { operation, sheetId, sheetName, newName, tabColor } = params;

  return runWithRetry(async (context) => {
    const sheets = context.workbook.worksheets;

    switch (operation) {
      case "create": {
        const newSheet = sheets.add(sheetName);
        if (tabColor) newSheet.tabColor = tabColor;
        newSheet.load("id,name");
        await resilientSync(context);
        const newSheetIndex = await getWorksheetStableId(context, newSheet);
        return {
          success: true,
          operation,
          sheetId: newSheetIndex,
          sheetName: newSheet.name,
        };
      }
      case "delete": {
        if (typeof sheetId !== "number") {
          throw new Error("sheetId is required for delete operation");
        }
        const sheet = await getWorksheetById(context, sheetId);
        if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);
        sheet.delete();
        await resilientSync(context);
        return { success: true, operation };
      }
      case "rename": {
        if (typeof sheetId !== "number") {
          throw new Error("sheetId is required for rename operation");
        }
        if (!newName) {
          throw new Error("newName is required for rename operation");
        }
        const sheet = await getWorksheetById(context, sheetId);
        if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);
        sheet.name = newName;
        await resilientSync(context);
        return { success: true, operation, sheetName: newName };
      }
      case "duplicate": {
        if (typeof sheetId !== "number") {
          throw new Error("sheetId is required for duplicate operation");
        }
        const sheet = await getWorksheetById(context, sheetId);
        if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);
        const copy = sheet.copy();
        if (newName) copy.name = newName;
        copy.load("id,name");
        await resilientSync(context);
        const copyIndex = await getWorksheetStableId(context, copy);
        return {
          success: true,
          operation,
          sheetId: copyIndex,
          sheetName: copy.name,
        };
      }
    }
  });
}

export interface ResizeRangeResult {
  success: boolean;
}

export async function resizeRange(
  sheetId: number,
  params: {
    range?: string;
    width?: { type: "points" | "standard"; value: number };
    height?: { type: "points" | "standard"; value: number };
  },
): Promise<ResizeRangeResult> {
  const { range, width, height } = params;

  return runWithRetry(async (context) => {
    const sheet = await getWorksheetById(context, sheetId);
    if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);

    const targetRange = range ? sheet.getRange(range) : sheet.getRange();

    if (width) {
      const cols = targetRange.getEntireColumn();
      if (width.type === "standard") {
        const pointsPerStandard = await getPointsPerStandardColumnWidth(
          context,
          sheet,
        );
        cols.format.columnWidth = width.value * pointsPerStandard;
      } else {
        cols.format.columnWidth = width.value;
      }
    }
    if (height) {
      const rows = targetRange.getEntireRow();
      rows.format.rowHeight = height.value;
    }

    await resilientSync(context);
    return { success: true };
  });
}

export interface ModifyObjectResult {
  success: boolean;
  operation: string;
  id?: string;
}

export interface NavigateResult {
  success: boolean;
  sheetName?: string;
  range?: string;
}

export async function navigateTo(
  sheetId: number,
  range?: string,
): Promise<NavigateResult> {
  return runWithRetry(async (context) => {
    const sheet = await getWorksheetById(context, sheetId);
    if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);

    sheet.load("name");
    sheet.activate();

    if (range) {
      const targetRange = sheet.getRange(range);
      targetRange.select();
    }

    await resilientSync(context);

    return {
      success: true,
      sheetName: sheet.name,
      ...(range && { range }),
    };
  });
}

export interface SheetMetadata {
  id: number;
  name: string;
  maxRows: number;
  maxColumns: number;
  frozenRows: number;
  frozenColumns: number;
}

export interface WorkbookMetadata {
  success: boolean;
  fileName: string;
  sheetsMetadata: SheetMetadata[];
  totalSheets: number;
  activeSheetId: number;
  activeSheetName: string;
  selectedRange: string;
}

// Short-lived cache to avoid 3 serial Excel round-trips before every LLM call.
// Busted explicitly after any sheet / workbook structure change.
let _metadataCache: { result: WorkbookMetadata; ts: number } | null = null;
const METADATA_CACHE_TTL_MS = 8_000;

export function bustWorkbookMetadataCache(): void {
  _metadataCache = null;
}

export async function getWorkbookMetadata(): Promise<WorkbookMetadata> {
  const now = Date.now();
  if (_metadataCache && now - _metadataCache.ts < METADATA_CACHE_TTL_MS) {
    return _metadataCache.result;
  }
  const result = await runBatch(async (context) => {
    const workbook = context.workbook;
    workbook.load("name");
    const sheets = workbook.worksheets;
    sheets.load("items");

    const activeSheet = sheets.getActiveWorksheet();
    activeSheet.load("id,name");

    // CORE DATA SYNC
    await resilientSync(context);

    // OPTIONAL SELECTION SYNC (Safe-fail)
    let rangeAddress = "Unknown";
    try {
      const selectedRange = workbook.getSelectedRange();
      selectedRange.load("address");
      await resilientSync(context);
      rangeAddress = selectedRange.address.includes("!")
        ? selectedRange.address.split("!")[1]
        : selectedRange.address;
    } catch {
      // Selection is not a range (e.g. chart, shape)
    }

    const sheetData: {
      sheet: Excel.Worksheet;
      usedRange: Excel.Range;
      freezeLocation: Excel.Range;
    }[] = [];

    for (const sheet of sheets.items) {
      sheet.load("id,name");
      const usedRange = sheet.getUsedRangeOrNullObject();
      usedRange.load("rowCount,columnCount");
      const freezeLocation = sheet.freezePanes.getLocationOrNullObject();
      freezeLocation.load("rowCount,columnCount");
      sheetData.push({ sheet, usedRange, freezeLocation });
    }
    await resilientSync(context);

    const stableIdMap = await preloadSheetIds(sheets.items);

    const sheetsMetadata: SheetMetadata[] = await Promise.all(
      sheetData.map(async ({ sheet, usedRange, freezeLocation }) => ({
        id: stableIdMap.get(sheet.id) || (await getStableSheetId(sheet.id)),
        name: sheet.name,
        maxRows: usedRange.isNullObject ? 0 : usedRange.rowCount,
        maxColumns: usedRange.isNullObject ? 0 : usedRange.columnCount,
        frozenRows: freezeLocation.isNullObject ? 0 : freezeLocation.rowCount,
        frozenColumns: freezeLocation.isNullObject
          ? 0
          : freezeLocation.columnCount,
      })),
    );

    const activeSheetStableId =
      stableIdMap.get(activeSheet.id) ||
      (await getStableSheetId(activeSheet.id));

    return {
      success: true,
      fileName: workbook.name || "Untitled",
      sheetsMetadata,
      totalSheets: sheets.items.length,
      activeSheetId: activeSheetStableId,
      activeSheetName: activeSheet.name,
      selectedRange: rangeAddress,
    };
  });
  _metadataCache = { result, ts: Date.now() };
  return result;
}

async function clearRowColumnAxis(
  context: Excel.RequestContext,
  axis: Excel.RowColumnPivotHierarchyCollection,
): Promise<void> {
  axis.load("items");
  await resilientSync(context);
  for (const item of axis.items) {
    axis.remove(item);
  }
}

async function clearDataAxis(
  context: Excel.RequestContext,
  axis: Excel.DataPivotHierarchyCollection,
): Promise<void> {
  axis.load("items");
  await resilientSync(context);
  for (const item of axis.items) {
    axis.remove(item);
  }
}

async function applyPivotFields(
  context: Excel.RequestContext,
  pivot: Excel.PivotTable,
  properties: {
    rows?: { field: string }[];
    columns?: { field: string }[];
    values?: { field: string; summarizeBy?: string }[];
  },
  clearExisting = false,
): Promise<void> {
  if (clearExisting) {
    if (properties.rows) {
      await clearRowColumnAxis(context, pivot.rowHierarchies);
    }
    if (properties.columns) {
      await clearRowColumnAxis(context, pivot.columnHierarchies);
    }
    if (properties.values) {
      await clearDataAxis(context, pivot.dataHierarchies);
    }
    await resilientSync(context);
  }

  if (properties.rows) {
    for (const row of properties.rows) {
      const hierarchy = pivot.hierarchies.getItem(row.field);
      pivot.rowHierarchies.add(hierarchy);
    }
  }

  if (properties.columns) {
    for (const column of properties.columns) {
      const hierarchy = pivot.hierarchies.getItem(column.field);
      pivot.columnHierarchies.add(hierarchy);
    }
  }

  if (properties.values) {
    const summarizeMap: Record<string, Excel.AggregationFunction> = {
      sum: Excel.AggregationFunction.sum,
      count: Excel.AggregationFunction.count,
      average: Excel.AggregationFunction.average,
      max: Excel.AggregationFunction.max,
      min: Excel.AggregationFunction.min,
    };
    for (const value of properties.values) {
      const hierarchy = pivot.hierarchies.getItem(value.field);
      const dataHierarchy = pivot.dataHierarchies.add(hierarchy);
      if (value.summarizeBy) {
        dataHierarchy.summarizeBy =
          summarizeMap[value.summarizeBy] ?? Excel.AggregationFunction.sum;
      }
    }
  }
}

export async function modifyObject(params: {
  operation: "create" | "update" | "delete";
  sheetId: number;
  objectType: "pivotTable" | "chart";
  id?: string;
  properties?: {
    name?: string;
    source?: string;
    range?: string;
    anchor?: string;
    rows?: { field: string }[];
    columns?: { field: string }[];
    values?: { field: string; summarizeBy?: string }[];
    title?: string;
    chartType?: string;
  };
}): Promise<ModifyObjectResult> {
  const { operation, sheetId, objectType, id, properties } = params;

  return runWithRetry(async (context) => {
    const sheet = await getWorksheetById(context, sheetId);
    if (!sheet) throw new Error(`Worksheet with ID ${sheetId} not found`);

    if (objectType === "chart") {
      const charts = sheet.charts;

      switch (operation) {
        case "create": {
          if (!properties?.source || !properties?.chartType) {
            throw new Error("Chart creation requires source and chartType");
          }
          // Excel.ChartType enum keys are camelCase (e.g. "barClustered") but the
          // values Office.js expects are PascalCase (e.g. "BarClustered"). Look up
          // the key in the enum so either form works.
          const resolveChartType = (t: string): Excel.ChartType =>
            (Excel.ChartType[t as keyof typeof Excel.ChartType] ??
              t) as Excel.ChartType;
          const sourceRange = getRangeFromAddress(
            context,
            sheet,
            properties.source,
          );
          const chart = charts.add(
            resolveChartType(properties.chartType),
            sourceRange,
            Excel.ChartSeriesBy.auto,
          );
          if (properties.title) chart.title.text = properties.title;
          if (properties.anchor) {
            const anchorCell = getRangeFromAddress(
              context,
              sheet,
              properties.anchor,
            );
            chart.setPosition(anchorCell);
          }
          chart.load("id");
          await resilientSync(context);
          return { success: true, operation, id: chart.id };
        }
        case "update": {
          if (!id) throw new Error("Chart update requires id");
          const chart = charts.getItem(id);
          if (properties?.chartType) {
            chart.chartType = (Excel.ChartType[
              properties.chartType as keyof typeof Excel.ChartType
            ] ?? properties.chartType) as Excel.ChartType;
          }
          if (properties?.source) {
            const sourceRange = getRangeFromAddress(
              context,
              sheet,
              properties.source,
            );
            chart.setData(sourceRange, Excel.ChartSeriesBy.auto);
          }
          if (properties?.anchor) {
            const anchorCell = getRangeFromAddress(
              context,
              sheet,
              properties.anchor,
            );
            chart.setPosition(anchorCell);
          }
          if (properties?.title) chart.title.text = properties.title;
          await resilientSync(context);
          return { success: true, operation, id };
        }
        case "delete": {
          if (!id) throw new Error("Chart delete requires id");
          const chart = charts.getItem(id);
          chart.delete();
          await resilientSync(context);
          return { success: true, operation };
        }
      }
    } else {
      const pivotTables = sheet.pivotTables;

      switch (operation) {
        case "create": {
          if (!properties?.source || !properties?.range) {
            throw new Error("PivotTable creation requires source and range");
          }
          const sourceRange = getRangeFromAddress(
            context,
            sheet,
            properties.source,
          );
          const destRange = getRangeFromAddress(
            context,
            sheet,
            properties.range,
          );
          const pivot = sheet.pivotTables.add(
            properties.name || "PivotTable",
            sourceRange,
            destRange,
          );
          if (properties?.rows || properties?.columns || properties?.values) {
            await applyPivotFields(context, pivot, properties);
          }
          pivot.load("id");
          await resilientSync(context);
          return { success: true, operation, id: pivot.id };
        }
        case "update": {
          if (!id) throw new Error("PivotTable update requires id");
          const pivot = pivotTables.getItem(id);
          if (properties?.name) pivot.name = properties.name;
          if (properties?.rows || properties?.columns || properties?.values) {
            await applyPivotFields(context, pivot, properties, true);
          }
          await resilientSync(context);
          return { success: true, operation, id };
        }
        case "delete": {
          if (!id) throw new Error("PivotTable delete requires id");
          const pivot = pivotTables.getItem(id);
          pivot.delete();
          await resilientSync(context);
          return { success: true, operation };
        }
      }
    }

    return { success: false, operation: "unknown" };
  });
}
