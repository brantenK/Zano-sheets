/**
 * Tool approval gate for destructive/workbook-modifying tools.
 *
 * Extracted from chat-context.tsx so that tool files in src/lib/tools/
 * no longer reach into the UI layer for this utility.
 */

export type ToolApprovalSetting = "auto" | "prompt";

const TOOL_APPROVAL_KEY = "zanosheets-tool-approval";
const DEFAULT_TOOL_APPROVAL: ToolApprovalSetting = "prompt";
const DESTRUCTIVE_TOOLS = new Set([
  "bash",
  "clear_cell_range",
  "copy_to",
  "eval_officejs",
  "modify_object",
  "modify_sheet_structure",
  "modify_workbook_structure",
  "resize_range",
  "set_cell_range",
]);
let toolApprovalTurnId = 0;
let approvedToolTurnId: number | null = null;

export function beginToolApprovalTurn() {
  toolApprovalTurnId += 1;
  approvedToolTurnId = null;
}

export function getToolApprovalSetting(): ToolApprovalSetting {
  try {
    const stored = localStorage.getItem(TOOL_APPROVAL_KEY);
    if (stored === "auto" || stored === "prompt") {
      return stored;
    }
  } catch {
    // ignore storage failures
  }
  return DEFAULT_TOOL_APPROVAL;
}

export async function checkToolApproval(
  _toolCallId: string,
  toolName?: string,
): Promise<void> {
  const setting = getToolApprovalSetting();
  if (setting === "auto") return;
  if (toolName && !DESTRUCTIVE_TOOLS.has(toolName)) return;
  if (approvedToolTurnId === toolApprovalTurnId) return;

  const label = toolName
    ? `Allow this request to run "${toolName}" and other workbook-modifying tools for this turn?`
    : "Allow this request to run workbook-modifying tools for this turn?";
  const ok = window.confirm(label);
  if (!ok) {
    throw new Error("Tool execution cancelled by user.");
  }
  approvedToolTurnId = toolApprovalTurnId;
}

export function isToolResultErrorText(result: string | undefined): boolean {
  if (!result) return false;

  const trimmed = result.trim();
  if (trimmed.toLowerCase() === "unknown") {
    return true;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return false;
    }

    if (
      "success" in parsed &&
      (parsed as { success?: unknown }).success === false
    ) {
      return true;
    }

    if (
      "error" in parsed &&
      typeof (parsed as { error?: unknown }).error === "string"
    ) {
      return true;
    }
  } catch {
    // ignore non-JSON tool output
  }

  return false;
}

export function extractToolErrorMessage(result: string | undefined): string {
  if (!result) return "Tool execution failed.";

  const trimmed = result.trim();
  if (!trimmed) return "Tool execution failed.";

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      if (
        "error" in parsed &&
        typeof (parsed as { error?: unknown }).error === "string"
      ) {
        return (parsed as { error: string }).error;
      }
      if (
        "message" in parsed &&
        typeof (parsed as { message?: unknown }).message === "string"
      ) {
        return (parsed as { message: string }).message;
      }
    }
  } catch {
    // keep raw output fallback
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
}
