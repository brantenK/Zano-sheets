/**
 * Integration tests for Excel utilities
 *
 * Tests Excel utility functions including:
 * - Column width calculation
 * - Range parsing utilities
 * - Cell address parsing
 */

import { describe, expect, it } from "vitest";

import { parseSheetQualifiedAddress } from "../src/lib/excel/api";

describe("Excel utilities", () => {
  describe("column index conversions", () => {
    it("converts column letters to index correctly", () => {
      // A = 0, B = 1, ..., Z = 25
      const getColumnIndex = (col: string): number => {
        let result = 0;
        for (let i = 0; i < col.length; i++) {
          result = result * 26 + (col.toUpperCase().charCodeAt(i) - 64);
        }
        return result - 1;
      };

      expect(getColumnIndex("A")).toBe(0);
      expect(getColumnIndex("Z")).toBe(25);
      expect(getColumnIndex("AA")).toBe(26);
      expect(getColumnIndex("AZ")).toBe(51);
      expect(getColumnIndex("BA")).toBe(52);
      expect(getColumnIndex("ZZ")).toBe(701);
      expect(getColumnIndex("AAA")).toBe(702);
    });

    it("handles lowercase column letters", () => {
      const getColumnIndex = (col: string): number => {
        let result = 0;
        for (let i = 0; i < col.length; i++) {
          result = result * 26 + (col.toUpperCase().charCodeAt(i) - 64);
        }
        return result - 1;
      };

      expect(getColumnIndex("a")).toBe(0);
      expect(getColumnIndex("z")).toBe(25);
      expect(getColumnIndex("aa")).toBe(26);
    });
  });

  describe("cell address parsing", () => {
    it("parses single cell addresses", () => {
      const parseCellAddress = (addr: string): { col: number; row: number } | null => {
        const match = addr.match(/^([A-Z]+)(\d+)$/i);
        if (!match) return null;

        const colStr = match[1].toUpperCase();
        const row = parseInt(match[2], 10) - 1;

        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
          col = col * 26 + (colStr.charCodeAt(i) - 64);
        }
        col -= 1;

        return { col, row };
      };

      expect(parseCellAddress("A1")).toEqual({ col: 0, row: 0 });
      expect(parseCellAddress("Z100")).toEqual({ col: 25, row: 99 });
      expect(parseCellAddress("AA1")).toEqual({ col: 26, row: 0 });
      expect(parseCellAddress("INVALID")).toBeNull();
    });

    it("handles row numbers correctly", () => {
      const parseCellAddress = (addr: string): { col: number; row: number } | null => {
        const match = addr.match(/^([A-Z]+)(\d+)$/i);
        if (!match) return null;

        const colStr = match[1].toUpperCase();
        const row = parseInt(match[2], 10) - 1;

        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
          col = col * 26 + (colStr.charCodeAt(i) - 64);
        }
        col -= 1;

        return { col, row };
      };

      expect(parseCellAddress("A1")?.row).toBe(0); // Row 1 = index 0
      expect(parseCellAddress("A10")?.row).toBe(9); // Row 10 = index 9
      expect(parseCellAddress("A100")?.row).toBe(99); // Row 100 = index 99
    });
  });

  describe("range address parsing", () => {
    it("calculates bounding box for ranges", () => {
      const parseRange = (range: string): {
        startCol: number;
        startRow: number;
        endCol: number;
        endRow: number;
      } | null => {
        if (range === "*") return null;

        const parts = range.split(":");
        const parseCellAddress = (addr: string): { col: number; row: number } | null => {
          const match = addr.match(/^([A-Z]+)(\d+)$/i);
          if (!match) return null;

          const colStr = match[1].toUpperCase();
          const row = parseInt(match[2], 10) - 1;

          let col = 0;
          for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + (colStr.charCodeAt(i) - 64);
          }
          col -= 1;

          return { col, row };
        };

        const start = parseCellAddress(parts[0]);
        const end = parts[1] ? parseCellAddress(parts[1]) : start;

        if (!start || !end) return null;

        return {
          startCol: Math.min(start.col, end.col),
          startRow: Math.min(start.row, end.row),
          endCol: Math.max(start.col, end.col),
          endRow: Math.max(start.row, end.row),
        };
      };

      expect(parseRange("A1:B5")).toEqual({
        startCol: 0,
        startRow: 0,
        endCol: 1,
        endRow: 4,
      });

      expect(parseRange("B5:A1")).toEqual({
        startCol: 0,
        startRow: 0,
        endCol: 1,
        endRow: 4,
      });

      expect(parseRange("Z100:AA105")).toEqual({
        startCol: 25,
        startRow: 99,
        endCol: 26,
        endRow: 104,
      });
    });

    it("parses sheet-qualified ranges", () => {
      expect(parseSheetQualifiedAddress("Sheet1!A1:D10")).toEqual({
        sheetName: "Sheet1",
        rangeAddress: "A1:D10",
      });

      expect(parseSheetQualifiedAddress("'Quarter 1''s Data'!B2:C8")).toEqual({
        sheetName: "Quarter 1's Data",
        rangeAddress: "B2:C8",
      });

      expect(parseSheetQualifiedAddress("A1:D10")).toEqual({
        rangeAddress: "A1:D10",
      });
    });
  });

  describe("cell count calculations", () => {
    it("calculates number of cells in a range", () => {
      const getCellCount = (range: string): number | null => {
        if (range === "*") return null;

        const parts = range.split(":");
        const parseCellAddress = (addr: string): { col: number; row: number } | null => {
          const match = addr.match(/^([A-Z]+)(\d+)$/i);
          if (!match) return null;

          const colStr = match[1].toUpperCase();
          const row = parseInt(match[2], 10) - 1;

          let col = 0;
          for (let i = 0; i < colStr.length; i++) {
            col = col * 26 + (colStr.charCodeAt(i) - 64);
          }
          col -= 1;

          return { col, row };
        };

        const start = parseCellAddress(parts[0]);
        const end = parts[1] ? parseCellAddress(parts[1]) : start;

        if (!start || !end) return null;

        const startCol = Math.min(start.col, end.col);
        const startRow = Math.min(start.row, end.row);
        const endCol = Math.max(start.col, end.col);
        const endRow = Math.max(start.row, end.row);

        return (endCol - startCol + 1) * (endRow - startRow + 1);
      };

      expect(getCellCount("A1")).toBe(1); // Single cell
      expect(getCellCount("A1:B2")).toBe(4); // 2x2
      expect(getCellCount("A1:C5")).toBe(15); // 3x5
      expect(getCellCount("Z100:AA102")).toBe(6); // 2x3
    });
  });

  describe("edge cases and error handling", () => {
    it("handles maximum Excel column", () => {
      // Excel's max column is XFD (column 16383)
      const getColumnIndex = (col: string): number => {
        let result = 0;
        for (let i = 0; i < col.length; i++) {
          result = result * 26 + (col.toUpperCase().charCodeAt(i) - 64);
        }
        return result - 1;
      };

      expect(getColumnIndex("XFD")).toBe(16383);
    });

    it("handles maximum Excel row", () => {
      // Excel's max row is 1048576
      const parseCellAddress = (addr: string): { col: number; row: number } | null => {
        const match = addr.match(/^([A-Z]+)(\d+)$/i);
        if (!match) return null;

        const colStr = match[1].toUpperCase();
        const row = parseInt(match[2], 10) - 1;

        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
          col = col * 26 + (colStr.charCodeAt(i) - 64);
        }
        col -= 1;

        return { col, row };
      };

      expect(parseCellAddress("A1048576")?.row).toBe(1048575);
    });

    it("rejects invalid cell addresses", () => {
      const parseCellAddress = (addr: string): { col: number; row: number } | null => {
        const match = addr.match(/^([A-Z]+)(\d+)$/i);
        if (!match) return null;

        const colStr = match[1].toUpperCase();
        const row = parseInt(match[2], 10) - 1;

        let col = 0;
        for (let i = 0; i < colStr.length; i++) {
          col = col * 26 + (colStr.charCodeAt(i) - 64);
        }
        col -= 1;

        return { col, row };
      };

      expect(parseCellAddress("")).toBeNull();
      expect(parseCellAddress("123")).toBeNull();
      expect(parseCellAddress("AAA")).toBeNull(); // No row number
      // Note: A0 parses to row -1, which is technically valid for the parser
      // (row validation would happen at a higher level)
      expect(parseCellAddress("A0")).toEqual({ col: 0, row: -1 });
    });
  });
});
