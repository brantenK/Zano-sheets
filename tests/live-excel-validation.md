# Live Excel Validation

This is a manual validation flow for taskpane prompts where the workbook result is checked against the live Excel desktop session through xlwings.

## Flow

1. Open the sideloaded add-in in Excel Desktop.
2. Create or clear a worksheet named `Audit Test`.
3. Paste the seed data for the scenario.
4. Run the prompt in the taskpane exactly as written.
5. Tell Copilot when the run is complete.
6. Copilot verifies the workbook state through xlwings.

## Scenario A: Visible Data Summary

### Seed data

Paste this into `Audit Test!A1:D6`:

```text
Month,Department,Budget,Actual
Jan,Marketing,1000,1400
Jan,Sales,1200,1100
Feb,Marketing,1000,900
Feb,Sales,1200,1800
Mar,Ops,900,900
```

Then hide row 3 so the `Jan,Sales` record is not visible.

### Prompt

```text
Read the visible rows from Audit Test!A1:D6 only. Create a variance summary table starting in F1 with headers Month, Department, Variance, where Variance is Actual minus Budget. Include only visible rows, preserve the original row order, and then add a one-sentence summary in J1 describing the largest positive visible variance.
```

### Expected outcome

- `F1:H1` contains `Month`, `Department`, `Variance`.
- `F2:H5` contains only visible rows.
- The hidden `Jan,Sales` row does not appear in the summary.
- `J1` mentions `Feb Sales` with variance `600` as the largest positive visible variance.

## Scenario B: Write Completes Cleanly

### Seed data

Paste this into `Audit Test!A1:B5`:

```text
Category,Amount
Travel,1250
Software,2200
Meals,315
Supplies,480
```

### Prompt

```text
On the Audit Test sheet, create a summary block in D1:E6. Put headers Metric and Value in D1:E1. Then write Total in D2 with the sum of Amount, Average in D3 with the average of Amount, Max in D4 with the maximum of Amount, Min in D5 with the minimum of Amount, and Count in D6 with the number of data rows. Format E2:E6 as numbers with no decimal places.
```

### Expected outcome

- `D1:E6` is populated with the requested summary block.
- Values should be `4245`, `1061`, `2200`, `315`, `4`.
- The taskpane should return to a non-streaming state after the write completes.

## xlwings Verification

Use `scripts/live_excel_probe.py` to inspect the active workbook or a specific range after the prompt runs.

Examples:

```powershell
python scripts/live_excel_probe.py --sheet "Audit Test" --range "F1:J5"
python scripts/live_excel_probe.py --sheet "Audit Test" --range "D1:E6"
```