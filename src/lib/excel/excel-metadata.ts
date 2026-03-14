/* global Excel */

import { resilientSync, runBatch } from "./excel-core";
import { getStableSheetId, preloadSheetIds } from "./sheet-id-map";

/**
 * Metadata about a single sheet
 */
export interface SheetMetadata {
  id: number;
  name: string;
  maxRows: number;
  maxColumns: number;
  frozenRows: number;
  frozenColumns: number;
}

/**
 * Complete workbook metadata
 */
export interface WorkbookMetadata {
  success: boolean;
  fileName: string;
  sheetsMetadata: SheetMetadata[];
  totalSheets: number;
  activeSheetId: number;
  activeSheetName: string;
  selectedRange: string;
}

/**
 * Short-lived cache to avoid 3 serial Excel round-trips before every LLM call.
 * Busted explicitly after any sheet / workbook structure change.
 */
let _metadataCache: { result: WorkbookMetadata; ts: number } | null = null;
const METADATA_CACHE_TTL_MS = 8_000;

/**
 * Clear the workbook metadata cache
 */
export function bustWorkbookMetadataCache(): void {
  _metadataCache = null;
}

/**
 * Get complete workbook metadata with sheet information
 */
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
