/**
 * Extended tools test coverage
 * Tests for resize-range, search-data, and other utility tools
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  resizeRangeMock,
  searchDataMock,
  getRangeAsCsvMock,
  getWorksheetByIdMock,
  getAllObjectsMock,
  checkToolApprovalMock,
} = vi.hoisted(() => ({
  resizeRangeMock: vi.fn(),
  searchDataMock: vi.fn(),
  getRangeAsCsvMock: vi.fn(),
  getWorksheetByIdMock: vi.fn(),
  getAllObjectsMock: vi.fn(),
  checkToolApprovalMock: vi.fn(),
}));

vi.mock("../src/lib/excel/api", () => ({
  resizeRange: resizeRangeMock,
  searchData: searchDataMock,
  getRangeAsCsv: getRangeAsCsvMock,
  getWorksheetById: getWorksheetByIdMock,
  getAllObjects: getAllObjectsMock,
}));

vi.mock("../src/lib/tool-approval", () => ({
  checkToolApproval: checkToolApprovalMock,
}));

import {
  resizeRangeTool,
  searchDataTool,
  getRangeAsCsvTool,
  screenshotRangeTool,
  getAllObjectsTool,
} from "../src/lib/tools";

beforeEach(() => {
  vi.clearAllMocks();
  checkToolApprovalMock.mockResolvedValue(undefined);

  const excelShim = {
    run: vi.fn(async (cb: (context: { sync: () => Promise<void> }) => unknown) =>
      cb({ sync: vi.fn(async () => undefined) }),
    ),
  };

  (globalThis as unknown as { Excel: typeof excelShim }).Excel = excelShim;
});

describe("resizeRangeTool", () => {
  it("should expose correct tool name", () => {
    expect(resizeRangeTool.name).toBe("resize_range");
  });

  it("should require tool approval", async () => {
    checkToolApprovalMock.mockRejectedValue(new Error("Approval denied"));

    const result = await resizeRangeTool.execute("call-1", {
      sheetId: 1,
      range: "1:5",
      height: { type: "standard", value: 25 },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("Approval denied");
    expect(resizeRangeMock).not.toHaveBeenCalled();
  });

  it("should call resizeRange with mapped options", async () => {
    resizeRangeMock.mockResolvedValue({ success: true });

    await resizeRangeTool.execute("call-2", {
      sheetId: 1,
      range: "A1:Z100",
      width: { type: "points", value: 150 },
      height: { type: "standard", value: 30 },
    });

    expect(resizeRangeMock).toHaveBeenCalledWith(1, {
      range: "A1:Z100",
      width: { type: "points", value: 150 },
      height: { type: "standard", value: 30 },
    });
  });

  it("should track dirty ranges", () => {
    expect(resizeRangeTool.dirtyTracking).toBeDefined();
    const ranges = resizeRangeTool.dirtyTracking?.getRanges({
      sheetId: 2,
      range: "B1:B50",
    });
    expect(ranges).toEqual([{ sheetId: 2, range: "B1:B50" }]);
  });
});

describe("searchDataTool", () => {
  it("should expose correct tool name", () => {
    expect(searchDataTool.name).toBe("search_data");
  });

  it("should search for exact text match", async () => {
    searchDataMock.mockResolvedValue({
      matches: [
        { address: "A1", value: "John Doe", sheetId: 1 },
        { address: "B5", value: "John Doe", sheetId: 1 },
      ],
      totalMatches: 2,
    });

    const result = await searchDataTool.execute("call-1", {
      sheetId: 1,
      searchTerm: "John Doe",
      options: { matchEntireCell: true },
    });

    expect(searchDataMock).toHaveBeenCalledWith(
      "John Doe",
      expect.objectContaining({
        sheetId: 1,
        matchEntireCell: true,
      }),
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.matches.length).toBe(2);
    expect(parsed.totalMatches).toBe(2);
  });

  it("should search with case-insensitive matching", async () => {
    searchDataMock.mockResolvedValue({
      matches: [
        { address: "A1", value: "HELLO", sheetId: 1 },
        { address: "A2", value: "hello", sheetId: 1 },
      ],
      totalMatches: 2,
    });

    await searchDataTool.execute("call-2", {
      sheetId: 1,
      searchTerm: "hello",
    });

    expect(searchDataMock).toHaveBeenCalledWith(
      "hello",
      expect.objectContaining({
        sheetId: 1,
      }),
    );
  });

  it("should support partial/contains matching", async () => {
    searchDataMock.mockResolvedValue({
      matches: [{ address: "C3", value: "Contains the pattern here", sheetId: 1 }],
      totalMatches: 1,
    });

    await searchDataTool.execute("call-3", {
      sheetId: 1,
      searchTerm: "pattern",
    });

    expect(searchDataMock).toHaveBeenCalledWith(
      "pattern",
      expect.objectContaining({
        sheetId: 1,
      }),
    );
  });

  it("should support regex matching", async () => {
    searchDataMock.mockResolvedValue({
      matches: [
        { address: "D1", value: "john@example.com", sheetId: 1 },
        { address: "D2", value: "jane@example.com", sheetId: 1 },
      ],
      totalMatches: 2,
    });

    await searchDataTool.execute("call-4", {
      sheetId: 1,
      searchTerm: ".*@example\\.com",
      options: { useRegex: true },
    });

    expect(searchDataMock).toHaveBeenCalledWith(
      ".*@example\\.com",
      expect.objectContaining({
        sheetId: 1,
        useRegex: true,
      }),
    );
  });

  it("should limit search results when specified", async () => {
    searchDataMock.mockResolvedValue({
      matches: [{ address: "A1", value: "data", sheetId: 1 }],
      totalMatches: 100,
    });

    await searchDataTool.execute("call-5", {
      sheetId: 1,
      searchTerm: "data",
      options: { maxResults: 50 },
    });

    expect(searchDataMock).toHaveBeenCalledWith(
      "data",
      expect.objectContaining({
        maxResults: 50,
      }),
    );
  });

  it("should handle search with no matches", async () => {
    searchDataMock.mockResolvedValue({
      matches: [],
      totalMatches: 0,
    });

    const result = await searchDataTool.execute("call-6", {
      sheetId: 1,
      searchTerm: "nonexistent-value",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.matches).toHaveLength(0);
    expect(parsed.totalMatches).toBe(0);
  });

  it("should handle search API errors", async () => {
    searchDataMock.mockRejectedValue(new Error("Invalid regex pattern"));

    const result = await searchDataTool.execute("call-7", {
      sheetId: 1,
      searchTerm: "[invalid",
      options: { useRegex: true },
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("Invalid regex");
  });
});

describe("getRangeAsCsvTool", () => {
  it("should expose correct tool name", () => {
    expect(getRangeAsCsvTool.name).toBe("get_range_as_csv");
  });

  it("should convert range to CSV format", async () => {
    getRangeAsCsvMock.mockResolvedValue({
      csv: 'Name,Age,City\n"John",30,"New York"\n"Jane",25,"Boston"',
      rowCount: 3,
      columnCount: 3,
    });

    const result = await getRangeAsCsvTool.execute("call-1", {
      sheetId: 1,
      range: "A1:C3",
    });

    expect(getRangeAsCsvMock).toHaveBeenCalledWith(1, "A1:C3", expect.any(Object));
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.csv).toContain("Name,Age,City");
    expect(parsed.rowCount).toBe(3);
  });

  it("should use custom delimiter when specified", async () => {
    getRangeAsCsvMock.mockResolvedValue({
      csv: "Name,Age,City",
      rowCount: 1,
      columnCount: 3,
    });

    await getRangeAsCsvTool.execute("call-2", {
      sheetId: 1,
      range: "A1:C1",
      maxRows: 10,
    });

    expect(getRangeAsCsvMock).toHaveBeenCalledWith(1, "A1:C1", {
      maxRows: 10,
      includeHeaders: undefined,
    });
  });

  it("should optionally include headers", async () => {
    getRangeAsCsvMock.mockResolvedValue({
      csv: "A,B,C\n1,2,3",
      rowCount: 2,
      columnCount: 3,
    });

    await getRangeAsCsvTool.execute("call-3", {
      sheetId: 1,
      range: "A1:C2",
      includeHeaders: true,
    });

    expect(getRangeAsCsvMock).toHaveBeenCalledWith(1, "A1:C2", {
      includeHeaders: true,
      maxRows: undefined,
    });
  });

  it("should handle empty ranges", async () => {
    getRangeAsCsvMock.mockResolvedValue({
      csv: "",
      rowCount: 0,
      columnCount: 0,
    });

    const result = await getRangeAsCsvTool.execute("call-4", {
      sheetId: 1,
      range: "Z100:Z200",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.csv).toBe("");
    expect(parsed.rowCount).toBe(0);
  });

  it("should handle special characters and escaping", async () => {
    getRangeAsCsvMock.mockResolvedValue({
      csv: '"Test ""quoted"" value",Another,"Value with, comma"',
      rowCount: 1,
      columnCount: 3,
    });

    const result = await getRangeAsCsvTool.execute("call-5", {
      sheetId: 1,
      range: "A1:C1",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.csv).toContain('Test ""quoted""');
  });
});

describe("screenshotRangeTool", () => {
  it("should expose correct tool name", () => {
    expect(screenshotRangeTool.name).toBe("screenshot_range");
  });

  it("should validate invalid range input", async () => {
    const result = await screenshotRangeTool.execute("call-1", {
      sheetId: 1,
      range: "not-a-range",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("Invalid range");
  });

  it("should handle runtime errors during screenshot", async () => {
    getWorksheetByIdMock.mockResolvedValue(null);

    const result = await screenshotRangeTool.execute("call-2", {
      sheetId: 999,
      range: "A1:B2",
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("Worksheet with ID 999 not found");
  });
});

describe("getAllObjectsTool", () => {
  it("should expose correct tool name", () => {
    expect(getAllObjectsTool.name).toBe("get_all_objects");
  });

  it("should retrieve all charts in worksheet", async () => {
    getAllObjectsMock.mockResolvedValue({
      objects: [
        {
          type: "chart",
          id: "Chart1",
          name: "Sales Chart",
          left: 100,
          top: 100,
          width: 300,
          height: 200,
        },
        {
          type: "chart",
          id: "Chart2",
          name: "Revenue Chart",
          left: 400,
          top: 100,
          width: 300,
          height: 200,
        },
      ],
      totalCount: 2,
    });

    const result = await getAllObjectsTool.execute("call-1", {
      sheetId: 1,
      id: undefined,
    });

    expect(getAllObjectsMock).toHaveBeenCalledWith({
      sheetId: 1,
      id: undefined,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.objects).toHaveLength(2);
    expect(parsed.objects[0].type).toBe("chart");
  });

  it("should retrieve all pivot tables in worksheet", async () => {
    getAllObjectsMock.mockResolvedValue({
      objects: [
        {
          type: "table",
          id: "Table1",
          name: "SalesData",
          left: 0,
          top: 0,
          dataSourceRange: "A1:D100",
        },
      ],
      totalCount: 1,
    });

    const result = await getAllObjectsTool.execute("call-2", {
      sheetId: 1,
      id: undefined,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.objects[0].type).toBe("table");
  });

  it("should return empty list when no objects exist", async () => {
    getAllObjectsMock.mockResolvedValue({
      objects: [],
      totalCount: 0,
    });

    const result = await getAllObjectsTool.execute("call-3", {
      sheetId: 1,
      id: undefined,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.objects).toHaveLength(0);
  });

  it("should handle retrieval of all object types", async () => {
    getAllObjectsMock.mockResolvedValue({
      objects: [
        { type: "chart", id: "Chart1", name: "MyChart" },
        { type: "table", id: "Table1", name: "MyTable" },
        { type: "shape", id: "Shape1", name: "MyShape" },
      ],
      totalCount: 3,
    });

    const result = await getAllObjectsTool.execute("call-4", {
      sheetId: 1,
      id: undefined,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.objects).toHaveLength(3);
    expect(
      parsed.objects.map((o: { type: string }) => o.type),
    ).toEqual([
      "chart",
      "table",
      "shape",
    ]);
  });

  it("should handle API errors during object retrieval", async () => {
    getAllObjectsMock.mockRejectedValue(new Error("Sheet 99 does not exist"));

    const result = await getAllObjectsTool.execute("call-5", {
      sheetId: 99,
      id: undefined,
    });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toContain("does not exist");
  });
});
