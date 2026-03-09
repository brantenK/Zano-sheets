import { Type } from "@sinclair/typebox";
import { checkToolApproval } from "../../taskpane/components/chat/chat-context";
import { type CellInput, setCellRange } from "../excel/api";
import { defineTool, toolError, toolSuccess } from "./types";

const BorderStyleSchema = Type.Optional(
  Type.Object({
    style: Type.Optional(
      Type.Union([
        Type.Literal("solid"),
        Type.Literal("dashed"),
        Type.Literal("dotted"),
        Type.Literal("double"),
      ]),
    ),
    weight: Type.Optional(
      Type.Union([
        Type.Literal("thin"),
        Type.Literal("medium"),
        Type.Literal("thick"),
      ]),
    ),
    color: Type.Optional(Type.String()),
  }),
);

const CellStylesSchema = Type.Optional(
  Type.Object({
    fontWeight: Type.Optional(
      Type.Union([Type.Literal("normal"), Type.Literal("bold")]),
    ),
    fontStyle: Type.Optional(
      Type.Union([Type.Literal("normal"), Type.Literal("italic")]),
    ),
    fontLine: Type.Optional(
      Type.Union([
        Type.Literal("none"),
        Type.Literal("underline"),
        Type.Literal("line-through"),
      ]),
    ),
    fontSize: Type.Optional(Type.Number()),
    fontFamily: Type.Optional(Type.String()),
    fontColor: Type.Optional(Type.String()),
    backgroundColor: Type.Optional(Type.String()),
    horizontalAlignment: Type.Optional(
      Type.Union([
        Type.Literal("left"),
        Type.Literal("center"),
        Type.Literal("right"),
        Type.Literal("centre"),
        Type.Literal("middle"),
        Type.Literal("start"),
        Type.Literal("end"),
      ]),
    ),
    numberFormat: Type.Optional(Type.String()),
  }),
);

const BorderStylesSchema = Type.Optional(
  Type.Object({
    top: BorderStyleSchema,
    bottom: BorderStyleSchema,
    left: BorderStyleSchema,
    right: BorderStyleSchema,
  }),
);

const CellSchema = Type.Object({
  value: Type.Optional(Type.Any()),
  formula: Type.Optional(Type.String()),
  note: Type.Optional(Type.String()),
  cellStyles: CellStylesSchema,
  borderStyles: BorderStylesSchema,
});

const ResizeSchema = Type.Optional(
  Type.Object({
    type: Type.Union([Type.Literal("points"), Type.Literal("standard")]),
    value: Type.Number(),
  }),
);

export const setCellRangeTool = defineTool({
  name: "set_cell_range",
  label: "Set Cell Range",
  description:
    "WRITE. Write values, formulas, and formatting to cells. " +
    "The range is auto-expanded to match the cells array dimensions (e.g. A1 with a 1x3 array becomes A1:C1). " +
    "EFFICIENCY: For datasets larger than 1000 cells, this tool will fail. " +
    "You MUST use the 'bash' tool with 'csv-to-sheet' command for large data to avoid context limits. " +
    "OVERWRITE PROTECTION: By default, fails if target cells contain data. " +
    "If the tool returns an overwrite error, read those cells to see what's there, " +
    "confirm with the user, then retry with allow_overwrite=true. " +
    "Only set allow_overwrite=true on first attempt if user explicitly says 'replace' or 'overwrite'. " +
    "Use copyToRange to expand a pattern to a larger area.",
  parameters: Type.Object({
    sheetId: Type.Number({ description: "The worksheet ID (1-based index)" }),
    range: Type.String({
      description:
        "Target range in A1 notation (auto-expands to match cells dimensions)",
    }),
    cells: Type.Array(
      Type.Array(
        Type.Union([
          Type.String(),
          Type.Number(),
          Type.Boolean(),
          Type.Null(),
          CellSchema,
        ]),
      ),
      {
        description:
          "2D array of cell data matching range dimensions (max 1000 total cells). Can be raw values or objects with styles.",
      },
    ),
    copyToRange: Type.Optional(
      Type.String({
        description: "Expand pattern to larger range after writing",
      }),
    ),
    resizeWidth: ResizeSchema,
    resizeHeight: ResizeSchema,
    allow_overwrite: Type.Optional(
      Type.Boolean({ description: "Confirm overwriting existing data" }),
    ),
    explanation: Type.Optional(
      Type.String({
        description: "Brief explanation (max 50 chars)",
        maxLength: 50,
      }),
    ),
  }),
  dirtyTracking: {
    getRanges: (p) => {
      const ranges = [{ sheetId: p.sheetId, range: p.range }];
      if (p.copyToRange) {
        ranges.push({ sheetId: p.sheetId, range: p.copyToRange });
      }
      return ranges;
    },
  },
  execute: async (toolCallId, params) => {
    try {
      await checkToolApproval(toolCallId);
      const totalCells = params.cells.flat().length;
      if (totalCells > 1000) {
        return toolError(
          `Range too large (${totalCells} cells). For data larger than 1000 cells, ` +
            "you MUST use the 'bash' tool with 'csv-to-sheet' command to maintain efficiency and context limits. " +
            "First, save the data to a CSV file in the VFS, then call csv-to-sheet.",
        );
      }
      const result = await setCellRange(
        params.sheetId,
        params.range,
        params.cells as CellInput[][],
        {
          copyToRange: params.copyToRange,
          resizeWidth: params.resizeWidth,
          resizeHeight: params.resizeHeight,
          allowOverwrite: params.allow_overwrite,
        },
      );
      return toolSuccess(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error writing cells";
      return toolError(message);
    }
  },
});
