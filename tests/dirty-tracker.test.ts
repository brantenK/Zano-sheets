/**
 * Integration tests for dirty tracker
 *
 * Tests Excel dirty range tracking functionality:
 * - parseDirtyRanges: Parse _dirtyRanges from tool results
 * - mergeRanges: Merge and deduplicate overlapping ranges
 * - formatDirtyRanges: Format ranges for display
 * - parseRange: Parse range addresses to bounding boxes
 */

import { describe, expect, it } from "vitest";
import {
  formatDirtyRanges,
  mergeRanges,
  parseDirtyRanges,
  parseRange,
} from "../src/lib/dirty-tracker";
import type { DirtyRange } from "../src/lib/dirty-tracker";

describe("parseDirtyRanges", () => {
  it("returns null for undefined result", () => {
    expect(parseDirtyRanges(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseDirtyRanges("")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseDirtyRanges("not json")).toBeNull();
  });

  it("returns null for JSON without _dirtyRanges", () => {
    expect(parseDirtyRanges('{"foo": "bar"}')).toBeNull();
  });

  it("returns null for _dirtyRanges that is not an array", () => {
    expect(parseDirtyRanges('{"_dirtyRanges": "not an array"}')).toBeNull();
  });

  it("parses valid dirty ranges array", () => {
    const result = JSON.stringify({
      _dirtyRanges: [
        { sheetId: 1, range: "A1:B5" },
        { sheetId: 2, range: "*" },
      ],
    });
    expect(parseDirtyRanges(result)).toEqual([
      { sheetId: 1, range: "A1:B5" },
      { sheetId: 2, range: "*" },
    ]);
  });

  it("handles empty _dirtyRanges array", () => {
    const result = JSON.stringify({ _dirtyRanges: [] });
    expect(parseDirtyRanges(result)).toEqual([]);
  });
});

describe("mergeRanges", () => {
  it("returns empty array for no ranges", () => {
    expect(mergeRanges([])).toEqual([]);
  });

  it("returns single range unchanged", () => {
    const ranges: DirtyRange[] = [{ sheetId: 1, range: "A1:B5" }];
    expect(mergeRanges(ranges)).toEqual(ranges);
  });

  it("deduplicates exact matching ranges", () => {
    const ranges: DirtyRange[] = [
      { sheetId: 1, range: "A1:B5" },
      { sheetId: 1, range: "A1:B5" },
    ];
    expect(mergeRanges(ranges)).toEqual([{ sheetId: 1, range: "A1:B5" }]);
  });

  it("replaces all ranges with wildcard when wildcard is present", () => {
    const ranges: DirtyRange[] = [
      { sheetId: 1, range: "A1:B5" },
      { sheetId: 1, range: "C1:D5" },
      { sheetId: 1, range: "*" },
      { sheetId: 1, range: "E1:F5" },
    ];
    expect(mergeRanges(ranges)).toEqual([{ sheetId: 1, range: "*" }]);
  });

  it("keeps non-wildcard ranges when wildcard is on different sheet", () => {
    const ranges: DirtyRange[] = [
      { sheetId: 1, range: "A1:B5" },
      { sheetId: 2, range: "*" },
      { sheetId: 1, range: "C1:D5" },
    ];
    const merged = mergeRanges(ranges);
    // All 3 ranges are preserved: wildcard on sheet 2 doesn't affect sheet 1,
    // and the two non-overlapping ranges on sheet 1 are both kept
    expect(merged).toHaveLength(3);
    expect(merged).toContainEqual({ sheetId: 1, range: "A1:B5" });
    expect(merged).toContainEqual({ sheetId: 1, range: "C1:D5" });
    expect(merged).toContainEqual({ sheetId: 2, range: "*" });
  });

  it("preserves multiple non-overlapping ranges on same sheet", () => {
    const ranges: DirtyRange[] = [
      { sheetId: 1, range: "A1:B5" },
      { sheetId: 1, range: "Z1:AA5" },
    ];
    const merged = mergeRanges(ranges);
    expect(merged).toHaveLength(2);
    expect(merged).toContainEqual({ sheetId: 1, range: "A1:B5" });
    expect(merged).toContainEqual({ sheetId: 1, range: "Z1:AA5" });
  });

  it("handles ranges across multiple sheets", () => {
    const ranges: DirtyRange[] = [
      { sheetId: 1, range: "A1:B5" },
      { sheetId: 2, range: "C1:D5" },
      { sheetId: 3, range: "*" },
    ];
    const merged = mergeRanges(ranges);
    expect(merged).toHaveLength(3);
  });
});

describe("parseRange", () => {
  it("returns null for wildcard", () => {
    expect(parseRange("*")).toBeNull();
  });

  it("parses single cell address", () => {
    expect(parseRange("A1")).toEqual({
      startCol: 0,
      startRow: 0,
      endCol: 0,
      endRow: 0,
    });
  });

  it("parses range address", () => {
    expect(parseRange("A1:B5")).toEqual({
      startCol: 0,
      startRow: 0,
      endCol: 1,
      endRow: 4,
    });
  });

  it("parses range in reverse order", () => {
    expect(parseRange("B5:A1")).toEqual({
      startCol: 0,
      startRow: 0,
      endCol: 1,
      endRow: 4,
    });
  });

  it("parses multi-column ranges", () => {
    expect(parseRange("A1:Z10")).toEqual({
      startCol: 0,
      startRow: 0,
      endCol: 25,
      endRow: 9,
    });
  });

  it("handles uppercase and lowercase letters", () => {
    expect(parseRange("a1:b5")).toEqual({
      startCol: 0,
      startRow: 0,
      endCol: 1,
      endRow: 4,
    });
  });

  it("returns null for invalid address", () => {
    expect(parseRange("INVALID")).toBeNull();
  });

  it("parses single cell without colon", () => {
    const result = parseRange("Z100");
    expect(result).toEqual({
      startCol: 25,
      startRow: 99,
      endCol: 25,
      endRow: 99,
    });
  });
});

describe("formatDirtyRanges", () => {
  it("returns empty string for no ranges", () => {
    expect(formatDirtyRanges([])).toBe("");
  });

  it("formats single range", () => {
    const ranges: DirtyRange[] = [{ sheetId: 1, range: "A1:B5" }];
    expect(formatDirtyRanges(ranges)).toBe("Sheet 1!A1:B5");
  });

  it("formats wildcard range", () => {
    const ranges: DirtyRange[] = [{ sheetId: 1, range: "*" }];
    expect(formatDirtyRanges(ranges)).toBe("Sheet 1 (all)");
  });

  it("formats multiple ranges with comma separator", () => {
    const ranges: DirtyRange[] = [
      { sheetId: 1, range: "A1:B5" },
      { sheetId: 2, range: "C1:D5" },
    ];
    const result = formatDirtyRanges(ranges);
    expect(result).toContain("Sheet 1!A1:B5");
    expect(result).toContain("Sheet 2!C1:D5");
  });

  it("uses sheet name lookup when provided", () => {
    const ranges: DirtyRange[] = [
      { sheetId: 1, range: "A1:B5" },
      { sheetId: 2, range: "*" },
    ];
    const lookup = (id: number) =>
      id === 1 ? "MyData" : id === 2 ? "Summary" : undefined;
    const result = formatDirtyRanges(ranges, lookup);
    expect(result).toContain("MyData!A1:B5");
    expect(result).toContain("Summary (all)");
  });

  it("displays sheet number for negative sheet ID", () => {
    const ranges: DirtyRange[] = [{ sheetId: -1, range: "A1:B5" }];
    expect(formatDirtyRanges(ranges)).toBe("Sheet -1!A1:B5");
  });

  it("displays sheet number with wildcard for negative sheet ID", () => {
    const ranges: DirtyRange[] = [{ sheetId: -1, range: "*" }];
    expect(formatDirtyRanges(ranges)).toBe("Sheet -1 (all)");
  });

  it("falls back to sheet number when name not found", () => {
    const ranges: DirtyRange[] = [{ sheetId: 5, range: "A1:B5" }];
    const lookup = () => undefined;
    expect(formatDirtyRanges(ranges, lookup)).toBe("Sheet 5!A1:B5");
  });
});
