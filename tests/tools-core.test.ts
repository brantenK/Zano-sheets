/**
 * Core tools test coverage for Zano Sheets
 * Tests for set-cell-range, clear-cell-range, copy-to, and get-cell-ranges tools
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  setCellRangeMock,
  clearCellRangeMock,
  copyToMock,
  getCellRangesMock,
  checkToolApprovalMock,
} = vi.hoisted(() => ({
  setCellRangeMock: vi.fn(),
  clearCellRangeMock: vi.fn(),
  copyToMock: vi.fn(),
  getCellRangesMock: vi.fn(),
  checkToolApprovalMock: vi.fn(),
}));

vi.mock("../src/lib/excel/api", () => ({
  setCellRange: setCellRangeMock,
  clearCellRange: clearCellRangeMock,
  copyTo: copyToMock,
  getCellRanges: getCellRangesMock,
}));

vi.mock("../src/lib/tool-approval", () => ({
  checkToolApproval: checkToolApprovalMock,
}));

import {
  setCellRangeTool,
  clearCellRangeTool,
  copyToTool,
  getCellRangesTool,
} from "../src/lib/tools";

beforeEach(() => {
  vi.clearAllMocks();
  checkToolApprovalMock.mockResolvedValue(undefined);
});

describe("setCellRangeTool", () => {
  it("should expose the correct tool name", () => {
    expect(setCellRangeTool.name).toBe("set_cell_range");
  });

  it("should reject ranges with more than 1000 cells", async () => {
    const largeArray = Array(34).fill(Array(31).fill("value")); // 34x31 = 1054 cells

    const result = await setCellRangeTool.execute("call-1", {
      sheetId: 1,
      range: "A1:AH34",
      cells: largeArray,
    });

    expect(result.content[0].type).toBe("text");
    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain("larger than 1000 cells");
    expect(setCellRangeMock).not.toHaveBeenCalled();
  });

  it("should allow ranges with exactly 1000 cells", async () => {
    const cellArray = Array(50).fill(Array(20).fill("data")); // 50x20 = 1000 cells
    setCellRangeMock.mockResolvedValue({
      rangeAddress: "A1:T50",
      cellsWritten: 1000,
    });

    const result = await setCellRangeTool.execute("call-2", {
      sheetId: 1,
      range: "A1:T50",
      cells: cellArray,
    });

    expect(setCellRangeMock).toHaveBeenCalledWith(
      1,
      "A1:T50",
      cellArray,
      expect.objectContaining({
        allowOverwrite: undefined,
      }),
    );
    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.cellsWritten).toBe(1000);
  });

  it("should pass through allow_overwrite flag", async () => {
    const cells = [["value1", "value2"]];
    setCellRangeMock.mockResolvedValue({ rangeAddress: "A1:B1" });

    await setCellRangeTool.execute("call-3", {
      sheetId: 1,
      range: "A1:B1",
      cells,
      allow_overwrite: true,
    });

    expect(setCellRangeMock).toHaveBeenCalledWith(
      1,
      "A1:B1",
      cells,
      expect.objectContaining({
        allowOverwrite: true,
      }),
    );
  });

  it("should handle cell styling objects in the cells array", async () => {
    const cells = [
      [
        {
          value: "Styled Text",
          cellStyles: {
            fontWeight: "bold",
            fontColor: "#FF0000",
          },
        },
      ],
    ];
    setCellRangeMock.mockResolvedValue({ rangeAddress: "A1" });

    const result = await setCellRangeTool.execute("call-4", {
      sheetId: 1,
      range: "A1",
      cells,
    });

    expect(setCellRangeMock).toHaveBeenCalledWith(1, "A1", cells, expect.any(Object));
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.rangeAddress).toBe("A1");
  });

  it("should handle formulas in cell data", async () => {
    const cells = [[{ formula: "=SUM(A1:A10)" }]];
    setCellRangeMock.mockResolvedValue({ rangeAddress: "B1" });

    await setCellRangeTool.execute("call-5", {
      sheetId: 1,
      range: "B1",
      cells,
    });

    expect(setCellRangeMock).toHaveBeenCalledWith(1, "B1", cells, expect.any(Object));
  });

  it("should require tool approval before writing", async () => {
    const cells = [["data"]];
    checkToolApprovalMock.mockRejectedValue(new Error("Approval denied"));

    const result = await setCellRangeTool.execute("call-6", {
      sheetId: 1,
      range: "A1",
      cells,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBeDefined();
    expect(checkToolApprovalMock).toHaveBeenCalledWith("call-6", "set_cell_range");
  });

  it("should pass copyToRange parameter through", async () => {
    const cells = [["pattern"]];
    setCellRangeMock.mockResolvedValue({ rangeAddress: "A1:E1" });

    await setCellRangeTool.execute("call-7", {
      sheetId: 1,
      range: "A1",
      cells,
      copyToRange: "A1:E1",
    });

    expect(setCellRangeMock).toHaveBeenCalledWith(
      1,
      "A1",
      cells,
      expect.objectContaining({
        copyToRange: "A1:E1",
      }),
    );
  });

  it("should handle resize parameters", async () => {
    const cells = [["data"]];
    setCellRangeMock.mockResolvedValue({ rangeAddress: "A1" });

    await setCellRangeTool.execute("call-8", {
      sheetId: 1,
      range: "A1",
      cells,
      resizeWidth: { type: "points", value: 100 },
      resizeHeight: { type: "standard", value: 30 },
    });

    expect(setCellRangeMock).toHaveBeenCalledWith(
      1,
      "A1",
      cells,
      expect.objectContaining({
        resizeWidth: { type: "points", value: 100 },
        resizeHeight: { type: "standard", value: 30 },
      }),
    );
  });
});

describe("clearCellRangeTool", () => {
  it("should expose the correct tool name", () => {
    expect(clearCellRangeTool.name).toBe("clear_cell_range");
  });

  it("should require tool approval before clearing", async () => {
    checkToolApprovalMock.mockRejectedValue(new Error("Approval denied"));

    const result = await clearCellRangeTool.execute("call-1", {
      sheetId: 1,
      range: "A1:B10",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBeDefined();
    expect(checkToolApprovalMock).toHaveBeenCalledWith("call-1", "clear_cell_range");
  });

  it("should clear only contents by default", async () => {
    clearCellRangeMock.mockResolvedValue({ rangeAddress: "A1:B10", cleared: true });

    await clearCellRangeTool.execute("call-2", {
      sheetId: 1,
      range: "A1:B10",
    });

    expect(clearCellRangeMock).toHaveBeenCalledWith(1, "A1:B10", undefined);
  });

  it("should support clearing all (contents and formatting)", async () => {
    clearCellRangeMock.mockResolvedValue({ rangeAddress: "A1:C5", cleared: true });

    await clearCellRangeTool.execute("call-3", {
      sheetId: 1,
      range: "A1:C5",
      clearType: "all",
    });

    expect(clearCellRangeMock).toHaveBeenCalledWith(1, "A1:C5", "all");
  });

  it("should support clearing only formatting", async () => {
    clearCellRangeMock.mockResolvedValue({ rangeAddress: "A1:A1", cleared: true });

    await clearCellRangeTool.execute("call-4", {
      sheetId: 1,
      range: "A1:A1",
      clearType: "formats",
    });

    expect(clearCellRangeMock).toHaveBeenCalledWith(1, "A1:A1", "formats");
  });

  it("should handle Excel API errors", async () => {
    clearCellRangeMock.mockRejectedValue(
      new Error("Invalid range format: A1:Z99:Z100"),
    );

    const result = await clearCellRangeTool.execute("call-5", {
      sheetId: 1,
      range: "A1:Z99:Z100",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("Invalid range format");
  });

  it("should track dirty ranges for notification", () => {
    expect(clearCellRangeTool.dirtyTracking).toBeDefined();
    const ranges = clearCellRangeTool.dirtyTracking!.getRanges({
      sheetId: 2,
      range: "A1:D10",
    });
    expect(ranges).toEqual([{ sheetId: 2, range: "A1:D10" }]);
  });
});

describe("copyToTool", () => {
  it("should expose the correct tool name", () => {
    expect(copyToTool.name).toBe("copy_to");
  });

  it("should require tool approval", async () => {
    checkToolApprovalMock.mockRejectedValue(new Error("Not approved"));

    const result = await copyToTool.execute("call-1", {
      sheetId: 1,
      sourceRange: "A1:B1",
      destinationRange: "A1:B100",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBeDefined();
    expect(checkToolApprovalMock).toHaveBeenCalledWith("call-1", "copy_to");
  });

  it("should copy with formula translation", async () => {
    copyToMock.mockResolvedValue({
      sourceRange: "A1:B1",
      destinationRange: "A1:B5",
      cellsCopied: 10,
    });

    const result = await copyToTool.execute("call-2", {
      sheetId: 1,
      sourceRange: "A1:B1",
      destinationRange: "A1:B5",
    });

    expect(copyToMock).toHaveBeenCalledWith(1, "A1:B1", "A1:B5");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.cellsCopied).toBe(10);
  });

  it("should handle copying a single column formula down", async () => {
    copyToMock.mockResolvedValue({
      sourceRange: "A1",
      destinationRange: "A1:A100",
      cellsCopied: 100,
    });

    await copyToTool.execute("call-3", {
      sheetId: 1,
      sourceRange: "A1",
      destinationRange: "A1:A100",
    });

    expect(copyToMock).toHaveBeenCalledWith(1, "A1", "A1:A100");
  });

  it("should track dirty ranges for the destination", () => {
    expect(copyToTool.dirtyTracking).toBeDefined();
    const ranges = copyToTool.dirtyTracking!.getRanges({
      sheetId: 3,
      sourceRange: "A1:B1",
      destinationRange: "C1:D100",
    });
    expect(ranges).toEqual([{ sheetId: 3, range: "C1:D100" }]);
  });

  it("should handle API errors gracefully", async () => {
    copyToMock.mockRejectedValue(new Error("Sheet 1 is read-only"));

    const result = await copyToTool.execute("call-4", {
      sheetId: 1,
      sourceRange: "A1:A10",
      destinationRange: "B1:B10",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("read-only");
  });
});

describe("getCellRangesTool", () => {
  it("should expose the correct tool name", () => {
    expect(getCellRangesTool.name).toBe("get_cell_ranges");
  });

  it("should read cell values and formulas", async () => {
    getCellRangesMock.mockResolvedValue({
      "A1": { value: "Header", formula: undefined },
      "A2": { value: 100, formula: undefined },
      "B1": { value: "Total", formula: undefined },
      "B2": { value: 150, formula: "=A2+50" },
    });

    const result = await getCellRangesTool.execute("call-1", {
      sheetId: 1,
      ranges: ["A1:B2"],
    });

    expect(getCellRangesMock).toHaveBeenCalledWith(1, ["A1:B2"], {
      includeStyles: undefined,
      cellLimit: undefined,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.A1.value).toBe("Header");
    expect(parsed.B2.formula).toBe("=A2+50");
  });

  it("should support multiple ranges", async () => {
    getCellRangesMock.mockResolvedValue({
      A1: { value: "data1" },
      E5: { value: "data2" },
    });

    await getCellRangesTool.execute("call-2", {
      sheetId: 1,
      ranges: ["A1:A1", "E5:E5"],
    });

    expect(getCellRangesMock).toHaveBeenCalledWith(1, ["A1:A1", "E5:E5"], expect.any(Object));
  });

  it("should include styles when requested", async () => {
    getCellRangesMock.mockResolvedValue({
      A1: {
        value: "Styled",
        fontColor: "#FF0000",
        fontWeight: "bold",
      },
    });

    await getCellRangesTool.execute("call-3", {
      sheetId: 1,
      ranges: ["A1"],
      includeStyles: true,
    });

    expect(getCellRangesMock).toHaveBeenCalledWith(1, ["A1"], {
      includeStyles: true,
      cellLimit: undefined,
    });
  });

  it("should respect cellLimit parameter", async () => {
    getCellRangesMock.mockResolvedValue({ A1: { value: "limited" } });

    await getCellRangesTool.execute("call-4", {
      sheetId: 1,
      ranges: ["A1:Z100"],
      cellLimit: 500,
    });

    expect(getCellRangesMock).toHaveBeenCalledWith(1, ["A1:Z100"], {
      includeStyles: undefined,
      cellLimit: 500,
    });
  });

  it("should truncate results if they exceed 80KB", async () => {
    // Create a large mock result
    const largeData: Record<string, unknown> = {};
    for (let i = 0; i < 20000; i++) {
      largeData[`A${i}`] = { value: "x".repeat(100) };
    }
    getCellRangesMock.mockResolvedValue(largeData);

    const result = await getCellRangesTool.execute("call-5", {
      sheetId: 1,
      ranges: ["A1:A20000"],
    });

    const text = result.content[0].text;
    expect(text).toContain("[TRUNCATED");
    expect(text).toContain("Result exceeded");
  });

  it("should handle empty ranges gracefully", async () => {
    getCellRangesMock.mockResolvedValue({});

    const result = await getCellRangesTool.execute("call-6", {
      sheetId: 1,
      ranges: ["Z1:Z100"],
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(Object.keys(parsed).length).toBe(0);
  });

  it("should handle API errors during read", async () => {
    getCellRangesMock.mockRejectedValue(new Error("Sheet does not exist"));

    const result = await getCellRangesTool.execute("call-7", {
      sheetId: 99,
      ranges: ["A1:A10"],
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("Sheet does not exist");
  });

  it("should apply default cellLimit of 2000 when not specified", async () => {
    getCellRangesMock.mockResolvedValue({ A1: { value: "test" } });

    await getCellRangesTool.execute("call-8", {
      sheetId: 1,
      ranges: ["A1:Z100"],
    });

    // Check that cellLimit is passed as undefined (respecting default)
    expect(getCellRangesMock).toHaveBeenCalledWith(
      1,
      ["A1:Z100"],
      expect.objectContaining({
        cellLimit: undefined,
      }),
    );
  });
});
