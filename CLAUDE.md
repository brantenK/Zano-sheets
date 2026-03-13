# Zano Sheets - Project Context for Claude

## Overview

Zano Sheets is an AI-powered Excel Add-in that brings intelligent assistance to Microsoft Excel. It's built with React, TypeScript, and Vite, integrating with multiple AI providers (Anthropic, OpenAI, Google, etc.) through the pi-ai library.

**Current Version:** 0.2.5 (MVP)

**Repository:** https://github.com/brantenK/Zano-sheets

## Architecture

### Tech Stack
- **Frontend:** React 18 with TypeScript
- **Build:** Vite 6
- **Styling:** TailwindCSS 4
- **Excel Integration:** Office JavaScript API (office-js)
- **AI Integration:** @mariozechner/pi-ai and @mariozechner/pi-agent-core
- **Storage:** IndexedDB via idb
- **PDF Processing:** pdfjs-dist
- **Excel Processing:** xlsx

### Key Directories
- `src/taskpane/` - React UI components
- `src/lib/` - Core business logic
  - `chat/` - AI chat and agent logic
  - `excel/` - Excel API wrappers
  - `tools/` - Agent tool implementations
  - `storage/` - IndexedDB persistence
- `tests/` - Vitest tests
- `patches/` - Library patches (see docs/PATCHES.md)

### Dependencies with Patches
The project uses patched versions of `@mariozechner/pi-ai`. See `docs/PATCHES.md` for details on why patches are needed and how they're applied.

## Development Workflow

### Getting Started
```bash
# Install dependencies (patches are applied automatically via postinstall)
pnpm install

# Start dev server
pnpm dev-server

# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

### Building
```bash
# Production build
pnpm build

# Development build
pnpm build:dev
```

### Excel Add-in Development
```bash
# Start debugging (requires Office Add-in Debugger)
pnpm start

# Stop debugging
pnpm stop
```

## Key Technical Decisions

### 1. Patched Dependencies
We patch `@mariozechner/pi-ai` to enable `store: true` for OpenAI API calls. This is necessary for:
- Prompt caching (cost reduction)
- Compliance requirements
- Future AI features

See `docs/PATCHES.md` for full details.

### 2. Type Safety Improvements
The codebase has been refactored to reduce unsafe `any` types:
- Created `src/lib/chat/adapter.ts` for type-safe pi-ai integration
- Created `src/lib/chat/stream-types.ts` for streaming type definitions
- Replaced `as never` casts with proper type guards

### 3. Component Organization
Large components are being split into focused hooks:
- `useAgentEvents` - Agent event handling (extracted from chat-context)
- `useMessageSender` - Message sending logic
- `useSessionManager` - Session management
- `useFileManager` - File upload management
- `useSkillManager` - Skill (plugin) management

## Code Conventions

### File Naming
- React components: kebab-case (`chat-input.tsx`)
- Hooks: kebab-case with `use-` prefix (`use-session-manager.ts`)
- Utilities: kebab-case (`excel-api.ts`)
- Types: May be co-located with implementations

### Import Order
1. External dependencies
2. Internal `src/lib/*` imports
3. Relative imports
4. Type-only imports

### Error Handling
- Use `getErrorMessage()` and `getErrorStatus()` from `lib/error-utils`
- Record telemetry with `recordIntegrationTelemetry()`
- Format errors for users with `formatProviderError()`

## Testing

### Current Coverage
- ~24% coverage (21 tests vs 86 source files)
- Target: 80%+ coverage

### Test Structure
```
tests/
├── csv-utils.test.ts
├── deep-agent.test.ts
├── excel-utils.test.ts
├── model-resolution.test.ts
├── provider-config.test.ts
├── web-config.test.ts
├── web-tools.test.ts
└── (new tests needed)
```

### Running Tests
```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Watch mode
pnpm test -- --watch
```

## Common Tasks

### Adding a New AI Tool
1. Implement in `src/lib/tools/your-tool.ts`
2. Add to `EXCEL_TOOLS` array in `src/lib/tools/index.ts`
3. Add tests in `tests/your-tool.test.ts`
4. Update types in `src/lib/tools/types.ts` if needed

### Adding a New AI Provider
1. Check if pi-ai supports it
2. Add to provider catalog in `src/lib/chat/provider-catalog.ts`
3. Update type definitions in `src/lib/chat/adapter.ts`
4. Test with `tests/provider-config.test.ts`

### Updating pi-ai Dependency
1. Install new version: `pnpm add @mariozechner/pi-ai@x.y.z`
2. Apply patches if needed
3. Generate new patch: `pnpm patch @mariozechner/pi-ai`
4. Update `docs/PATCHES.md`
5. Run all tests

## Known Issues & Technical Debt

1. **chat-context.tsx** - Still large (~884 lines), needs further refactoring
2. **Test Coverage** - Below 80% target, need more tests
3. **Type Safety** - Some `any` types remain, being addressed incrementally
4. **Circuit Breaker** - Not yet implemented for streaming failures
5. **Rate Limiting** - No client-side rate limiting

## Production Readiness

### Completed
- ✅ Automated patch application via pnpm
- ✅ Type-safe adapter layer for pi-ai
- ✅ Patch documentation
- ✅ Patch verification tests
- ✅ Error handling utilities
- ✅ Telemetry integration

### In Progress
- ⏸️ chat-context.tsx refactoring
- ⏸️ Test coverage improvement
- ⏸️ Production documentation

### Planned
- ⏳ Circuit breaker for streaming
- ⏳ Rate limiting
- ⏳ E2E tests
- ⏳ Deployment runbooks

## Debugging

### Common Issues

**Patches not applying:**
```bash
rm -rf node_modules
pnpm install
```

**Type errors after pi-ai update:**
- Check `src/lib/chat/adapter.ts` for type mappings
- Update `src/lib/chat/stream-types.ts` if needed

**Excel API not available:**
- Ensure running in Excel context
- Check `office-js` is initialized
- See `docs/TROUBLESHOOTING.md`

### Logs & Telemetry
- Check browser console for errors
- Telemetry is sent to Sentry (see `src/lib/integration-telemetry.ts`)
- Excel API calls are logged with `[Excel]` prefix

## Resources

- **Architecture:** `docs/ARCHITECTURE.md`
- **Patches:** `docs/PATCHES.md`
- **Deployment:** `docs/DEPLOYMENT.md`
- **Troubleshooting:** `docs/TROUBLESHOOTING.md`
- **Telemetry:** `docs/TELEMETRY.md`
