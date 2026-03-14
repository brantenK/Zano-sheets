# E2E Tests for Zano Sheets

This directory contains Playwright end-to-end tests for Zano Sheets Excel Add-in.

## Running Tests

### Prerequisites

First, install Playwright browsers (one-time):

```bash
pnpm exec playwright install chromium
```

### Running Tests

```bash
# Run all E2E tests (starts dev server automatically)
pnpm e2e

# Run with UI (interactive mode with test inspector)
pnpm e2e:ui

# Run headed (see browser window while tests run)
pnpm e2e:headed

# Run specific test file
pnpm e2e e2e/chat-interface.spec.ts

# Run tests matching a pattern
pnpm e2e -g "should render"
```

### Debug Mode

```bash
# Run with debugging enabled
pnpm e2e --debug

# View test traces after a failure
# Traces are saved in playwright-report/ (open in browser)
pnpm exec playwright show-trace path/to/trace.zip
```

## Test Structure

```
e2e/
├── fixtures.ts                 # Shared test setup, Office.js mock
├── chat-interface.spec.ts      # Chat input/message tests
├── settings-panel.spec.ts      # Settings UI tests
├── onboarding.spec.ts          # First-run experience tests
└── README.md                   # This file
```

## Test Files Overview

### fixtures.ts

Provides shared test utilities:

- Custom `test` fixture that injects an Office.js mock before page load
- Ensures tests work in browser context without real Excel
- Exports `expect` from Playwright

### chat-interface.spec.ts

Core UI tests for the chat interface:

- Chat input renders and is focused on load
- Message display (empty state)
- Input/output behavior
- Text clearing and submission

### settings-panel.spec.ts

Settings UI tests:

- Settings panel opens/closes
- Provider selection visibility
- UI dismissal (close button, Escape key)

### onboarding.spec.ts

First-run experience tests:

- Initial page load
- Storage initialization
- Error-free startup
- Page title and main content rendering

## Architecture

### Office.js Mock

The test fixture automatically injects a minimal Office.js mock that:

- Provides `Office.onReady()` callback
- Provides `Excel.run()` context
- Allows tests to run in a regular browser without Excel installed

This enables:

- Fast test execution
- CI/CD integration
- Cross-platform testing

### Testing Against Real Excel

For full integration testing with actual Excel:

1. Start Excel with Add-in loaded:
   ```bash
   pnpm start
   ```

2. Use the Office Add-in Debugger to inspect the live add-in

3. Tests requiring real Excel context can be added to `e2e/excel-integration/` (future)

## Best Practices

### Selectors

- Prefer `data-testid` attributes (most stable)
- Use `aria-label` for accessibility testing
- Fall back to text content or role selectors
- Avoid brittle CSS selectors

Example:

```typescript
// Good: data-testid
page.locator('[data-testid="send-button"]')

// Good: aria-label
page.locator('[aria-label="Send message"]')

// Good: role
page.locator('button[type="submit"]')

// Avoid: CSS class names (fragile)
page.locator('.btn.primary.md')
```

### Waits and Timeouts

- Use `waitForLoadState('networkidle')` before assertions
- Set explicit timeouts for slow operations
- Use `.or()` for fallback selectors

Example:

```typescript
await page.goto('/');
await page.waitForLoadState('networkidle');

await expect(element).toBeVisible({ timeout: 10000 });
```

### Error Handling

Tests filter expected errors:

- Office.js mock warnings
- HTTPS certificate issues in dev environment

Unexpected errors will be logged but may not fail tests (configurable).

## CI/CD Integration

The config auto-detects CI environment (`CI` env var):

- Single worker (avoid flakiness)
- 2 automatic retries
- Screenshot on failure
- HTML report generation

```bash
# GitHub Actions example
CI=true pnpm e2e
```

## Troubleshooting

### Tests hang at "waiting for dev server"

- Ensure no other process is using port 3000
- Check `pnpm dev-server` works manually
- Increase timeout in `playwright.config.ts`

### "Office is not defined"

- Fixtures are injecting the mock - this shouldn't happen
- Clear cache: `rm -rf .playwright`
- Reinstall: `pnpm install`

### Tests fail with "Element not found"

- Add `{ timeout: 10000 }` to increase wait time
- Check if element has different selector (use `.or()`)
- Use `page.locator('...').screenshot()` to debug

### Port 3000 in use

```bash
# Find process using port 3000
lsof -i :3000

# Kill it
kill -9 <PID>
```

## Future Enhancements

- [ ] Visual regression tests with `@playwright/test`'s `toHaveScreenshot()`
- [ ] Real Excel integration tests (Office Add-in Mock)
- [ ] Performance testing (Lighthouse integration)
- [ ] Accessibility audit (axe integration)
- [ ] Mobile/tablet viewport tests
- [ ] Cross-browser testing (Firefox, Safari)

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Office JavaScript API](https://learn.microsoft.com/en-us/office/dev/add-ins/reference/javascript-api-for-office)
- [Zano Sheets Architecture](../docs/ARCHITECTURE.md)
