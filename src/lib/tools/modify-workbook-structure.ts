import { Type } from "@sinclair/typebox";
import { checkToolApproval } from "../../taskpane/components/chat/chat-context";
import {
  bustWorkbookMetadataCache,
  modifyWorkbookStructure,
} from "../excel/api";
import { defineTool, toolError, toolSuccess } from "./types";

export const modifyWorkbookStructureTool = defineTool({
  name: "modify_workbook_structure",
  label: "Modify Workbook Structure",
  description:
    "Create, delete, rename, or duplicate worksheets. " +
    "Use this to manage sheets in the workbook.",
  parameters: Type.Object({
    operation: Type.Union(
      [
        Type.Literal("create"),
        Type.Literal("delete"),
        Type.Literal("rename"),
        Type.Literal("duplicate"),
      ],
      { description: "Operation to perform" },
    ),
    sheetId: Type.Optional(
      Type.Number({ description: "Sheet ID for delete/rename/duplicate" }),
    ),
    sheetName: Type.Optional(
      Type.String({ description: "Name for new sheet (create)" }),
    ),
    newName: Type.Optional(
      Type.String({
        description: "New name (rename) or name for copy (duplicate)",
      }),
    ),
    tabColor: Type.Optional(
      Type.String({ description: "Tab color as hex, e.g. '#ff0000'" }),
    ),
    explanation: Type.Optional(
      Type.String({
        description: "Brief explanation (max 50 chars)",
        maxLength: 50,
      }),
    ),
  }),
  dirtyTracking: {
    getRanges: (p, result) => {
      if (p.operation === "create" || p.operation === "duplicate") {
        const r = result as { sheetId?: number };
        return r?.sheetId ? [{ sheetId: r.sheetId, range: "*" }] : [];
      }
      return p.sheetId ? [{ sheetId: p.sheetId, range: "*" }] : [];
    },
  },
  execute: async (toolCallId, params) => {
    try {
      await checkToolApproval(toolCallId);
      const result = await modifyWorkbookStructure(params);
      bustWorkbookMetadataCache();
      return toolSuccess(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error modifying workbook";
      return toolError(message);
    }
  },
});
