# AGENTS.md

## Project Overview

**Zano Sheets** is a Microsoft Office Excel Add-in with an integrated AI chat interface. Users can chat with LLM providers (OpenAI, Anthropic, Google, etc.) directly within Excel using their own API keys (BYOK). The agent has Excel read/write tools, a sandboxed bash shell, and a virtual filesystem for file uploads.

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + CSS variables for theming
- **Icons**: Lucide React (`lucide-react`)
- **Build Tool**: Vite 6
- **Office Integration**: Office.js API (`@types/office-js`)
- **LLM Integration**: `@mariozechner/pi-ai` + `@mariozechner/pi-agent-core` (unified LLM & agent API)
- **Virtual Filesystem / Bash**: `just-bash` (in-memory VFS + shell)
- **Dev Server**: Vite dev server with HTTPS

## Project Structure

```
zano-sheets/
├── src/
│   ├── taskpane/
│   │   ├── components/
│   │   │   ├── app.tsx              # Root component
│   │   │   └── chat/                # AI Chat UI
│   │   │       ├── index.ts         # Exports
│   │   │       ├── types.ts         # Type definitions
│   │   │       ├── chat-interface.tsx   # Main chat with tabs, drag-and-drop
│   │   │       ├── chat-context.tsx     # State, agent lifecycle, file uploads
│   │   │       ├── message-list.tsx     # Message renderer with tool calls
│   │   │       ├── chat-input.tsx       # Input with file upload button
│   │   │       └── settings-panel.tsx   # Provider/model/auth/skills config
│   │   ├── index.tsx                # React entry point
│   │   ├── index.css                # Tailwind + CSS variables
│   │   └── lockdown.ts             # SES lockdown for Office.js
│   ├── lib/
│   │   ├── tools/                   # Agent tools
│   │   │   ├── index.ts            # Tool registry (EXCEL_TOOLS)
│   │   │   ├── types.ts            # Tool definition helpers
│   │   │   ├── bash.ts             # Sandboxed bash execution
│   │   │   ├── read-file.ts        # VFS file reader (text + images)
│   │   │   ├── get-cell-ranges.ts  # Read cell data
│   │   │   ├── get-range-as-csv.ts # Export range as CSV
│   │   │   ├── set-cell-range.ts   # Write cell data
│   │   │   ├── clear-cell-range.ts # Clear cells
│   │   │   ├── copy-to.ts          # Copy ranges
│   │   │   ├── resize-range.ts     # Resize ranges
│   │   │   ├── search-data.ts      # Search sheet data
│   │   │   ├── get-all-objects.ts  # List charts/tables/pivots
│   │   │   ├── modify-object.ts    # Modify charts/tables
│   │   │   ├── modify-sheet-structure.ts  # Sheet operations
│   │   │   ├── modify-workbook-structure.ts # Workbook operations
│   │   │   └── eval-officejs.ts    # Raw Office.js eval
│   │   ├── vfs/                    # Virtual filesystem
│   │   │   ├── index.ts            # VFS singleton, file ops, snapshot/restore
│   │   │   └── custom-commands.ts  # CLI commands (csv-to-sheet, pdf-to-text, etc.)
│   │   ├── excel/                  # Excel API wrappers
│   │   │   ├── api.ts             # Core Excel operations
│   │   │   ├── sheet-id-map.ts    # Sheet ID tracking
│   │   │   └── tracked-context.ts # Dirty range tracking
│   │   ├── oauth/index.ts          # OAuth PKCE (Anthropic, OpenAI Codex)
│   │   ├── skills/index.ts         # Skill install/uninstall/prompt injection
│   │   ├── storage/
│   │   │   ├── db.ts              # IndexedDB via idb (sessions, VFS files, skills)
│   │   │   └── index.ts           # Storage re-exports
│   │   ├── provider-config.ts      # Provider config load/save, custom endpoints
│   │   ├── message-utils.ts        # AgentMessage → ChatMessage conversion, stats
│   │   ├── truncate.ts             # Output truncation (head/tail, line/byte limits)
│   │   ├── dirty-tracker.ts        # Track modified cell ranges
│   │   └── sandbox.ts              # Sandboxing utilities
│   ├── shims/
│   │   └── util-types-shim.js      # Browser shim for node:util/types
│   ├── commands/
│   │   └── commands.ts             # Ribbon command handlers
│   ├── taskpane.html               # Taskpane HTML template
│   ├── commands.html               # Commands HTML template
│   └── global.d.ts                 # Global type declarations
├── .plan/                           # Development plans
├── assets/                          # Icons
├── CHANGELOG.md                     # Release changelog
├── manifest.xml                     # Office Add-in manifest (dev)
├── manifest.prod.xml                # Office Add-in manifest (prod)
├── manifest.json                    # Unified manifest
├── vite.config.ts                   # Vite config + node polyfills
└── package.json
```

## Key Components

### Chat System (`src/taskpane/components/chat/`)

| File                 | Purpose                                                        |
| -------------------- | -------------------------------------------------------------- |
| `chat-interface.tsx` | Tab navigation, session dropdown, drag-and-drop overlay        |
| `chat-context.tsx`   | React context, agent lifecycle, streaming, file upload, skills |
| `message-list.tsx`   | Renders messages with tool call status, thinking blocks        |
| `chat-input.tsx`     | Input with file picker, upload chips, send/abort buttons       |
| `settings-panel.tsx` | Provider/model/auth config, CORS proxy, thinking, skills UI    |

### Agent Tools (`src/lib/tools/`)

Tools are registered in `EXCEL_TOOLS` array in `index.ts`. Two categories:

- **File & Bash**: `read` (VFS file reader), `bash` (sandboxed shell)
- **Excel**: cell read/write, CSV export, search, chart/table/pivot operations, sheet/workbook structure

### Virtual Filesystem (`src/lib/vfs/`)

In-memory filesystem via `just-bash/browser`. User uploads go to `/home/user/uploads/`, skills mount at `/home/skills/{name}/`. VFS state is snapshot/restored per session in IndexedDB.

Custom CLI commands bridge VFS ↔ Excel: `csv-to-sheet`, `sheet-to-csv`, `pdf-to-text`, `docx-to-text`, `xlsx-to-csv`.

### CSS Variables (Dark Theme)

```css
--chat-font-mono      /* Monospace font stack */
--chat-bg             /* #0a0a0a */
--chat-border         /* #2a2a2a */
--chat-text-primary   /* #e8e8e8 */
--chat-accent         /* #6366f1 (indigo) */
--chat-radius         /* 2px (boxy style) */
```

## LLM Integration

### Supported Providers (via pi-ai)

- OpenAI, Azure OpenAI, OpenAI Codex
- Anthropic (Claude) — API key or OAuth (Pro/Max)
- Google (Gemini), Google Vertex AI
- OpenRouter, Groq, xAI, Cerebras, Mistral
- **Custom endpoints** — any OpenAI-compatible API (Ollama, vLLM, LMStudio, etc.)

### Authentication

- **API Key (BYOK)**: Direct key entry for all providers
- **OAuth**: Anthropic (Claude Pro/Max) and OpenAI Codex (ChatGPT Plus/Pro) via PKCE flow

### CORS Proxy

Some providers require a CORS proxy for browser requests. Users configure their own proxy URL in settings. The proxy should accept `?url={encodedApiUrl}` format.

## Development Commands

```bash
pnpm install             # Install dependencies
pnpm dev-server          # Start dev server (https://localhost:3000)
pnpm start               # Launch Excel with add-in sideloaded
pnpm build               # Production build
pnpm build:dev           # Development build
pnpm lint                # Run Biome linter
pnpm format              # Format code with Biome
pnpm typecheck           # TypeScript type checking
pnpm check               # Typecheck + lint
```

## Code Style

- Formatter/linter: Biome
- No JSDoc comments on functions (keep code clean)
- Run `pnpm format` before committing

## Release Workflow

Releases are triggered by pushing a version tag. CI runs quality checks, deploys to Cloudflare Pages, and creates a GitHub release with changelog.

### Steps

1. Update `CHANGELOG.md` — move `[Unreleased]` contents to a new `[x.y.z]` section, add fresh `[Unreleased]` header
2. Bump version and tag:
   ```bash
   pnpm version patch       # or minor/major — updates package.json, creates git tag
   git push && git push --tags
   ```
3. CI (`.github/workflows/release.yml`):
   1. Runs typecheck, lint, build
   2. Extracts changelog section for the tagged version from `CHANGELOG.md`
   3. Deploys to Cloudflare Pages
   4. Creates GitHub release with the extracted changelog

## Configuration Storage

User settings stored in browser localStorage:

| Key                         | Contents                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `zanosheets-config-v2` | `{ provider, apiKey: "", model, useProxy, proxyUrl, thinking, followMode, apiType, customBaseUrl, authMethod }` |
| `zanosheets-keys-v2` | `{ [provider]: apiKey }` |
| `zanosheets-oauth-credentials` | `{ [provider]: { refresh, access, expires } }`                                                   |
| `zanosheets-web-config-v1` | `{ searchProvider, fetchProvider, apiKeys: { brave?, serper?, exa? } }` |

Session data (messages, VFS files, skills) stored in IndexedDB via `idb` (`ZanoSheetsDB_v3`).

## Excel API Usage

```typescript
await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("A1");
  range.values = [["value"]];
  await context.sync();
});
```

## Future Development

See `.plan/` directory for roadmap and progress tracking.

## References

- [Office Add-ins Documentation](https://learn.microsoft.com/en-us/office/dev/add-ins/)
- [Excel JavaScript API](https://learn.microsoft.com/en-us/javascript/api/excel)
- [pi-ai / pi-agent-core](https://github.com/badlogic/pi-mono)
- [just-bash](https://github.com/nickvdyck/just-bash)
