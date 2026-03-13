import { beforeAll, describe, expect, it } from "vitest";
import {
  buildCsvFromVisibleRange,
  escapeCsvValue,
} from "../src/lib/excel/csv-utils";
import { withChunkHeartbeat } from "../src/lib/chat/stream-fallback";

let customCommandTestHelpers: {
  buildRangeAddress: (startCell: string, rowCount: number, colCount: number) => string;
  parseCsv: (input: string) => string[][];
};

beforeAll(async () => {
  (globalThis as typeof globalThis & { Excel: unknown }).Excel = {
    BorderLineStyle: {
      continuous: "continuous",
      dash: "dash",
      dot: "dot",
      double: "double",
    },
    BorderWeight: {
      thin: "thin",
      medium: "medium",
      thick: "thick",
    },
    BorderIndex: {
      edgeTop: "edgeTop",
      edgeBottom: "edgeBottom",
      edgeLeft: "edgeLeft",
      edgeRight: "edgeRight",
    },
  };

  const module = await import("../src/lib/vfs/custom-commands");
  customCommandTestHelpers = module.__test__;
});

describe("buildCsvFromVisibleRange", () => {
  it("skips hidden rows and columns", () => {
    const result = buildCsvFromVisibleRange(
      [
        ["Month", "Department", "Hidden", "Variance"],
        ["Jan", "Marketing", "ignore", -400],
        ["Feb", "Sales", "ignore", 200],
      ],
      {
        rowHidden: [[false], [false], [true]],
        columnHidden: [[false, false, true, false]],
      },
    );

    expect(result.csv).toBe(
      "Month,Department,Variance\nJan,Marketing,-400",
    );
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(3);
    expect(result.hasMore).toBe(false);
  });

  it("applies includeHeaders and maxRows after visibility filtering", () => {
    const result = buildCsvFromVisibleRange(
      [
        ["Header", "Value"],
        ["A", 1],
        ["B", 2],
        ["C", 3],
      ],
      {
        includeHeaders: false,
        maxRows: 2,
      },
    );

    expect(result.csv).toBe("A,1\nB,2");
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(2);
    expect(result.hasMore).toBe(true);
  });

  it("skips a hidden header row when headers are included", () => {
    const result = buildCsvFromVisibleRange(
      [
        ["Month", "Value"],
        ["Jan", 10],
        ["Feb", 20],
      ],
      {
        rowHidden: [[true], [false], [false]],
      },
    );

    expect(result.csv).toBe("Jan,10\nFeb,20");
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it("returns zero visible columns when every column is hidden", () => {
    const result = buildCsvFromVisibleRange(
      [
        ["Month", "Value"],
        ["Jan", 10],
      ],
      {
        columnHidden: [[true, true]],
      },
    );

    expect(result.csv).toBe("\n");
    expect(result.rowCount).toBe(2);
    expect(result.columnCount).toBe(0);
    expect(result.hasMore).toBe(false);
  });
});

describe("escapeCsvValue", () => {
  it("escapes commas, quotes, and newlines", () => {
    expect(escapeCsvValue('a,"b"\nc')).toBe('"a,""b""\nc"');
  });
});

describe("custom command helpers", () => {
  it("builds the expected Excel range address", () => {
    expect(customCommandTestHelpers.buildRangeAddress("B2", 3, 2)).toBe(
      "B2:C4",
    );
  });

  it("parses quoted CSV fields", () => {
    expect(
      customCommandTestHelpers.parseCsv('Month,Note\nJan,"a,b"'),
    ).toEqual([
      ["Month", "Note"],
      ["Jan", "a,b"],
    ]);
  });
});

describe("withChunkHeartbeat", () => {
  it("passes through events from a normal stream", async () => {
    async function* gen() {
      yield "a";
      yield "b";
      yield "c";
    }
    const wrapped = withChunkHeartbeat(gen(), 1000);
    const results: string[] = [];
    for await (const item of wrapped) {
      results.push(item);
    }
    expect(results).toEqual(["a", "b", "c"]);
  });

  it("throws on timeout when stream stalls", async () => {
    let cancelled = false;
    async function* stall() {
      try {
        yield "first";
        // Stall with a cancellable promise
        await new Promise((_, reject) => {
          const check = setInterval(() => {
            if (cancelled) {
              clearInterval(check);
              reject(new Error("cancelled"));
            }
          }, 10);
        });
      } finally {
        cancelled = true;
      }
    }
    const wrapped = withChunkHeartbeat(stall(), 50);
    const results: string[] = [];
    try {
      for await (const item of wrapped) {
        results.push(item);
      }
    } catch (err) {
      expect((err as Error).message).toMatch(/Stream stalled/);
    }
    cancelled = true;
    expect(results).toEqual(["first"]);
  });
});