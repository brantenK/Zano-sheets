/* global Excel */

import { resilientSync, runWithRetry } from "./excel-core";
import { getRangeFromAddress } from "./excel-range";
import { getWorksheetById } from "./excel-structure";
import { getStableSheetId, preloadSheetIds } from "./sheet-id-map";

/**
 * Excel object (chart or pivot table) reference
 */
export interface ExcelObject {
  id: string;
  type: "chart" | "pivotTable";
  name: string;
  sheetId: number;
  sheetName: string;
}

/**
 * Result from getting all objects
 */
export interface GetAllObjectsResult {
  success: boolean;
  objects: ExcelObject[];
}

/**
 * Get all charts and pivot tables in the workbook
 */
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

/**
 * Result from modifying an object
 */
export interface ModifyObjectResult {
  success: boolean;
  operation: string;
  id?: string;
}

/**
 * Internal helper: Clear row/column axis
 */
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

/**
 * Internal helper: Clear data axis
 */
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

/**
 * Internal helper: Apply pivot table fields
 */
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

/**
 * Create, update, or delete charts and pivot tables
 */
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
