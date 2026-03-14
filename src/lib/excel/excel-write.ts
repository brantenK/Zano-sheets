/* global Excel */

import { resilientSync, runWithRetry } from "./excel-core";
import {
  cellAddress,
  getPointsPerStandardColumnWidth,
  parseRangeAddress,
} from "./excel-range";
import { getWorksheetById } from "./excel-structure";

/**
 * Cell input type: primitive value or object with formula and styling
 */
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

/**
 * Result from setting cell range
 */
export interface SetCellRangeResult {
  success: boolean;
  cellsWritten: number;
  formulaResults?: Record<string, unknown>;
  messages?: string[];
}

/**
 * Internal helper: Normalize horizontal alignment values
 */
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

/**
 * Set cell range with values, formulas, and optional styling
 */
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

/**
 * Result from clearing a cell range
 */
export interface ClearCellRangeResult {
  success: boolean;
  clearedRange: string;
}

/**
 * Clear cell range
 */
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

/**
 * Result from copy operation
 */
export interface CopyToResult {
  success: boolean;
  source: string;
  destination: string;
}

/**
 * Copy from one range to another
 */
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

/**
 * Result from resizing a range
 */
export interface ResizeRangeResult {
  success: boolean;
}

/**
 * Resize range (width/height)
 */
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
