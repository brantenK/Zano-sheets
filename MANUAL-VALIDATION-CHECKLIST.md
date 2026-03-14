# Manual Validation Worksheet

**Purpose:** Produce decision-grade validation evidence for Excel Desktop before calling the app top tier.

**Date:** ____________________
**Tester:** ____________________
**Build/Commit:** ____________________
**Environment:** Excel Desktop / Windows / Add-in sideloaded
**Workbook Used:** ____________________
**Provider Used:** ____________________

---

## Test Rules

- Mark every phase as `PASS`, `PASS WITH ISSUES`, `FAIL`, or `BLOCKED`.
- For every issue, add an entry in the defect log at the bottom.
- Use severity levels consistently:
  - `P1` Critical: data loss, app crash, unrecoverable state, Excel restart required
  - `P2` High: major workflow broken, recovery unclear, incorrect workbook behavior
  - `P3` Medium: degraded UX, performance issue, misleading messaging, workaround exists
  - `P4` Low: minor polish issue, copy issue, non-blocking visual defect
- Do not mark the worksheet complete unless all timing fields and sign-off fields are filled in.

## RC Critical Path Matrix (Fast Go/No-Go)

Complete this matrix first on every release candidate before running the full worksheet.

| ID | Flow | Pass Criteria | Result | Notes |
|----|------|---------------|--------|-------|
| RC-01 | Cold open | Taskpane paints and is interactive without reload | | |
| RC-02 | First send | Prompt streams and completes with no stuck state | | |
| RC-03 | Excel write | A mutating request updates expected cells only | | |
| RC-04 | Abort | Abort during stream returns app to send-ready state | | |
| RC-05 | Session restore | Reopen Excel and previous session loads correctly | | |
| RC-06 | Upload + prompt | Uploaded file can be used in a successful prompt | | |
| RC-07 | Provider error recovery | Invalid key/token shows actionable error and recovers after fix | | |
| RC-08 | Tool approval safety | Destructive tool requires/obeys approval mode | | |

**RC Decision Rule:**
- Any `FAIL` in RC-01 to RC-05 => `NO-GO`
- Up to one `FAIL` in RC-06 to RC-08 allowed only with documented workaround and explicit approval

---

## Environment Capture

| Field | Value |
|------|-------|
| Date | |
| Tester | |
| Excel version | |
| Windows version | |
| Add-in build/commit | |
| Manifest used | |
| Workbook name | |
| Provider | |
| Model | |
| Network notes | |

---

## Pre-Test Setup

- [ ] Clear localStorage for the add-in
- [ ] Clear IndexedDB for the add-in
- [ ] Close Excel Desktop completely
- [ ] Reopen Excel Desktop with a blank workbook
- [ ] Confirm latest build is loaded
- [ ] Confirm provider credentials are ready
- [ ] Confirm a test file is available for upload
- [ ] Confirm a larger workbook is available for workbook stress tests

---

## Phase 1: Cold Open

**Owner area:** app shell, startup, settings entry

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Taskpane first paint | Shell appears quickly, no blank screen hang | | | |
| Taskpane interactive | Buttons clickable, input focus works | | | |
| Settings open | Loads within target and renders fully | | | |
| Provider list | Built-in providers visible immediately | | | |
| Session indicator | Shows new or restored session correctly | | | |

**Phase Status:** ____________________
**Time to first paint:** ____________________
**Time to interactive:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 2: First Prompt Send

**Owner area:** provider config, send flow, streaming, message rendering

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Type in input | Text entry is immediate, no lag | | | |
| Click send | Send/loading state is visible | | | |
| First token | Stream starts in acceptable time | | | |
| Progress feedback | Streaming state is obvious | | | |
| Completion | Final message renders correctly | | | |

**Phase Status:** ____________________
**Time to send acknowledged:** ____________________
**Time to first token:** ____________________
**Time to completion:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 3: Plan/Live Mode Transitions

**Owner area:** mode switching, preview/apply safety, Excel mutation guardrails

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Switch to Plan mode | Plan warning is visible and correct | | | |
| Mutating prompt in Plan | Preview shown, no workbook change | | | |
| Preview quality | Proposed changes are readable and specific | | | |
| Switch to Live mode | Apply banner is visible and correct | | | |
| Mutating prompt in Live | Workbook updates correctly | | | |
| Toggle back and forth | No corruption or stale mode state | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 4: Session Restore and Switching

**Owner area:** persistence, session lifecycle, message restore, safe switching

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Create session history | Messages persist during active use | | | |
| Close and reopen Excel | Previous session restores correctly | | | |
| Message history render | History is complete and readable | | | |
| Session context | Prior context remains usable | | | |
| New session | Starts cleanly | | | |
| Switch between sessions | Correct history loads every time | | | |
| Switch during activity | Gracefully blocked or safely handled | | | |
| Delete session | Session removed and UI updates correctly | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 5: Upload and Replace Flows

**Owner area:** drag/drop, uploads, quota, replacement behavior, file context

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Drag into taskpane | Drop overlay appears correctly | | | |
| Single upload | File processes and appears in UI | | | |
| Multi-file upload | Files process in stable order | | | |
| Upload quota | Usage display is accurate | | | |
| Same filename upload | Replace flow is clear and correct | | | |
| Replacement accounting | Old bytes released, new counted | | | |
| File summarization prompt | Uploaded file is actually usable in context | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 6: VFS Restore

**Owner area:** VFS persistence, restore, bash/file availability

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Save VFS state in session | Files persist with session | | | |
| Restore session | VFS files reload correctly | | | |
| Read restored files | Files can be accessed after restore | | | |
| Bash access | Restored files are available to shell workflows | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 7: Long-Running Tools and Abort

**Owner area:** tool execution, progress, cancellation, recovery

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Long-running tool start | Progress state is visible | | | |
| Tool sequencing | Multiple actions run in correct order | | | |
| Tool failure | Error is visible and state recovers | | | |
| Abort during stream | Stream halts cleanly | | | |
| Abort during tool | Cancellation is attempted and explained | | | |
| Post-abort recovery | New prompt can be sent immediately after | | | |
| Partial output | Partial output handling is sensible | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 8: Provider and Auth Edge Cases

**Owner area:** provider config, credential handling, auth refresh, model switching

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Invalid API key | Clear, actionable error | | | |
| Expired token | Refresh or recovery path is visible | | | |
| Provider switch | No state corruption | | | |
| Model switch | No stale or invalid config state | | | |
| Recovery after fix | User can retry successfully | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 9: Complex Workbook Tool Behavior

**Owner area:** Excel API integration, large-sheet handling, dirty tracking, navigation

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Large data read | UI remains responsive enough | | | |
| Multi-sheet operation | Correct target sheets affected | | | |
| Dirty range tracking | Changes tracked correctly | | | |
| Navigation | Range navigation works | | | |
| Workbook integrity | No unexpected data corruption | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 10: Stream Stall Recovery

**Owner area:** streaming fallback, completion logic, retry readiness

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Normal stream | Completes normally | | | |
| Stall threshold | Timeout/fallback triggers when expected | | | |
| Fallback completion | Message finalizes correctly | | | |
| Continue after stall | New requests still work | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Phase 11: Settings Edit and Reset

**Owner area:** provider settings, persistence, defaults, diagnostics usability

| Step | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Change provider | Saves and persists | | | |
| Change model | Saves and persists | | | |
| Reset to defaults | Values return to default cleanly | | | |
| Reload after save | Settings restore correctly | | | |
| Diagnostics clarity | Useful information available without confusion | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Accessibility and UX Sweep

**Owner area:** keyboard navigation, focus, visible state, messaging clarity

| Check | Expected Result | Actual Result | Pass/Fail | Notes |
|------|----------------|---------------|-----------|-------|
| Keyboard-only navigation | Main flows are usable without mouse | | | |
| Focus visibility | Focus ring/state is visible on controls | | | |
| Live status feedback | Streaming/loading states are understandable | | | |
| Error clarity | Error text tells user what to do next | | | |
| Onboarding clarity | New-user flow is understandable and reversible | | | |

**Phase Status:** ____________________
**Blocking issue IDs:** ____________________

---

## Performance Baseline

| Metric | Target | Actual | Result | Notes |
|--------|--------|--------|--------|-------|
| Taskpane first paint | < 2s | | | |
| Taskpane interactive | < 3s | | | |
| Settings open | < 2s | | | |
| First send acknowledged | < 1s | | | |
| First token | < 5s | | | |
| First streamed token after send | < 3s | | | |
| First bash workflow start | < 5s | | | |
| First file workflow start | < 5s | | | |
| First PDF workflow start | record actual | | | |

---

## Defect Log

| ID | Phase | Severity | Summary | Repro Steps | Expected | Actual | Suspected File/Area | Status |
|----|-------|----------|---------|-------------|----------|--------|---------------------|--------|
| D-01 | | | | | | | | |
| D-02 | | | | | | | | |
| D-03 | | | | | | | | |
| D-04 | | | | | | | | |
| D-05 | | | | | | | | |

---

## Phase Summary

| Phase | Status | Blocking Issue IDs | Owner | Follow-up Needed |
|------|--------|--------------------|-------|------------------|
| 1. Cold Open | | | | |
| 2. First Prompt Send | | | | |
| 3. Plan/Live | | | | |
| 4. Session Restore/Switch | | | | |
| 5. Upload/Replace | | | | |
| 6. VFS Restore | | | | |
| 7. Long-Running/Abort | | | | |
| 8. Provider/Auth | | | | |
| 9. Complex Workbook | | | | |
| 10. Stream Stall | | | | |
| 11. Settings Edit/Reset | | | | |
| UX/Accessibility Sweep | | | | |

---

## Go / No-Go Decision

**Total phases passed without blockers:** ____________________
**Any P1 issues found?** Yes / No
**Any P2 issues found?** Yes / No
**Excel restart ever required during testing?** Yes / No
**Data corruption observed?** Yes / No

**Decision:** `GO` / `NO-GO`

**Reasoning:**

```

```

---

## Sign-Off

| Role | Name | Decision | Date |
|------|------|----------|------|
| Tester | | | |
| Engineering Reviewer | | | |
| Product Reviewer | | | |

---

## Notes

```
General observations, UX feedback, edge cases, performance comments.
```
