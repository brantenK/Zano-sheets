# Telemetry Integration Guide

This guide shows how to integrate the new performance telemetry and stream management features into the chat components.

---

## Quick Start

### 1. Startup Telemetry in chat-interface.tsx

```tsx
import { markFirstPaint, markInteractive } from "../../lib/startup-telemetry";

function ChatInterface() {
  // Mark first paint when component renders
  useEffect(() => {
    markFirstPaint();
  }, []);

  // Mark interactive when user can interact
  useEffect(() => {
    const timer = setTimeout(() => {
      markInteractive();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ToastProvider>
      <ChatProvider>
        <ChatContent />
      </ChatProvider>
    </ToastProvider>
  );
}
```

### 2. First Prompt Telemetry in chat-context.tsx

```tsx
import { markFirstPromptSend, markFirstStreamedToken } from "../../lib/startup-telemetry";

async function sendMessage(content: string) {
  markFirstPromptSend();
  // ... send logic
}

function onFirstChunk() {
  markFirstStreamedToken();
  // ... handle first chunk
}
```

### 3. Settings Open Telemetry in settings-panel.tsx

```tsx
import { markSettingsOpen } from "../../lib/startup-telemetry";

function SettingsPanel() {
  useEffect(() => {
    markSettingsOpen();
  }, []);

  // ... rest of component
}
```

### 4. Session Restore Telemetry in chat-context.tsx

```tsx
import { markSessionRestore } from "../../lib/startup-telemetry";

async function restoreSession(sessionId: string) {
  const span = startPerfSpan("session_restore_ms");
  try {
    // ... restore logic
    markSessionRestore();
  } finally {
    span.end();
  }
}
```

---

## Stream Manager Integration

### Replace inline stream state with StreamManager

```tsx
import { createStreamManager, type StreamManager } from "../../lib/chat/stream-fallback";

function ChatProvider({ children }: { children: ReactNode }) {
  const [streamManager] = useState(() => createStreamManager({
    idleTimeoutMs: 15000,
    completionFallbackMs: 1200,
    onStall: (state) => {
      recordIntegrationTelemetry("stream_stall_timeout");
      // Optionally show user-facing indicator
    },
    onRecovery: (state) => {
      // Clear stall indicator
    },
    onAbort: () => {
      // Clean up after abort
    },
  }));

  // Use streamManager instead of inline state
  const sendMessage = useCallback(async (content: string) => {
    streamManager.start();

    try {
      for await (const chunk of streamResponse(content, streamManager.getAbortSignal())) {
        streamManager.recordChunk();
        // Handle chunk
      }

      streamManager.endMessage();
    } catch (error) {
      if (error.name === 'AbortError') {
        streamManager.abort();
      }
    }
  }, [streamManager]);

  // ... rest of provider
}
```

### Validate operations before allowing them

```tsx
import { StreamValidation } from "../../lib/chat/stream-fallback";

function ChatInput() {
  const { streamManager } = useChat();

  const handleSend = () => {
    const canSend = StreamValidation.canSendNewMessage(streamManager?.getState() ?? null);
    if (!canSend) {
      const blockReason = StreamValidation.getBlockReason(
        streamManager?.getState() ?? null,
        "send"
      );
      showToast(blockReason);
      return;
    }

    // ... send logic
  };

  return (
    <button
      onClick={handleSend}
      disabled={!StreamValidation.canSendNewMessage(streamManager?.getState() ?? null)}
    >
      Send
    </button>
  );
}
```

---

## Performance Telemetry API

### Recording Metrics

```tsx
import { recordPerfMetric, startPerfSpan } from "../../lib/perf-telemetry";

// Simple recording
recordPerfMetric("workbook_metadata_ms", 1234.56);

// Span-based recording
async function readWorkbookMetadata() {
  const span = startPerfSpan("workbook_metadata_ms");
  try {
    return await Excel.run(async (context) => {
      // ... Excel API calls
    });
  } finally {
    span.end();
  }
}
```

### Getting Telemetry Summary

```tsx
import { getPerfSummary, exportPerfTelemetry } from "../../lib/perf-telemetry";

// Get summary for diagnostics
const summary = getPerfSummary();
console.log("Average workbook metadata time:", summary.metrics.workbook_metadata_ms.avg);

// Export full telemetry for debugging
const telemetryJson = exportPerfTelemetry();
console.log(telemetryJson);
```

---

## Viewing Telemetry Data

### Add Telemetry Panel to Settings

```tsx
import { getPerfSummary } from "../../lib/perf-telemetry";
import { getStartupTelemetrySummary } from "../../lib/startup-telemetry";

function TelemetryPanel() {
  const [perfSummary, setPerfSummary] = useState(getPerfSummary());
  const [startupSummary, setStartupSummary] = useState(getStartupTelemetrySummary());

  return (
    <div>
      <h3>Performance Telemetry</h3>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Count</th>
            <th>Avg</th>
            <th>P95</th>
            <th>Last</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(perfSummary.metrics).map(([name, stats]) => (
            <tr key={name}>
              <td>{name}</td>
              <td>{stats.count}</td>
              <td>{stats.avg}ms</td>
              <td>{stats.p95}ms</td>
              <td>{stats.last}ms</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Startup Telemetry</h3>
      <table>
        <tbody>
          <tr>
            <td>First Paint</td>
            <td>{startupSummary.phases.taskpane_first_paint ?? "N/A"}ms</td>
          </tr>
          <tr>
            <td>Interactive</td>
            <td>{startupSummary.phases.taskpane_interactive ?? "N/A"}ms</td>
          </tr>
          {/* More startup phases */}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Testing Telemetry

### Manual Telemetry Reset

```tsx
import { clearPerfTelemetry } from "../../lib/perf-telemetry";
import { resetStartupTelemetry } from "../../lib/startup-telemetry";

// In development, reset telemetry for fresh measurements
if (process.env.NODE_ENV === "development") {
  clearPerfTelemetry();
  resetStartupTelemetry();
}
```

### Check Performance Thresholds

```tsx
import { checkPerfThreshold } from "../../lib/perf-telemetry";

const firstPaintCheck = checkPerfThreshold("taskpane_first_paint_ms", 2000);
if (!firstPaintCheck.passed) {
  console.warn(`First paint too slow: ${firstPaintCheck.current}ms (target: ${firstPaintCheck.threshold}ms)`);
}
```

---

## Metrics to Track

### Startup Metrics

- `taskpane_first_paint_ms`: Time from fetch start to first paint
- `taskpane_interactive_ms`: Time until user can interact
- `settings_open_ms`: Time to load and render settings
- `first_prompt_send_ms`: Time to initiate first prompt
- `first_streamed_token_ms`: Time to receive first streamed token
- `session_restore_ms`: Time to restore previous session
- `vfs_restore_ms`: Time to restore VFS files

### Runtime Metrics

- `agent_prompt_ms`: Agent prompt processing time
- `workbook_metadata_ms`: Excel metadata read time
- `get_cell_ranges_ms`: Cell range read time
- `set_cell_range_ms`: Cell range write time
- `tool_update_batch_size`: Number of tools updated per batch
- `stream_completion_ms`: Total stream duration

---

## Debugging Stream Issues

### Enable Stream Logging

```tsx
const streamManager = createStreamManager({
  onStall: (state) => {
    console.log("[Stream] Stalled:", {
      duration: Date.now() - state.lastChunkTime,
      activeTools: state.activeToolCallCount,
      messageEnded: state.messageEnded,
    });
  },
  onRecovery: (state) => {
    console.log("[Stream] Recovered after stall");
  },
});
```

### Check Stream State

```tsx
function debugStreamState(manager: StreamManager) {
  const state = manager.getState();
  console.log("[Stream Debug]", {
    isActive: state.isActive,
    duration: manager.getDuration(),
    timeUntilStall: getTimeUntilStall(state),
    canAbort: manager.canAbort(),
    isRecoverable: manager.isRecoverable(),
  });
}
```

---

## Integration Checklist

- [ ] Add startup telemetry to chat-interface.tsx
- [ ] Add first prompt/first token telemetry to chat-context.tsx
- [ ] Add settings open telemetry to settings-panel.tsx
- [ ] Add session restore telemetry to chat-context.tsx
- [ ] Replace inline stream state with StreamManager in chat-context.tsx
- [ ] Add StreamValidation checks to chat-input.tsx
- [ ] Add StreamValidation checks to chat-interface.tsx (session switch)
- [ ] Add telemetry panel to settings-panel.tsx
- [ ] Test stall detection and recovery
- [ ] Test abort behavior
- [ ] Export telemetry for support diagnostics

---

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Taskpane first paint | <2s | 🔄 Measure |
| Taskpane interactive | <3s | 🔄 Measure |
| Settings open | <2s | 🔄 Measure |
| First prompt send | <5s to first token | 🔄 Measure |
| First streamed token | <3s after send | 🔄 Measure |
| Bash workflow start | <5s | 🔄 Measure |
