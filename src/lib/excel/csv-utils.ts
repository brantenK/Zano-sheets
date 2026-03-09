export interface BuildCsvFromRangeOptions {
  includeHeaders?: boolean;
  maxRows?: number;
  rowHidden?: boolean[][];
  columnHidden?: boolean[][];
}

export interface BuildCsvFromRangeResult {
  csv: string;
  rowCount: number;
  columnCount: number;
  hasMore: boolean;
}

function isRowVisible(
  rowHidden: boolean[][] | undefined,
  rowIndex: number,
): boolean {
  return !rowHidden?.[rowIndex]?.[0];
}

function getVisibleColumnIndexes(
  columnCount: number,
  columnHidden?: boolean[][],
): number[] {
  const visibleColumnIndexes: number[] = [];

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    if (!columnHidden?.[0]?.[columnIndex]) {
      visibleColumnIndexes.push(columnIndex);
    }
  }

  return visibleColumnIndexes;
}

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);
  if (
    stringValue.includes(",") ||
    stringValue.includes('"') ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function buildCsvFromVisibleRange(
  values: unknown[][],
  options: BuildCsvFromRangeOptions = {},
): BuildCsvFromRangeResult {
  const {
    includeHeaders = true,
    maxRows = 500,
    rowHidden,
    columnHidden,
  } = options;

  const rowCount = values.length;
  const columnCount = values[0]?.length ?? 0;
  const visibleColumnIndexes = getVisibleColumnIndexes(
    columnCount,
    columnHidden,
  );
  const startRowIndex = includeHeaders ? 0 : 1;
  const visibleRowIndexes: number[] = [];

  for (let rowIndex = startRowIndex; rowIndex < rowCount; rowIndex++) {
    if (isRowVisible(rowHidden, rowIndex)) {
      visibleRowIndexes.push(rowIndex);
    }
  }

  const actualRowCount = Math.min(visibleRowIndexes.length, maxRows);
  const hasMore = visibleRowIndexes.length > maxRows;
  const csvRows = visibleRowIndexes.slice(0, actualRowCount).map((rowIndex) => {
    const row = values[rowIndex] ?? [];
    return visibleColumnIndexes
      .map((columnIndex) => escapeCsvValue(row[columnIndex]))
      .join(",");
  });

  return {
    csv: csvRows.join("\n"),
    rowCount: actualRowCount,
    columnCount: visibleColumnIndexes.length,
    hasMore,
  };
}
