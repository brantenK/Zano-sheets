# Changelog

## [Unreleased]

## [0.2.6] - 2026-03-14

### Features

- **Accessibility foundation** - Added skip links, focus trap/restore helpers, stronger ARIA patterns, improved keyboard flows, and broad WCAG-focused UI updates across chat surfaces.
- **Privacy and trust UI** - Added a header trust badge and detailed privacy modal, plus expanded privacy/data guidance and provider policy links in settings.
- **Help system** - Added an in-app help panel, contextual tooltips, example prompt library, and issue reporter components for faster onboarding and troubleshooting.
- **Error UX** - Added user-friendly error explanation mappings and reusable error display components for clearer recovery paths.
- **Streaming feedback** - Added richer runtime feedback components for streaming state, tool progress, and timeout warnings.

### Improvements

- **Core stream reliability** - Hardened provider stream orchestration, retry/fallback behavior, and related chat runtime paths.
- **Tool execution resilience** - Improved internal execution and web tooling paths for safer, more predictable behavior under failures.
- **Onboarding boundary cleanup** - Extracted onboarding help UI from the lazy tour module to avoid static/dynamic import boundary issues.
- **Build chunking** - Updated chunk strategy for AI stream/provider modules to reduce circular chunk pressure and preserve dynamic boundaries.

### Fixes

- **Brave web search contract alignment** - Updated Brave search tests and expectations to the current proxy-required behavior, including encoded URL assertions and clearer proxy failure semantics.

### Tests

- Expanded automated coverage with new suites for accessibility, onboarding/help, user workflows, error explanations/display/handling, and performance.
- Updated Vitest config to include `.test.tsx` discovery and shared setup wiring.
- Added CI test workflow and helper scripts to standardize local/CI validation.

### Docs

- Added comprehensive implementation and validation documentation for accessibility, onboarding, privacy, help system, testing, and release verification.

## [0.2.5] - 2026-03-09

### Features

- **Formula explanation tool** — Added `explain_formula` so the agent can explain Excel formulas in plain English, including referenced cells, key functions, and complexity.
- **Onboarding flow** — Added a first-run onboarding tour to help users configure providers and understand the core chat workflow.
- **Runtime diagnostics** — Added startup, performance, and integration diagnostics in Settings, including copyable telemetry snapshots.

### Improvements

- **Startup performance** — Reduced initial taskpane work with broader lazy loading for chat surfaces, settings, markdown rendering, and onboarding.
- **Chat reliability** — Improved stream timeout handling, simplified tool execution flow, and added clearer recovery behavior for stalled or failed requests.
- **Provider/model loading** — Added cached provider catalogs and model resolution helpers for more robust provider switching and model validation.
- **Bash and VFS behavior** — Deferred bash runtime initialization, synchronized shell state back into the virtual filesystem, and improved persistence/restore handling.
- **Document conversion performance** — Moved PDF, DOCX, and XLSX conversion work into dedicated workers to reduce UI-thread blocking.
- **OAuth storage safety** — Added stronger OAuth credential validation, save/remove result reporting, and improved token refresh behavior.
- **Web fetch resilience** — Improved proxy URL construction and fallback handling for web fetch and search providers.
- **Settings UX** — Added bash usage mode controls, richer diagnostics, and more resilient provider/auth state handling.
- **Keyboard UX** — Added clearer input hints and keyboard shortcuts for send, stop, clear chat, new session, and settings toggle.

### Fixes

- **Workbook-specific sheet IDs** — Fixed stable sheet ID caching so workbook-specific mappings do not leak across documents.
- **Friendly tool errors** — Improved error mapping for workbook, worksheet, and object modification failures.
- **Toast cleanup** — Fixed toast timeout cleanup to avoid lingering timers.
- **Skill sync behavior** — Improved skill removal and VFS resync behavior for installed skills.

### Tests

- Added regression tests for chat drag overlay state, CSV utilities, model resolution, and OAuth credential storage.

### Migration

- **Storage key rename:** Internal storage keys were renamed from the legacy `openexcel-*` prefixes to `zanosheets-*` (example: `openexcel-keys` → `zanosheets-keys-v2`). The add-in performs an automatic, transparent migration on first run — no user action required. If you debug settings or storage directly, look for `zanosheets-*` keys going forward.


## [0.2.4] - 2026-02-22

### Features

- **Screenshot tool** — New `screenshot_range` tool captures Excel cell ranges as images and stores them in the VFS. New `pixart` CLI command renders pixel art from a simple text DSL directly into Excel cells.
- **Flexible set_cell_range** — `set_cell_range` now auto-pads rows with empty strings when row lengths don't match, removing the strict rectangular shape requirement.

### Fixes

- **Manifest validation** — Fixed invalid dev manifest GUID that prevented sideloading in Excel. Added manifest validation to `pnpm check` and CI.

### Chores

- Bumped `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` dependencies.

## [0.2.3] - 2026-02-15

### Features

- **Web search** — New `web-search` CLI command lets the agent search the web with pagination, region, and time filters. Supports multiple search providers: DuckDuckGo (free, no key), Brave, Serper, and Exa (API key required).
- **Web fetch** — New `web-fetch` CLI command fetches a URL and saves readable content to a file. HTML pages are converted to Markdown via Readability + Turndown. Binary files (PDF, DOCX, etc.) are downloaded raw. Supports basic fetch and Exa as providers.
- **Web tools settings** — New "Web Tools" section in the settings panel to configure search/fetch providers and manage API keys (Brave, Serper, Exa) with an advanced keys drawer.

### Improvements

- **Chat input redesign** — Input field now auto-resizes (up to 2 rows), with paperclip and send buttons moved inside the input border for a cleaner look.
- **Error boundary** — Added a top-level React error boundary that catches unhandled render errors and offers "Try again" / "Reload add-in" actions instead of a blank screen.

## [0.2.2] - 2026-02-13

### Fixes

- **search_data pagination with offset > 0** — Requests with `offset > 0` could return zero matches even when matches exist, and `hasMore`/`nextOffset` could be incorrect. Extracted pagination logic into a pure `SearchPageCollector` with separate match counting and page collection.

### Chores

- Added `pnpm test` step to CI workflow.
- Removed redundant typecheck/lint from release workflow (already validated in CI).

## [0.2.1] - 2026-02-08

### Fixes

- **OAuth token refresh during agent loops** — Token was only refreshed once at the start of a message, so multi-turn tool-use conversations could fail mid-stream if the access token expired. Token refresh now happens before every LLM call inside `streamFn`, matching pi's `AuthStorage.getApiKey()` pattern.

## [0.2.0] - 2026-02-08

### Features

- **Virtual filesystem & bash shell** — In-memory VFS powered by `just-bash/browser`. The agent can now read/write files and execute sandboxed bash commands (pipes, redirections, loops) with output truncation.
- **File uploads & drag-and-drop** — Upload files via paperclip button or drag-and-drop onto chat. Files are written to `/home/user/uploads/` and persisted per session in IndexedDB.
- **Composable CLI commands** — `csv-to-sheet`, `sheet-to-csv`, `pdf-to-text`, `docx-to-text`, `xlsx-to-csv` bridge the VFS and Excel for data import/export.
- **OAuth authentication** — Anthropic (Claude Pro/Max) and OpenAI Codex (ChatGPT Plus/Pro) OAuth via PKCE flow with token refresh.
- **Custom endpoints** — Connect to any OpenAI-compatible API (Ollama, vLLM, LMStudio) or other supported API types with configurable base URL and API type.
- **Skills system** — Install agent skills (folders or single `SKILL.md` files with YAML frontmatter). Skills are persisted in IndexedDB, mounted into the VFS, and injected into the system prompt.

### Breaking Changes

- **Message storage migrated** — Sessions now store raw `AgentMessage[]` instead of derived `ChatMessage[]`. Old sessions will appear empty after upgrade.

### Improvements

- Context window usage in stats bar now shows actual context sent per turn (not cumulative totals).
- Scroll handler in message list switched from `addEventListener` to React `onScroll`.

### Chores

- Replaced Dexie with `idb` for IndexedDB access — Dexie's global `Promise` patching is incompatible with SES `lockdown()`, which froze `Promise` and broke all DB operations after `eval_officejs` was used.
- Removed dead scaffold files (`hero-list.tsx`, `text-insertion.tsx`, `header.tsx`).
- Removed old crypto shims (no longer needed with Vite polyfills).
- IndexedDB schema upgraded to v3 with `vfsFiles` and `skillFiles` tables.

## [0.1.10] - 2026-02-06

Initial release with AI chat interface, multi-provider LLM support (BYOK), Excel read/write tools, and CORS proxy configuration.
