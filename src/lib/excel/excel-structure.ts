/* global Excel */

import { resilientSync, runWithRetry } from "./excel-core";
import { letterToColumnIndex } from "./excel-range";
import { columnIndexToLetter } from "./excel-utils";
import { getStableSheetId, preloadSheetIds } from "./sheet-id-map";

/**
 * Get a worksheet by stable ID
 */
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

/**
 * Get the stable ID for a worksheet
 */
export async function getWorksheetStableId(
  context: Excel.RequestContext,
  sheet: Excel.Worksheet,
): Promise<number> {
  sheet.load("id");
  await resilientSync(context);
  return getStableSheetId(sheet.id);
}

/**
 * Result from modifying sheet structure
 */
export interface ModifySheetStructureResult {
  success: boolean;
  operation: string;
}

/**
 * Modify sheet structure (insert/delete rows/columns, freeze panes, etc.)
 */
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

/**
 * Result from modifying workbook structure
 */
export interface ModifyWorkbookStructureResult {
  success: boolean;
  operation: string;
  sheetId?: number;
  sheetName?: string;
}

/**
 * Modify workbook structure (create/delete/rename/duplicate sheets)
 */
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

/**
 * Navigate result
 */
export interface NavigateResult {
  success: boolean;
  sheetName?: string;
  range?: string;
}

/**
 * Navigate to a sheet and optionally select a range
 */
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
