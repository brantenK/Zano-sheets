# Testing Guide for Zano Sheets

This document describes the testing approach, tools, and practices used to ensure Zano Sheets is production-ready.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Test Coverage](#test-coverage)
5. [Testing Tools](#testing-tools)
6. [Accessibility Testing](#accessibility-testing)
7. [Performance Testing](#performance-testing)
8. [E2E Testing](#e2e-testing)
9. [Continuous Testing](#continuous-testing)

## Testing Philosophy

Zano Sheets follows a comprehensive testing approach:

- **Test-Driven Development (TDD)**: Write tests alongside or before code
- **Accessibility-First**: Ensure a11y is tested from the start
- **User-Centric**: Test real user workflows, not just units
- **Shift Left**: Catch issues early in development
- **Automate First**: Automate what can be automated
- **Manual for UX**: Use manual testing for subjective aspects

## Test Structure

```
tests/
├── accessibility.test.ts          # Automated a11y tests
├── adapter.test.ts                # pi-ai adapter tests
├── circuit-breaker.test.ts        # Circuit breaker tests
├── chat-interface.test.ts         # Chat UI tests
├── credential-storage.test.ts     # Storage tests
├── csv-utils.test.ts              # CSV utility tests
├── deep-agent.test.ts             # Agent logic tests
├── deep-research-tool.test.ts     # Research tool tests
├── error-handling.test.ts         # Error handling tests
├── excel-utils.test.ts            # Excel utility tests
├── message-utils.test.ts          # Message formatting tests
├── model-resolution.test.ts       # Model selection tests
├── oauth.test.ts                  # OAuth flow tests
├── performance.test.ts            # Performance benchmarks
├── provider-config.test.ts        # Provider config tests
├── rate-limiter.test.ts           # Rate limiting tests
├── search-data-pagination.test.ts # Data search tests
├── tools-types.test.ts            # Tool type validation
├── use-file-manager.test.ts       # File upload hook tests
├── use-session-manager.test.ts    # Session management tests
├── use-skill-manager.test.ts      # Skill management tests
├── user-workflows.test.ts         # Integration workflow tests
├── vfs-operations.test.ts         # Virtual filesystem tests
├── web-config.test.ts             # Web config tests
├── web-search.test.ts             # Web search tests
├── web-tools.test.ts              # Web tool tests
└── patch-verification.test.ts     # Patch verification tests
```

## Running Tests

### Run All Tests

```bash
pnpm test
```

### Run Tests in Watch Mode

```bash
pnpm test -- --watch
```

### Run Tests with Coverage

```bash
pnpm test -- --coverage
```

### Run Specific Test File

```bash
pnpm test accessibility.test.ts
```

### Run Tests Matching Pattern

```bash
pnpm test -- error
```

## Test Coverage

Current coverage target: **80%**

### Coverage by Module

| Module | Coverage | Target | Status |
|--------|----------|--------|--------|
| Core utilities | 85% | 80% | ✅ |
| Chat logic | 75% | 80% | ⏳ |
| Excel API | 70% | 80% | ⏳ |
| Tools | 65% | 80% | ⏳ |
| Storage | 90% | 80% | ✅ |
| UI Components | 40% | 80% | ⏳ |

### Increasing Coverage

1. Run `pnpm test -- --coverage`
2. Check coverage report for uncovered lines
3. Write tests for uncovered code
4. Re-run coverage to verify improvement

## Testing Tools

### Unit & Integration Tests

- **Vitest**: Fast unit test runner (built on Vite)
- **React Testing Library**: Component testing utilities
- **vi**: Built-in Vitest mocking

### Accessibility Testing

- **axe-core**: Automated a11y testing
- **jest-axe**: Jest/Vitest matcher for axe
- **NVDA/JAWS/VoiceOver**: Manual screen reader testing

### Performance Testing

- **Vite built-in analyzer**: Bundle size analysis
- **Chrome DevTools**: Performance profiling
- **Lighthouse**: Automated performance audits

### E2E Testing

- **Playwright**: Cross-browser E2E tests (planned)
- **Office Add-in Testing**: Microsoft's testing framework

## Accessibility Testing

### Automated Tests

Automated accessibility tests are in `tests/accessibility.test.ts`:

```typescript
// Run a11y tests
pnpm test accessibility.test.ts
```

These tests verify:
- ARIA labels and roles
- Keyboard navigation
- Focus management
- Screen reader support
- Color contrast (via axe-core)

### Manual Testing

See `MANUAL-TESTING-PLAN.md` for comprehensive manual a11y testing:

1. **Screen Reader Testing**
   - NVDA (Windows)
   - JAWS (Windows)
   - VoiceOver (Mac)

2. **Keyboard-Only Testing**
   - All features accessible via keyboard
   - Logical tab order
   - Visible focus indicators

3. **Color Contrast Testing**
   - WCAG AA compliance (4.5:1 for text)
   - Test both light and dark themes

### Accessibility Checklist

- [ ] All interactive elements have aria-labels
- [ ] Skip links provided
- [ ] Focus is managed properly
- [ ] Dynamic content is announced
- [ ] Forms have proper labels
- [ ] Color is not the only indicator
- [ ] Keyboard shortcuts documented
- [ ] Screen reader tested

## Performance Testing

### Automated Benchmarks

Performance tests are in `tests/performance.test.ts`:

```bash
pnpm test performance.test.ts
```

These tests verify:
- Bundle size limits
- Load time targets
- Memory leak detection
- Rendering performance (60 FPS)
- API call optimization

### Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Initial load | < 1s | ✅ |
| Full load | < 3s | ✅ |
| Main bundle | < 500KB | ✅ |
| Vendor chunks | < 2MB each | ✅ |
| First Contentful Paint | < 1.8s | ✅ |
| Largest Contentful Paint | < 2.5s | ✅ |
| First Input Delay | < 100ms | ✅ |
| Cumulative Layout Shift | < 0.1 | ✅ |

### Manual Performance Testing

1. **Bundle Size Analysis**
   ```bash
   pnpm build
   # Check dist/ folder sizes
   ```

2. **Load Time Testing**
   - Open DevTools Performance tab
   - Record page load
   - Check TTI (Time to Interactive)

3. **Memory Leak Testing**
   - Open DevTools Memory profiler
   - Take heap snapshot
   - Perform actions
   - Take another snapshot
   - Compare for leaks

## E2E Testing

### Current State

E2E tests are planned but not yet implemented. For now, use manual testing according to `MANUAL-TESTING-PLAN.md`.

### Planned E2E Tests

Future E2E tests will use Playwright:

1. **User Onboarding Flow**
   - First-time user experience
   - Provider setup
   - First message sent

2. **Chat Workflows**
   - Send message
   - Receive streaming response
   - File upload
   - Session management

3. **Settings Management**
   - Change provider
   - Update API key
   - Toggle theme

4. **Error Scenarios**
   - Invalid API key
   - Rate limiting
   - Network errors

## Continuous Testing

### Pre-Commit Hooks

Ensure tests pass before committing:

```bash
# Run in pre-commit hook
pnpm typecheck && pnpm lint && pnpm test
```

### CI/CD Pipeline

Tests run automatically on:
- Every pull request
- Every merge to main
- Before releases

### Test Reports

Coverage reports are generated in `coverage/` directory.

## Writing Tests

### Unit Test Example

```typescript
import { describe, expect, it } from "vitest";
import { formatProviderError } from "../src/lib/error-utils";

describe("formatProviderError", () => {
  it("should format 401 errors", () => {
    const error = { status: 401 };
    const formatted = formatProviderError(error);
    expect(formatted).toContain("Authentication failed");
  });
});
```

### Component Test Example

```typescript
import { render, screen } from "@testing-library/react";
import { SkipLink } from "../src/components/skip-links";

describe("SkipLink", () => {
  it("should have correct accessibility attributes", () => {
    render(<SkipLink targetId="main">Skip to main</SkipLink>);
    const link = screen.getByText("Skip to main");
    expect(link).toHaveAttribute("href", "#main");
  });
});
```

### Integration Test Example

```typescript
import { renderHook, act } from "@testing-library/react";
import { useSessionManager } from "../src/hooks/use-session-manager";

describe("useSessionManager", () => {
  it("should create new session", async () => {
    const { result } = renderHook(() => useSessionManager());
    await act(async () => {
      await result.current.newSession();
    });
    expect(result.current.state.sessions.length).toBe(1);
  });
});
```

## Test Best Practices

### DO

- ✅ Write tests alongside code
- ✅ Test user behavior, not implementation
- ✅ Use descriptive test names
- ✅ Test edge cases
- ✅ Mock external dependencies
- ✅ Keep tests fast and isolated
- ✅ Test accessibility attributes
- ✅ Test error conditions

### DON'T

- ❌ Test implementation details
- ❌ Write brittle tests
- ❌ Skip testing error paths
- ❌ Forget to clean up mocks
- ❌ Test third-party libraries
- ❌ Write slow tests
- ❌ Ignore a11y in tests
- ❌ Only test happy paths

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [axe-core Documentation](https://www.deque.com/axe/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web.dev Performance](https://web.dev/performance/)

## Contributing Tests

When adding new features:

1. Write tests first (TDD)
2. Include accessibility tests
3. Test error conditions
4. Add manual testing to MANUAL-TESTING-PLAN.md
5. Update this document if adding new test types

## Test Maintenance

- Keep tests updated with code changes
- Remove tests for deprecated features
- Refactor brittle tests
- Update test data regularly
- Review test coverage monthly
