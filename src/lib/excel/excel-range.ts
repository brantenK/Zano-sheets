/* global Excel */

import { resilientSync, runBatch, runWithRetry } from "./excel-core";
import { getWorksheetById } from "./excel-structure";
import { columnIndexToLetter } from "./excel-utils";
import { createSearchPageCollector } from "./search-data-pagination";
import { getStableSheetId, preloadSheetIds } from "./sheet-id-map";

/**
 * Convert row and column indices to A1 notation (e.g., "A1", "Z99")
 */
export function cellAddress(rowIndex: number, colIndex: number): string {
  return `${columnIndexToLetter(colIndex)}${rowIndex + 1}`;
}

/**
 * Convert column letter(s) to zero-based column index
 */
export function letterToColumnIndex(letter: string): number {
  return (
    letter
      .toUpperCase()
      .split("")
      .reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1
  );
}

/**
 * Parse a range address (e.g., "A1:B2") and return start column/row indices
 */
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

/**
 * Parse a sheet-qualified address (e.g., "Sheet1!A1:B2")
 * Returns sheetName (if present) and the range address portion
 */
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

/**
 * Internal utility: Get a range object, handling sheet-qualified addresses
 */
export function getRangeFromAddress(
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

/**
 * Internal utility: Measure points per standard column width
 */
export async function getPointsPerStandardColumnWidth(
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

/**
 * Cell style information extracted from Excel
 */
export interface CellStyle {
  sz?: number;
  color?: string;
  family?: string;
  fgColor?: string;
  bold?: boolean;
  italic?: boolean;
}

/**
 * Worksheet information including cells, formulas, and optional styles
 */
export interface WorksheetInfo {
  name: string;
  sheetId: number;
  dimension: string;
  cells: Record<string, string | number | boolean | null>;
  formulas?: Record<string, string>;
  styles?: Record<string, CellStyle>;
  borders?: Record<string, unknown>;
}

/**
 * Result from getCellRanges operation
 */
export interface GetCellRangesResult {
  success: boolean;
  hasMore: boolean;
  worksheet: WorksheetInfo;
}

/**
 * Internal helper: Convert Excel color to hex
 */
function excelColorToHex(
  color: Excel.RangeFont | Excel.RangeFill,
): string | undefined {
  const c = color as { color?: string };
  if (!c.color || c.color === "null") return undefined;
  if (c.color.startsWith("#")) return c.color.toUpperCase();
  return c.color;
}

/**
 * Retrieve cell ranges with optional styles
 */
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

/**
 * CSV export result
 */
export interface GetRangeAsCsvResult {
  success: boolean;
  csv: string;
  rowCount: number;
  columnCount: number;
  hasMore: boolean;
  sheetName: string;
}

/**
 * Retrieve a range as CSV
 */
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

/**
 * Search result match
 */
export interface SearchMatch {
  sheetName: string;
  sheetId: number;
  a1: string;
  value: string | number | boolean;
  formula: string | null;
  row: number;
  column: number;
}

/**
 * Search result with pagination
 */
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

/**
 * Search for data across sheets with pagination
 */
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
