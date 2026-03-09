# Manual Validation Prompt Pack

**Purpose:** Companion guide for `MANUAL-VALIDATION-CHECKLIST.md`.

Use this document while running the Excel Desktop validation worksheet. For every phase below:
- Execute the listed setup and prompts in order.
- Record timings in the worksheet.
- If anything breaks, add a defect entry immediately.
- Use the severity rules from the worksheet, not gut feel.

---

## How To Use This Pack

For each phase:
1. Run the setup exactly as written.
2. Send the prompt or complete the interaction.
3. Record the result in the matching worksheet phase.
4. If behavior is wrong, log `expected`, `actual`, `repro`, and `suspected area`.
5. Mark the phase `PASS`, `PASS WITH ISSUES`, `FAIL`, or `BLOCKED`.

**Evidence to capture where possible:**
- rough time in seconds
- visible UI state
- workbook result
- whether recovery was possible without restarting Excel

---

## Phase 1: Cold Open

**Worksheet section:** Phase 1: Cold Open

**Setup:**
1. Close Excel Desktop completely.
2. Open a blank workbook.
3. Open the taskpane.
4. Start timing from taskpane open.

**Actions:**
- Observe first paint.
- Click into the input.
- Open settings.
- Open provider dropdown.
- Confirm current session label.

**Record:**
- time to first paint
- time to interactive
- whether settings renders completely
- whether provider list is immediately available

**Blockers:**
- blank screen
- taskpane never becomes interactive
- settings fails to open
- input unusable after open

---

## Phase 2: First Prompt Send

**Worksheet section:** Phase 2: First Prompt Send

### Prompt A: Simple response
```text
What is 2 + 2?
```

### Prompt B: Workbook metadata read
```text
List all sheets in this workbook and tell me which one is active.
```

### Prompt C: Light workbook write
```text
Create a new sheet called Test Sheet and write Hello World into cell A1.
```

**Record:**
- time to send acknowledged
- time to first token
- time to completion
- whether progress state is visible
- whether written workbook changes are correct

**Blockers:**
- send does nothing
- stream never starts
- response completes incorrectly
- workbook write claims success but workbook is wrong

---

## Phase 3: Plan / Live Mode Transitions

**Worksheet section:** Phase 3: Plan/Live Mode Transitions

### Prompt A: Plan preview
```text
In Plan mode, create a summary table in cells A1:D5 with sample monthly sales data and totals.
```

### Prompt B: Live apply
Use the exact same prompt in Live mode.

### Prompt C: Toggle safety
```text
In Plan mode, calculate the sum of values in column A and explain the workbook changes you would make.
```
Repeat after switching to Live mode, then back to Plan.

**Record:**
- whether Plan mode prevents mutation
- whether Live mode applies mutation correctly
- whether the banner/state changes immediately
- whether toggling creates stale or mixed state

**Blockers:**
- Plan mode mutates workbook
- Live mode silently does nothing
- mode banner lies about actual behavior
- switching modes corrupts state

---

## Phase 4: Session Restore and Switching

**Worksheet section:** Phase 4: Session Restore and Switching

### Prompt A: Create session history
```text
Create a sheet called Session Test with columns Name and Age, then add Alice 30 and Bob 25.
```

### Prompt B: Continue context
```text
Now calculate the average age and add a total row below the data.
```

### Prompt C: New session sanity check
```text
What sheets exist in this workbook?
```

**Actions:**
1. Create the first session history.
2. Close Excel completely.
3. Reopen Excel and taskpane.
4. Verify the original session restores.
5. Create a new chat and send Prompt C.
6. Switch back to the original session.
7. Delete the temporary session.

**Record:**
- whether history restores correctly
- whether the restored session remains usable
- whether switching sessions loads the correct message history
- whether delete updates UI and storage cleanly

**Blockers:**
- previous session missing
- messages incomplete or mismatched
- switching sessions mixes contexts
- delete leaves broken UI state

---

## Phase 5: Upload and Replace Flows

**Worksheet section:** Phase 5: Upload and Replace Flows

**Setup:**
- Prepare a small text file and a second version with the same filename but different contents.
- Prepare a second file of a different type if available.

**Actions:**
1. Drag the first file into the taskpane.
2. Upload a second file.
3. Replace the original filename with the updated version.

### Prompt A: Uploaded file summary
```text
Read the uploaded file and summarize its contents.
```

### Prompt B: Compare replacement
```text
Tell me what changed in the replaced file and confirm which version is now available.
```

**Record:**
- whether overlay appears correctly
- whether upload ordering is stable
- whether quota/accounting updates correctly
- whether replaced content is actually the active content

**Blockers:**
- upload hangs or disappears
- wrong file content is referenced after replacement
- quota or file chips become inconsistent
- app becomes unable to send after upload

---

## Phase 6: VFS Restore

**Worksheet section:** Phase 6: VFS Restore

### Prompt A: Create file in VFS
```text
In bash, create a file named test.txt with the text Hello from bash.
```

### Prompt B: Confirm file content
```text
Read the contents of test.txt from the VFS.
```

### Prompt C: Verify after restore
```text
What files exist in the VFS right now?
```

**Actions:**
1. Run Prompt A and B.
2. Close Excel completely.
3. Reopen Excel and taskpane.
4. Run Prompt C.

**Record:**
- whether file survives session restore
- whether VFS-backed files are still accessible
- whether bash/file tools can see the same file state

**Blockers:**
- VFS file disappears after restore
- file exists in UI but not tools, or vice versa
- VFS restore breaks session usability

---

## Phase 7: Long-Running Tools and Abort

**Worksheet section:** Phase 7: Long-Running Tools and Abort

### Prompt A: Long workbook task
```text
Read all cells from A1 to Z1000 and create a short summary of what you find.
```

### Prompt B: Long stream
```text
Tell me a very long story about Excel spreadsheets and continue until I stop you.
```

### Prompt C: Multiple actions
```text
Create 5 sheets named Sheet1 through Sheet5 and place different sample data in each one.
```

**Actions:**
1. Start Prompt A and observe progress.
2. Start Prompt B and click stop during streaming.
3. Start Prompt C and confirm ordering.

**Record:**
- whether progress state is visible
- whether abort actually stops work
- whether new prompts are possible immediately after abort
- whether partial output is sensible

**Blockers:**
- stop button does nothing
- app remains stuck after abort
- tool execution order breaks workbook state
- abort requires reload or restart to recover

---

## Phase 8: Provider and Auth Edge Cases

**Worksheet section:** Phase 8: Provider and Auth Edge Cases

**Actions:**
1. Enter an invalid API key.
2. Send a simple prompt.
3. Correct the key.
4. Retry.
5. Switch provider.
6. Switch model.
7. Retry a simple prompt.

### Prompt A: Auth failure check
```text
Say hello in one sentence.
```

### Prompt B: Post-recovery check
```text
Confirm you are responding normally after the credential update.
```

**Record:**
- whether invalid credentials produce a useful error
- whether recovery works without app restart
- whether provider/model switching leaves stale config behind

**Blockers:**
- auth failure crashes or wedges app
- valid credentials cannot recover the app
- provider switch breaks send flow

---

## Phase 9: Complex Workbook Tool Behavior

**Worksheet section:** Phase 9: Complex Workbook Tool Behavior

**Setup:**
- Open a larger workbook if available.

### Prompt A: Large read
```text
Read all data from the active sheet and summarize the structure, row count, and likely purpose.
```

### Prompt B: Multi-sheet operation
```text
Copy all data from Sheet1 to a new sheet named Copy and tell me exactly what changed.
```

### Prompt C: Dirty tracking
```text
Modify cells A1:C5 with sample values and tell me which ranges were changed.
```

**Record:**
- whether UI remains responsive
- whether workbook changes are correct
- whether dirty tracking/navigation works as expected
- whether large operations degrade usability

**Blockers:**
- wrong sheet modified
- silent workbook corruption
- navigation to changed ranges broken
- UI freezes hard during normal-scale operations

---

## Phase 10: Stream Stall Recovery

**Worksheet section:** Phase 10: Stream Stall Recovery

### Prompt A: Normal stream
```text
Count from 1 to 100.
```

### Prompt B: Potential stall trigger
```text
Perform a complex calculation across all sheets and give me detailed reasoning and results.
```

**Record:**
- whether normal stream completes and finalizes
- whether stall handling activates when needed
- whether fallback completion is sensible
- whether the next request works normally afterward

**Blockers:**
- stalled response never completes and cannot be recovered
- fallback marks incorrect state
- send flow remains broken after stall

---

## Phase 11: Settings Edit and Reset

**Worksheet section:** Phase 11: Settings Edit and Reset

**Actions:**
1. Change provider.
2. Change model.
3. Reload or reopen the taskpane.
4. Confirm persistence.
5. Reset to defaults.
6. Confirm clean default state.

### Prompt A: Post-settings confirmation
```text
Confirm the current provider and respond with one short sentence.
```

**Record:**
- whether settings persist correctly
- whether reset is immediate and complete
- whether diagnostics/settings data is understandable

**Blockers:**
- settings appear saved but reload incorrectly
- reset leaves stale hidden state
- user cannot send after settings edit

---

## Accessibility and UX Sweep

**Worksheet section:** Accessibility and UX Sweep

**Checks:**
- Use keyboard only for one full send flow.
- Tab through top-level controls and settings.
- Confirm focus visibility on icon buttons and menus.
- Confirm loading and error states are understandable without guessing.
- Walk onboarding and make sure there is no accidental exit behavior.

**Record:**
- controls that are unreachable by keyboard
- controls with poor focus visibility
- unclear error copy or invisible progress

**Blockers:**
- core chat flow cannot be completed keyboard-only
- focus is lost with no recovery path
- status/error states are invisible or misleading

---

## Performance Capture Guidance

Use the worksheet’s performance table. At minimum capture:
- taskpane first paint
- taskpane interactive
- settings open
- send acknowledged
- first token
- first bash workflow start
- first file workflow start
- first PDF workflow start if tested

If a timing misses target, note whether the delay was:
- network/provider latency
- lazy-load cost
- Excel host lag
- UI/render lag
- unknown

---

## Defect Logging Guidance

When something fails, log it immediately in the worksheet defect log using this format:
- `Summary`: one sentence
- `Repro Steps`: exact actions and prompt used
- `Expected`: what should have happened
- `Actual`: what happened instead
- `Suspected File/Area`: best guess, not certainty
- `Severity`: `P1` / `P2` / `P3` / `P4`

Example:

```text
Summary: Upload replacement kept the old file contents in chat context.
Repro Steps: Upload notes.txt, replace notes.txt with edited version, run Phase 5 Prompt B.
Expected: Summary should reflect the new file contents.
Actual: Assistant referenced the original file contents.
Suspected File/Area: upload replacement / VFS sync / chat context uploads.
Severity: P2
```

---

## Go / No-Go Rules

Default to `NO-GO` if any of the following happen during testing:
- any `P1` defect
- any data corruption
- any workflow that requires restarting Excel to recover
- broken session restore
- broken send flow after a normal user action

Default to `GO WITH FOLLOW-UPS` only if:
- there are no `P1` or `P2` defects
- all critical phases pass
- remaining issues are `P3` or `P4` only

