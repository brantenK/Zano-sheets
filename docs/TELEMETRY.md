# Telemetry and Observability

This document describes what telemetry is collected by Zano Sheets and how to use it for monitoring and debugging.

## Overview

Zano Sheets integrates with Sentry for error tracking and performance monitoring. Telemetry helps:
- Diagnose production issues
- Monitor provider reliability
- Track feature usage
- Identify performance bottlenecks

## Sentry Integration

### Configuration

Sentry is initialized in `src/taskpane/components/error-boundary.tsx`:

```typescript
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of error sessions
});
```

### Environment Variables

```bash
# .env.production
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

## Telemetry Events

### Integration Telemetry

Located in `src/lib/integration-telemetry.ts`, these events track AI provider interactions:

| Event Name | Status Code | Description |
|------------|-------------|-------------|
| `oauth_refresh_retry` | 401 | OAuth token was refreshed |
| `transient_retry` | 429, 500-504 | Transient error was retried |
| `provider_final_error` | Any | Final error after all retries |
| `send_message_error` | Any | Error during message send |
| `stream_stall_timeout` | - | Streaming timeout (5 minutes) |
| `tool_loop_limit` | - | Tool call limit exceeded |
| `tool_loop_identical_errors` | - | Consecutive identical tool errors |

### Usage Telemetry

Not currently implemented, but planned:
- Session start/end
- Feature usage (tools used)
- Provider preferences
- Error rates by feature

## Error Context

Errors are captured with rich context:

### Stack Traces
- Full stack trace for JavaScript errors
- Component stack for React errors

### User Context
- Session ID (if available)
- Browser and OS info
- Add-in version

### Custom Context
- Provider being used
- Model being used
- Error status code
- Request/response context

## Performance Monitoring

### Transaction Tracking

Automatic performance tracking:
- React component render times
- Excel API call durations
- AI provider response times
- Tool execution times

### Manual Transactions

For custom performance tracking:

```typescript
import * as Sentry from "@sentry/react";

const transaction = Sentry.startTransaction({
  name: "custom-operation",
  op: "task",
});

// ... do work ...
transaction.finish();
```

## Debugging with Telemetry

### Finding Errors in Sentry

1. **By Error Type**
   - Filter by "TypeError", "ReferenceError", etc.
   - Look for patterns in error messages

2. **By Provider**
   - Search for provider name in tags
   - Common issues:
     - 401: Invalid API key
     - 429: Rate limit exceeded
     - 500: Provider error

3. **By Feature**
   - Filter by transaction name
   - Examples: "sendMessage", "executeTool"

### Analyzing Error Patterns

**Recurring Errors:**
```typescript
// Check for patterns in Sentry
- Same error multiple times → Bug in code
- Same user multiple times → Configuration issue
- Same provider multiple times → Provider issue
```

**Error Rates:**
- High error rate (>5%) → Investigate immediately
- Medium error rate (1-5%) → Monitor closely
- Low error rate (<1%) → Normal operation

## Alerts

### Recommended Alerts

1. **Critical**
   - Error rate >10%
   - All providers failing
   - Service unavailable

2. **Warning**
   - Error rate >5%
   - Single provider failing
   - High latency (>10s)

3. **Info**
   - New error type
   - Unexpected error pattern

## Privacy Considerations

### Data Collected

- Error messages and stack traces
- Browser and OS info
- Performance metrics
- Provider and model names

### Data NOT Collected

- User chat messages (content)
- Excel workbook data
- API keys
- Personal information

### Data Retention

- Errors: 30 days (default)
- Transactions: 30 days (default)
- Replays: 7 days (default)

Configure in Sentry dashboard.

## Best Practices

### Adding Telemetry

```typescript
import { recordIntegrationTelemetry } from "./lib/integration-telemetry";

// Record an event
recordIntegrationTelemetry("custom_event", statusCode);

// Capture exception
Sentry.captureException(error, {
  tags: {
    provider: "openai",
    model: "gpt-4",
  },
  extra: {
    context: "Additional context",
  },
});
```

### Error Messages

- Include actionable information
- Avoid exposing sensitive data
- Use consistent format

### Testing Telemetry

```typescript
// In development, check console
console.log("[Telemetry] Event:", event, status);

// Use Sentry test mode
// Set environment to "development" to not send events
```

## Troubleshooting

### No Errors Appearing in Sentry

1. Check DSN is correct
2. Check environment variable is set
3. Check browser console for Sentry errors
4. Verify network requests to Sentry

### Too Many Errors

1. Check for error spam from same source
2. Add error grouping rules in Sentry
3. Fix underlying bug
4. Add rate limiting if needed

### Missing Context

1. Ensure Sentry.init is called early
2. Check custom context is added
3. Verify error boundaries are in place
4. Check browser console for errors

## Related Documentation

- [Architecture](ARCHITECTURE.md) - System architecture
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues
- [Deployment](DEPLOYMENT.md) - Production setup
