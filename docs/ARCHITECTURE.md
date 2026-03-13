# Architecture Documentation

This document describes the architecture of Zano Sheets, an AI-powered Excel Add-in.

## Table of Contents
- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Key Modules](#key-modules)
- [Integration Points](#integration-points)
- [Security](#security)

## Overview

Zano Sheets is a browser-based Office Add-in that integrates AI capabilities with Microsoft Excel. It runs as a task pane in Excel, using the Office.js API to interact with workbooks.

### Technology Stack
- **Frontend:** React 18 + TypeScript
- **Build:** Vite 6
- **Excel Integration:** Office.js
- **AI Integration:** @mariozechner/pi-ai + @mariozechner/pi-agent-core
- **Storage:** IndexedDB (via idb)
- **PDF Processing:** pdfjs-dist
- **Excel Processing:** xlsx

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Excel Application                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Task Pane (Browser Context)              │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │           React UI (taskpane/)                 │  │   │
│  │  │  ┌──────────────────────────────────────────┐  │  │   │
│  │  │  │      Chat Context + Hooks                │  │  │   │
│  │  │  │  - useAgentEvents                        │  │  │   │
│  │  │  │  - useMessageSender                      │  │  │   │
│  │  │  │  - useSessionManager                     │  │  │   │
│  │  │  │  - useFileManager                        │  │  │   │
│  │  │  │  - useSkillManager                       │  │  │   │
│  │  │  └──────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │           Business Logic (lib/)               │  │   │
│  │  │  ┌──────────────────────────────────────────┐  │  │   │
│  │  │  │  Chat Layer (chat/)                      │  │  │   │
│  │  │  │  - Agent orchestration                   │  │  │   │
│  │  │  │  - Provider integration                  │  │  │   │
│  │  │  │  - Stream handling                       │  │  │   │
│  │  │  └──────────────────────────────────────────┘  │  │   │
│  │  │  ┌──────────────────────────────────────────┐  │  │   │
│  │  │  │  Tools Layer (tools/)                    │  │  │   │
│  │  │  │  - Excel operations                      │  │  │   │
│  │  │  │  - File operations                       │  │  │   │
│  │  │  │  - Web operations                        │  │  │   │
│  │  │  └──────────────────────────────────────────┘  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                  │
│                            │ Office.js                        │
│                            ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Workbook Data                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   External AI Providers                      │
│  - Anthropic (Claude)                                       │
│  - OpenAI (GPT)                                             │
│  - Google (Gemini)                                          │
│  - AWS Bedrock                                              │
│  - Azure OpenAI                                             │
└─────────────────────────────────────────────────────────────┘
```

## System Architecture

### Layer Architecture

```
┌────────────────────────────────────────────────────────────┐
│                   Presentation Layer                       │
│  (React Components - taskpane/components/)                  │
│  - Chat UI                                                 │
│  - Settings Panel                                          │
│  - File Upload UI                                          │
│  - Session Management UI                                   │
├────────────────────────────────────────────────────────────┤
│                    Application Layer                        │
│  (React Hooks + Context - lib/chat/hooks/)                  │
│  - State Management                                        │
│  - Event Handling                                          │
│  - Session Management                                      │
│  - Tool Approval                                           │
├────────────────────────────────────────────────────────────┤
│                     Business Logic Layer                    │
│  (lib/)                                                     │
│  - AI Agent Orchestration                                  │
│  - Tool Execution                                          │
│  - Excel API Wrappers                                      │
│  - Provider Management                                     │
├────────────────────────────────────────────────────────────┤
│                    Integration Layer                       │
│  (External Libraries)                                       │
│  - Office.js (Excel API)                                   │
│  - pi-ai (AI Providers)                                    │
│  - pi-agent-core (Agent Framework)                         │
│  - pdfjs-dist (PDF Processing)                             │
├────────────────────────────────────────────────────────────┤
│                      Data Layer                            │
│  - IndexedDB (Session Storage)                             │
│  - Browser Storage (Preferences)                           │
│  - Excel Workbook (Cell Data)                              │
└────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Chat Context (Central State Management)

Located in `src/taskpane/components/chat/chat-context.tsx`, the `ChatProvider` manages:

- **Chat State**: Messages, streaming status, errors
- **Provider Configuration**: API keys, model selection, settings
- **Session Management**: Multiple chat sessions
- **Agent Lifecycle**: Creating, configuring, and destroying agents
- **Tool Execution**: Tracking tool calls and results

### Agent System

The agent system uses `@mariozechner/pi-agent-core`:

```
┌────────────────────────────────────────────────────────────┐
│                     Agent Lifecycle                         │
│                                                              │
│  1. Initialize (applyConfig)                                │
│     ├── Resolve model from config                          │
│     ├── Build system prompt                                │
│     ├── Create Agent instance                              │
│     └── Subscribe to events                                │
│                                                              │
│  2. Send Message (sendMessage)                              │
│     ├── Add workbook context                               │
│     ├── Add attachment context                             │
│     ├── Call agent.prompt()                                │
│     └── Stream response                                    │
│                                                              │
│  3. Handle Events (handleAgentEvent)                        │
│     ├── message_start: Create assistant message            │
│     ├── message_update: Update streaming content           │
│     ├── tool_execution_start: Mark tool running            │
│     ├── tool_execution_end: Process tool result            │
│     └── agent_end: Clean up                                │
│                                                              │
│  4. Loop Detection                                           │
│     ├── Tool call count limit (25 per turn)                │
│     └── Consecutive identical errors (3)                   │
└────────────────────────────────────────────────────────────┘
```

### Tool System

Tools are Excel operations the AI can perform:

```
lib/tools/
├── index.ts          # Tool registry and metadata
├── types.ts          # Tool type definitions
├── bash.ts           # Execute bash commands
├── get-cell-ranges.ts     # Read cell values
├── set-cell-range.ts      # Write cell values
├── copy-to.ts             # Copy data
├── clear-cell-range.ts    # Clear cells
├── resize-range.ts        # Resize ranges
├── modify-sheet-structure.ts  # Add/remove sheets
├── modify-workbook-structure.ts # Workbook operations
├── modify-object.ts       # Object formatting
├── explain-formula.ts     # Formula explanation
├── web-search.ts          # Web search
├── web-fetch.ts           # Web scraping
├── query-knowledge-base.ts # RAG queries
├── deep-research.ts       # Multi-step research
└── eval-officejs.ts       # Direct Office.js execution
```

## Data Flow

### Message Flow

```
User Input (chat-input.tsx)
    │
    ▼
sendMessage() [useMessageSender hook]
    │
    ├── Add workbook context
    ├── Add attachment context
    ├── Add PDF handling hints
    │
    ▼
agent.prompt() [pi-agent-core]
    │
    ▼
streamWithRetry() [stream-with-retry.ts]
    │
    ├── Stream response from provider
    ├── Retry on transient errors
    ├── Refresh OAuth token on 401
    │
    ▼
handleAgentEvent() [useAgentEvents hook]
    │
    ├── message_start → Create message in UI
    ├── message_update → Update streaming content
    ├── tool_execution_start → Show tool running
    ├── tool_execution_end → Display tool result
    └── agent_end → Finalize message
    │
    ▼
Update Chat State
    │
    ▼
Re-render UI
```

### Tool Execution Flow

```
Agent requests tool
    │
    ▼
checkToolApproval() [tool-approval.ts]
    │
    ├── Is tool auto-approved?
    │   ├── Yes → Execute immediately
    │   └── No → Show approval UI
    │
    ▼
Execute Tool (lib/tools/*.ts)
    │
    ├── Validate parameters
    ├── Call Excel API
    ├── Process result
    │
    ▼
Return Result to Agent
    │
    ▼
Update Tool Call Status in UI
```

## Key Modules

### Chat Layer (`lib/chat/`)

- **adapter.ts**: Type-safe pi-ai integration
- **model-resolution.ts**: Resolve model from provider config
- **provider-catalog.ts**: Provider and model registry
- **provider-stream.ts**: Provider-specific streaming
- **stream-with-retry.ts**: Retry logic with exponential backoff
- **stream-fallback.ts**: Fallback for failed streams
- **system-prompt.ts**: Build agent system prompts
- **use-agent-events.ts**: Agent event handling hook
- **use-message-sender.ts**: Message sending hook

### Excel Layer (`lib/excel/`)

- **api.ts**: Excel API wrappers
- **tracked-context.ts**: Tracked Excel context for batching

### Tools Layer (`lib/tools/`)

Each tool:
1. Defines metadata (name, description, parameters)
2. Implements execute function
3. Returns structured result
4. Handles errors appropriately

### Storage Layer (`lib/storage/`)

- **db.ts**: IndexedDB schema and operations
- Stores: Sessions, messages, knowledge base files

## Integration Points

### Office.js Integration

```
Office.js → excel/api.ts → tools/*.ts → Agent
```

Key Excel operations:
- Read cells: `getRange().load('values')`
- Write cells: `getRange().values = [...]`
- Navigate: `getWorksheet().activate()`
- Create sheets: `addWorksheet()`

### AI Provider Integration

```
Agent → provider-stream.ts → pi-ai providers → AI APIs
```

Provider flow:
1. Resolve model from config
2. Load provider implementation dynamically
3. Stream response from provider
4. Handle errors and retries

### PDF Integration

```
File Upload → pdfjs-dist → Extract text/images → Knowledge Base
```

## Security

### API Key Storage

- User-provided keys stored in browser storage
- OAuth tokens stored in IndexedDB
- Keys never sent to backend (no backend exists)

### Tool Approval

- Dangerous tools require user approval
- Approval state tracked per session
- Tool results displayed to user

### Excel API Permissions

- Minimal permissions requested
- User grants access when installing add-in
- Operations scoped to active workbook

### Data Privacy

- All data stays client-side
- Only API calls go to AI providers
- Workbook data sent to AI for processing
- User controls what data is shared

## Extension Points

### Adding New Tools

1. Create tool file in `lib/tools/`
2. Implement tool metadata and execute function
3. Add to `EXCEL_TOOLS` array in `lib/tools/index.ts`
4. Update types in `lib/tools/types.ts`

### Adding New AI Providers

1. Check if pi-ai supports provider
2. Add to `SUPPORTED_APIS` in `lib/chat/adapter.ts`
3. Add to provider catalog in `lib/chat/provider-catalog.ts`
4. Test streaming and error handling

### Custom Skills

Skills are user-installed plugins:
- Defined as TypeScript/JavaScript files
- Can add custom tools
- Can modify system prompt
- Stored in IndexedDB

## Performance Considerations

### Streaming
- Chunked responses for immediate feedback
- Heartbeat mechanism for stall detection
- Timeout after 5 minutes

### Excel Operations
- Batch operations when possible
- Tracked objects for efficient sync
- Background processing for large operations

### State Management
- React Context for global state
- Refs for frequently accessed values
- useCallback/useMemo for expensive operations

## Related Documentation

- [Deployment](DEPLOYMENT.md)
- [Troubleshooting](TROUBLESHOOTING.md)
- [Patches](PATCHES.md)
- [Telemetry](TELEMETRY.md)
