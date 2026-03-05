import { describe, expect, it } from "vitest";
import { toolError, toolSuccess, toolText } from "../src/lib/tools/types";

describe("toolSuccess", () => {
  it("wraps a primitive in a result object", () => {
    const result = toolSuccess(42);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ result: 42 });
    expect(result.details).toBeUndefined();
  });

  it("wraps a string primitive", () => {
    const result = toolSuccess("hello");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ result: "hello" });
  });

  it("wraps null in a result object", () => {
    const result = toolSuccess(null);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ result: null });
  });

  it("spreads an object directly into content", () => {
    const result = toolSuccess({ foo: 1, bar: "baz" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ foo: 1, bar: "baz" });
  });

  it("returns content as a single text block", () => {
    const result = toolSuccess({ x: 1 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });
});

describe("toolError", () => {
  it("produces success:false with the error message", () => {
    const result = toolError("something went wrong");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({ success: false, error: "something went wrong" });
    expect(result.details).toBeUndefined();
  });

  it("returns content as a single text block", () => {
    const result = toolError("oops");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });
});

describe("toolText", () => {
  it("returns raw text without JSON wrapping", () => {
    const result = toolText("plain text response");
    expect(result.content[0].text).toBe("plain text response");
    expect(result.details).toBeUndefined();
  });

  it("returns content as a single text block", () => {
    const result = toolText("abc");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });
});
