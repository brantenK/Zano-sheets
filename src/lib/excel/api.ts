/* global Excel */

export type { CellData } from "./excel-core";
// Core functionality
export {
  columnIndexToLetter,
  getStableSheetId,
  preloadSheetIds,
  resilientSync,
  runBatch,
  runWithRetry,
} from "./excel-core";
export type { SheetMetadata, WorkbookMetadata } from "./excel-metadata";
// Workbook metadata
export {
  bustWorkbookMetadataCache,
  getWorkbookMetadata,
} from "./excel-metadata";
export type {
  ExcelObject,
  GetAllObjectsResult,
  ModifyObjectResult,
} from "./excel-objects";
// Charts and pivot tables
export {
  getAllObjects,
  modifyObject,
} from "./excel-objects";
export type {
  CellStyle,
  GetCellRangesResult,
  GetRangeAsCsvResult,
  SearchDataResult,
  SearchMatch,
  WorksheetInfo,
} from "./excel-range";
// Range operations and cell data retrieval
export {
  cellAddress,
  getCellRanges,
  getPointsPerStandardColumnWidth,
  getRangeAsCsv,
  getRangeFromAddress,
  letterToColumnIndex,
  parseRangeAddress,
  parseSheetQualifiedAddress,
  searchData,
} from "./excel-range";
export type {
  ModifySheetStructureResult,
  ModifyWorkbookStructureResult,
  NavigateResult,
} from "./excel-structure";
// Worksheet and workbook structure
export {
  getWorksheetById,
  getWorksheetStableId,
  modifySheetStructure,
  modifyWorkbookStructure,
  navigateTo,
} from "./excel-structure";
export type {
  CellInput,
  ClearCellRangeResult,
  CopyToResult,
  ResizeRangeResult,
  SetCellRangeResult,
} from "./excel-write";
// Writing and modifying cells
export {
  clearCellRange,
  copyTo,
  resizeRange,
  setCellRange,
} from "./excel-write";
