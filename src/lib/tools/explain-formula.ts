import { Type } from "@sinclair/typebox";
import { getCellRanges } from "../excel/api";
import { checkToolApproval } from "../tool-approval";
import { defineTool, toolError, toolSuccess } from "./types";

/**
 * Excel function descriptions for common functions
 */
const FUNCTION_DESCRIPTIONS: Record<string, string> = {
  // Lookup & Reference
  VLOOKUP:
    "looks up a value in a table and returns a value from another column",
  HLOOKUP:
    "looks up a value in a table horizontally and returns a value from another row",
  INDEX: "returns a value from a specific position in a range",
  MATCH: "finds the position of a value in a range",
  XLOOKUP:
    "searches for a value and returns a corresponding value from another range",
  INDIRECT: "returns a reference specified by a text string",

  // Logical
  IF: "checks a condition and returns different values based on whether it's true or false",
  IFERROR:
    "returns a specified value if a formula results in an error, otherwise returns the formula result",
  AND: "checks if all conditions are true",
  OR: "checks if any condition is true",
  NOT: "reverses the logic of its argument",
  IFNA: "returns a specified value if the formula result is #N/A",

  // Text
  CONCATENATE: "joins multiple text strings into one",
  LEFT: "extracts a specified number of characters from the left side of a text string",
  RIGHT:
    "extracts a specified number of characters from the right side of a text string",
  MID: "extracts a specific number of characters from a text string, starting at a specified position",
  LEN: "counts the number of characters in a text string",
  FIND: "finds the position of one text string within another",
  SEARCH:
    "finds the position of one text string within another (case-insensitive)",
  SUBSTITUTE: "replaces existing text with new text in a text string",
  TRIM: "removes extra spaces from text",
  TEXT: "converts a value to text with a specified format",
  VALUE: "converts a text string that represents a number to a number",

  // Date & Time
  TODAY: "returns the current date",
  NOW: "returns the current date and time",
  DATE: "creates a date from year, month, and day values",
  TIME: "creates a time from hour, minute, and second values",
  DATEDIF: "calculates the difference between two dates in various units",
  EOMONTH:
    "returns the last day of the month, before or after a specified number of months",
  WORKDAY: "returns a date before or after a specified number of workdays",
  NETWORKDAYS: "calculates the number of workdays between two dates",

  // Math & Trigonometry
  SUM: "adds up all the numbers in a range",
  AVERAGE: "calculates the arithmetic mean of numbers in a range",
  COUNT: "counts how many cells contain numbers",
  COUNTA: "counts how many cells are not empty",
  COUNTIF: "counts cells that meet a specific condition",
  COUNTIFS: "counts cells that meet multiple conditions",
  SUMIF: "adds up values in cells that meet a specific condition",
  SUMIFS: "adds up values in cells that meet multiple conditions",
  ROUND: "rounds a number to a specified number of digits",
  ROUNDUP: "rounds a number up, away from zero",
  ROUNDDOWN: "rounds a number down, toward zero",
  INT: "rounds a number down to the nearest integer",
  MOD: "returns the remainder after division",
  ABS: "returns the absolute value of a number",
  POWER: "raises a number to a power",
  SQRT: "calculates the square root of a number",
  MIN: "finds the smallest number in a range",
  MAX: "finds the largest number in a range",
  MEDIAN: "calculates the median (middle value) of numbers in a range",
  MODE: "finds the most frequently occurring value",
  STDEV: "calculates the standard deviation (sample)",
  STDEVP: "calculates the standard deviation (population)",
  VAR: "calculates the variance (sample)",
  VARP: "calculates the variance (population)",

  // Financial
  PV: "calculates the present value of an investment or loan",
  FV: "calculates the future value of an investment",
  NPV: "calculates the net present value of an investment with periodic cash flows",
  IRR: "calculates the internal rate of return for a series of cash flows",
  PMT: "calculates the payment for a loan based on constant payments and interest",
  RATE: "calculates the interest rate per period for an annuity",

  // Statistical
  CORREL: "calculates the correlation coefficient between two data sets",
  FORECAST: "predicts a future value based on existing values",
  TREND: "returns values along a linear trend",
  GROWTH: "returns values along an exponential trend",

  // Database
  DSUM: "sums values in a column of a database that match conditions",
  DCOUNT: "counts values in a database that match conditions",
  DAVERAGE: "averages values in a database that match conditions",

  // Information
  ISBLANK: "checks if a cell is empty",
  ISERROR: "checks if a value is an error",
  ISNUMBER: "checks if a value is a number",
  ISTEXT: "checks if a value is text",
  ISLOGICAL: "checks if a value is a logical value (TRUE/FALSE)",
  NA: "returns the #N/A error value",

  // Pivot Table & Analysis
  GETPIVOTDATA: "retrieves data from a PivotTable report",
};

/**
 * Parse and analyze an Excel formula
 */
function analyzeFormula(formula: string): {
  functions: string[];
  references: string[];
  operators: string[];
  depth: number;
} {
  const functions: string[] = [];
  const references: string[] = [];
  const operators: string[] = [];

  // Extract function names
  const functionRegex = /([A-Z][A-Z0-9.]*)\(/g;
  let functionMatch: RegExpExecArray | null = functionRegex.exec(formula);
  while (functionMatch !== null) {
    functions.push(functionMatch[1]);
    functionMatch = functionRegex.exec(formula);
  }

  // Extract cell references (e.g., A1, B5, Sheet2!A1, A1:B10)
  const refRegex =
    /([A-Z][A-Z0-9]*(?:![A-Z][0-9]+:[A-Z][0-9]+|[A-Z][0-9]+)?)\b/g;
  let refMatch: RegExpExecArray | null = refRegex.exec(formula);
  while (refMatch !== null) {
    references.push(refMatch[1]);
    refMatch = refRegex.exec(formula);
  }

  // Extract operators
  const operatorRegex = /([+\-*/^&=<>]+)/g;
  let operatorMatch: RegExpExecArray | null = operatorRegex.exec(formula);
  while (operatorMatch !== null) {
    operators.push(operatorMatch[1]);
    operatorMatch = operatorRegex.exec(formula);
  }

  // Calculate nesting depth
  let depth = 0;
  let maxDepth = 0;
  for (const char of formula) {
    if (char === "(") {
      depth++;
      maxDepth = Math.max(maxDepth, depth);
    } else if (char === ")") {
      depth--;
    }
  }

  return {
    functions: [...new Set(functions)], // Remove duplicates
    references: [...new Set(references)],
    operators: [...new Set(operators)],
    depth: maxDepth,
  };
}

/**
 * Generate a plain English explanation of a formula
 */
function generateExplanation(
  _formula: string,
  analysis: ReturnType<typeof analyzeFormula>,
): string {
  const parts: string[] = [];

  // Start with a general description
  if (analysis.functions.length === 0) {
    parts.push("This is a simple calculation using basic operators.");
  } else if (analysis.functions.length === 1) {
    const fn = analysis.functions[0];
    const desc = FUNCTION_DESCRIPTIONS[fn] || "performs a calculation";
    parts.push(`This formula uses **${fn}**, which ${desc}.`);
  } else {
    parts.push(
      `This formula combines **${analysis.functions.length} different functions**.`,
    );
  }

  // Explain the main function(s)
  if (analysis.functions.length > 0) {
    const explainedFunctions: string[] = [];
    for (const fn of analysis.functions.slice(0, 3)) {
      // Limit to first 3 for brevity
      const desc = FUNCTION_DESCRIPTIONS[fn];
      if (desc) {
        explainedFunctions.push(`- **${fn}**: ${desc}`);
      }
    }
    if (explainedFunctions.length > 0) {
      parts.push("\n**Key functions used:**");
      parts.push(explainedFunctions.join("\n"));
    }
  }

  // Explain references
  if (analysis.references.length > 0) {
    const uniqueRefs = [...new Set(analysis.references)];
    if (uniqueRefs.length <= 5) {
      parts.push(
        `\nIt references ${uniqueRefs.length === 1 ? "cell" : "cells/ranges"}: ${uniqueRefs.join(", ")}`,
      );
    } else {
      parts.push(
        `\nIt references ${uniqueRefs.length} different cells/ranges.`,
      );
    }
  }

  // Explain complexity
  if (analysis.depth > 3) {
    parts.push(
      `\nThis is a **complex formula** with ${analysis.depth} levels of nested functions.`,
    );
  } else if (analysis.depth > 1) {
    parts.push(`\nThis formula has ${analysis.depth} level(s) of nesting.`);
  }

  return parts.join("\n");
}

export const explainFormulaTool = defineTool({
  name: "explain_formula",
  label: "Explain Formula",
  description:
    "Explains any Excel formula in plain English. " +
    "Breaks down what the formula does, what functions it uses, and what cells it references.",
  parameters: Type.Object({
    sheetId: Type.Number({
      description: "The worksheet ID (1-based index)",
    }),
    cell: Type.String({
      description: "The cell address containing the formula (e.g., 'A1', 'B5')",
    }),
  }),
  execute: async (_toolCallId, params) => {
    try {
      await checkToolApproval(_toolCallId, "explain_formula");

      // Get the cell data
      const result = await getCellRanges(params.sheetId, [params.cell]);

      if (!result || !result.worksheet) {
        return toolError(`Cell ${params.cell} not found or is empty.`);
      }

      const { cells, formulas } = result.worksheet;

      // Check if there's a formula
      const formula = formulas?.[params.cell];
      if (!formula || typeof formula !== "string" || !formula.startsWith("=")) {
        const value = cells?.[params.cell];
        return toolSuccess({
          explanation:
            `Cell ${params.cell} contains ` +
            (value === null || value === undefined
              ? "an empty cell"
              : `the value **${value}** (not a formula).`),
          cell: params.cell,
          hasFormula: false,
        });
      }

      // Analyze the formula
      const formulaText = formula.slice(1); // Remove the "=" prefix
      const analysis = analyzeFormula(formulaText);
      const explanation = generateExplanation(formulaText, analysis);

      return toolSuccess({
        explanation: `**Formula in ${params.cell}:**\n\`= ${formulaText}\`\n\n${explanation}`,
        cell: params.cell,
        hasFormula: true,
        analysis: {
          functions: analysis.functions,
          references: analysis.references,
          complexity:
            analysis.depth > 3
              ? "complex"
              : analysis.depth > 1
                ? "moderate"
                : "simple",
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error explaining formula";
      return toolError(`Failed to explain formula: ${message}`);
    }
  },
});
