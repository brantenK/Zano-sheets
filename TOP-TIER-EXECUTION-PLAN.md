# Top-Tier Execution Plan

**Date:** 2026-03-08
**Status:** Active
**Goal:** Move Zano Sheets from deployable to demonstrably top-tier through validation, profiling, reliability hardening, UX polish, and release discipline.

---

## Definition of "Top Tier"

The app is only top tier when all of the following are true:

- Core user journeys are manually validated in Excel Desktop with no critical failures.
- Build, typecheck, lint, tests, and manifest validation pass together on the same snapshot.
- Startup and first-use latency are measured and within agreed thresholds.
- Major failure modes are recoverable without forcing an Excel restart.
- UX, accessibility, and diagnostics are good enough that users can understand what the app is doing and recover from problems.
- High-risk paths have automated regression coverage.

---

## Exit Gates

Release this plan as complete only when every gate below is green:

| Gate | Requirement | Owner | Evidence |
|------|-------------|-------|----------|
| Build health | `build`, `typecheck`, `lint`, `test`, `validate` all pass | Engineering | CI or local run log |
| Excel manual validation | All critical workflows pass in Excel Desktop | Product + Engineering | Completed checklist |
| Perf baseline | Startup and first-use metrics captured and reviewed | Engineering | Baseline table |
| Reliability | No known P1 or P2 defects in auth, session, VFS, tool execution, or streaming | Engineering | Bug list cleared |
| Accessibility | Keyboard navigation, live feedback, visible focus, and error messaging verified | Engineering | Manual accessibility notes |
| Regression coverage | Critical paths covered by tests | Engineering | Test inventory |

---

## Workstreams

### 1. Manual Excel Validation

**Why this matters:** clean builds are not enough for an Office add-in. Real taskpane behavior in Excel Desktop is the quality bar.

**Owner:** Product + Engineering

**Primary files:**
- `MANUAL-VALIDATION-CHECKLIST.md`
- `MANUAL-TEST-PROMPTS.md`
- `src/taskpane/components/app.tsx`
- `src/taskpane/components/chat/chat-interface.tsx`
- `src/taskpane/components/chat/chat-context.tsx`
- `src/taskpane/components/chat/chat-input.tsx`
- `src/taskpane/components/chat/message-list.tsx`
- `src/taskpane/components/chat/settings-panel.tsx`

**Checklist:**
- Run cold open from a fresh Excel Desktop session.
- Run first prompt send against a real provider.
- Validate session create, switch, restore, and delete flows.
- Validate upload, replace, and VFS restore flows.
- Validate abort during streaming and tool execution.
- Validate provider switch, invalid key, and expired auth behavior.
- Validate complex workbook reads and writes on a non-trivial workbook.
- Validate stream stall recovery behavior.
- Validate settings persistence and reset behavior.

**Acceptance criteria:**
- No blank-screen or dead-input state after cold open.
- No workflow requires restarting Excel to recover.
- Session restore preserves messages and associated VFS state.
- Abort leaves the app in a reusable state within one interaction.
- Errors are visible, understandable, and recoverable.

---

### 2. Performance and First-Use Latency

**Why this matters:** startup is now good enough, but top-tier quality depends on what happens the first time users open settings, send a prompt, parse a PDF, or invoke tools.

**Owner:** Engineering

**Primary files:**
- `src/lib/perf-telemetry.ts`
- `src/lib/startup-telemetry.ts`
- `src/taskpane/index.tsx`
- `src/taskpane/components/app.tsx`
- `src/taskpane/components/chat/chat-context.tsx`
- `src/taskpane/components/chat/settings-panel.tsx`
- `src/lib/vfs/custom-commands.ts`
- `src/lib/tools/bash.ts`
- `vite.config.mts`

**Checklist:**
- Capture first-paint and interactive timings in Excel Desktop.
- Measure first settings open.
- Measure first prompt send to first token.
- Measure first bash invocation.
- Measure first file import, first PDF parse, and first doc conversion.
- Record deferred chunk load costs and correlate them to UX delays.

**Acceptance criteria:**
- Taskpane first paint under 2 seconds on a typical test machine.
- Taskpane interactive under 3 seconds.
- Settings open under 2 seconds.
- First token under 5 seconds on a normal provider/network path.
- Heavy feature activation shows progress feedback if it cannot meet the target.

**Known areas to investigate:**
- `ai`
- `bash-runtime`
- `pdfjs`
- `document-tools`
- workbook metadata and large-sheet reads

---

### 3. Runtime Architecture Refactor

**Why this matters:** a top-tier app is easier to debug and extend because ownership boundaries are clear.

**Owner:** Engineering

**Primary files:**
- `src/taskpane/components/chat/chat-context.tsx`
- `src/taskpane/components/chat/settings-panel.tsx`
- `src/lib/provider-config.ts`
- `src/lib/chat/provider-catalog.ts`
- `src/lib/skills/index.ts`
- `src/lib/storage/db.ts`

**Checklist:**
- Split chat runtime concerns into lifecycle, provider/auth, session persistence, uploads/VFS, and tool execution modules.
- Split settings concerns into provider selection, model selection, auth, web config, and diagnostics sections.
- Remove duplicated utility logic across chat rendering and runtime modules.
- Make lazy-loading boundaries explicit and document why they exist.

**Acceptance criteria:**
- No single UI/runtime module owns unrelated responsibilities.
- High-risk flows can be tested in isolation.
- New contributors can identify the correct module without tracing a giant file.

---

### 4. Reliability and Recovery Hardening

**Why this matters:** the app needs to recover from bad credentials, stalled streams, interrupted tools, and persistence issues without corrupting user state.

**Owner:** Engineering

**Primary files:**
- `src/taskpane/components/chat/chat-context.tsx`
- `src/lib/chat/stream-fallback.ts`
- `src/lib/oauth/index.ts`
- `src/lib/storage/db.ts`
- `src/lib/vfs/index.ts`
- `src/lib/tools/index.ts`
- `src/lib/tools/error-mapper.ts`

**Checklist:**
- Review all silent catches and decide whether to surface, log, or intentionally suppress.
- Add explicit recovery behavior for expired tokens and failed refresh.
- Audit VFS reset and restore behavior during in-flight work.
- Confirm session switches cannot corrupt active operations.
- Confirm fallback completion is correct after stream stalls.
- Confirm tool failures leave the UI and agent in a usable state.

**Acceptance criteria:**
- Expired credentials lead to a clear recovery path.
- VFS/session restore cannot silently lose uploaded context.
- Abort and retry behavior is deterministic.
- Failures produce actionable user-facing messages.

---

### 5. UX, Accessibility, and Diagnostics

**Why this matters:** top-tier quality is visible in small interactions, not just architecture.

**Owner:** Product + Engineering

**Primary files:**
- `src/taskpane/components/chat/chat-interface.tsx`
- `src/taskpane/components/chat/chat-input.tsx`
- `src/taskpane/components/chat/message-list.tsx`
- `src/taskpane/components/chat/onboarding-tour.tsx`
- `src/taskpane/components/toast/toast-context.tsx`
- `src/taskpane/index.css`

**Checklist:**
- Verify visible focus styles across all interactive controls.
- Verify full keyboard navigation for dropdowns, tabs, menus, and dialogs.
- Add clear progress language for long-running operations.
- Add consistent empty states, loading states, and error states.
- Audit onboarding for clarity and no accidental exits.
- Expose useful diagnostics in settings without overwhelming users.

**Acceptance criteria:**
- A keyboard-only user can operate the main chat flows.
- Loading and stalled states are visually obvious.
- Error messages tell the user what happened and what to do next.
- Onboarding and settings feel intentional, not incidental.

---

### 6. Test Coverage and Release Discipline

**Why this matters:** top-tier claims collapse quickly without regression protection.

**Owner:** Engineering

**Primary files:**
- `tests/chat-interface.test.ts`
- `tests/csv-utils.test.ts`
- `tests/model-resolution.test.ts`
- `tests/oauth.test.ts`
- `vitest.config.ts`
- `package.json`

**Checklist:**
- Add regression tests for session restore logic.
- Add tests for provider/model switching and config correction.
- Add tests for upload replacement and VFS synchronization.
- Add tests for auth refresh and expired credential handling.
- Add tests for stream fallback and abort behavior.
- Add a documented release checklist tied to current scripts.

**Acceptance criteria:**
- Critical runtime flows have direct test coverage.
- A broken recovery path is caught before release.
- The release bar is objective and repeatable.

---

## Priority Order

1. Manual validation in Excel Desktop
2. First-use performance profiling
3. Reliability and recovery hardening
4. Runtime module refactor
5. UX and accessibility polish
6. Test expansion and release discipline
7. Workflow specialization and enterprise features

---

## Immediate Next Sprint

### Sprint Goal

Prove the current app state in Excel Desktop and capture the evidence needed to decide what actually blocks top-tier quality.

### Tasks

| Task | Owner | Files | Acceptance Criteria |
|------|-------|-------|---------------------|
| Run full manual validation | Product + Engineering | `MANUAL-VALIDATION-CHECKLIST.md`, `MANUAL-TEST-PROMPTS.md` | All 11 phases completed with pass/fail notes |
| Capture baseline timings | Engineering | `src/lib/perf-telemetry.ts`, `src/lib/startup-telemetry.ts` | Timings recorded for startup and first-use flows |
| Triage failures into P1/P2/P3 | Engineering | `TOP-TIER-TRACKING.md` | Every failure categorized with owner and file target |
| Lock release criteria | Engineering | `package.json`, `TOP-TIER-TRACKING.md` | Objective release gate documented |

---

## Explicit Non-Goals For This Plan

These are valuable, but they do not define "top tier" for the current app state:

- Enterprise roles and backend-backed auth
- Skills marketplace
- Cloud sync
- CaseWare or TeamMate integrations
- New accounting workflows before baseline quality is proven

---

## Final Standard

If the app is fast on startup but confusing during failure, it is not top tier.
If the app is feature-rich but unvalidated in Excel Desktop, it is not top tier.
If the app is elegant in code but brittle in session/auth/VFS flows, it is not top tier.

Top tier means the app is fast enough, reliable enough, understandable enough, and tested enough that a serious user can trust it in live work.
