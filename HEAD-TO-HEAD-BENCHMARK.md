# Head-to-Head Excel AI Benchmark

Date: 2026-03-05

## Purpose

Run the same Excel tasks in Zano Sheets and Claude for Excel and score both on:
- Speed
- Correctness
- Robustness
- User friction

Use this protocol to compare product quality, not raw model IQ in isolation.

## Environment Rules

- Use the same workbook and data for both tools.
- Use the same model class where possible (for example, Claude Sonnet vs Claude Sonnet).
- Run each task 3 times and keep median values.
- Clear chat/session state between runs.
- Disable unrelated background apps.

## Timing Metrics

1. Time to first useful response (seconds)
2. Time to completed task (seconds)
3. Number of retries or reformulations
4. Number of manual corrections required

## Quality Metrics (0-5 each)

1. Correctness: final output matches expected result
2. Robustness: handles edge cases without failure
3. Explainability: solution is understandable and auditable
4. Excel-native quality: formulas, references, and formatting are production grade

## Core Task Suite

1. Large-range read and summarize
- Prompt: Summarize top 10 expense variances by month from range A1:AZ5000.
- Expected: Correct ranking, clear summary, no hangs.

2. Formula build and fill
- Prompt: Create dynamic variance formulas for all rows in C2:C2000 and format negatives red.
- Expected: Correct formulas, relative references, style applied correctly.

3. Multi-sheet reconciliation
- Prompt: Reconcile totals across Sheet1, Sheet2, and Sheet3 and list mismatches in a new sheet.
- Expected: New sheet with mismatch rows and reason columns.

4. Structural workbook changes
- Prompt: Insert a review sheet, add index links to all sheets, and freeze header rows.
- Expected: Correct sheet creation, links, and freeze behavior.

5. Error recovery stress test
- Prompt: Intentionally target a merged range edit and then recover with a valid operation.
- Expected: Helpful error handling, successful recovery path.

6. Long-session stability
- Procedure: 40+ turns including reads/writes/charts and object modifications.
- Expected: No major UI lag, no state corruption, no lost context.

## Scoring Formula

Total score out of 100:
- Speed: 25
- Correctness: 35
- Robustness: 25
- User friction: 15

Suggested conversion:
- Speed score = normalized from median completion time and retries.
- User friction score = 15 - (manual corrections + avoidable retries), min 0.

## Current Zano Baseline (This Repo)

Measured with `pnpm perf:dev-server` on 2026-03-05:
- taskpane.html: avg 94.82 ms, p95 614.94 ms, max 871.00 ms (20 reqs)
- commands.html: avg 3.04 ms, p95 3.51 ms, max 4.65 ms (20 reqs)

Quality gates currently passing:
- `pnpm build`
- `pnpm check`

## Run Steps

1. Start dev server for Zano Sheets.
2. Execute the 6-task suite above in Zano Sheets and record in CSV template.
3. Repeat the same suite in Claude for Excel.
4. Compare median timings and quality scores.
5. Keep evidence screenshots for contested results.

## Interpretation

- If Zano wins on speed/robustness with similar correctness, it is operationally stronger for heavy Excel workflows.
- If Claude wins on correctness but loses on workflow control, the right strategy is better prompt/skill templates in Zano.
- Benchmark should be rerun after major tool or model updates.
