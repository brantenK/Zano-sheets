# Manual Testing Plan for Zano Sheets

This document provides a comprehensive manual testing checklist for the Zano Sheets Excel Add-in. Use this plan to validate features, accessibility, error handling, and overall user experience before releases.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Accessibility Testing](#accessibility-testing)
3. [Keyboard Navigation Testing](#keyboard-navigation-testing)
4. [Error Recovery Testing](#error-recovery-testing)
5. [Cross-Browser Testing](#cross-browser-testing)
6. [Performance Benchmarking](#performance-benchmarking)
7. [User Acceptance Testing](#user-acceptance-testing)
8. [Regression Testing](#regression-testing)

---

## Prerequisites

### Test Environment Setup

- [ ] Install Excel Desktop (Windows) - Latest version
- [ ] Install Excel Desktop (Mac) - Latest version
- [ ] Access to Excel for Web (Office 365)
- [ ] Screen reader software:
  - [ ] NVDA (Windows) - https://www.nvaccess.org/
  - [ ] JAWS (Windows) - https://www.freedomscientific.com/
  - [ ] VoiceOver (Mac) - Built-in
- [ ] Browser developer tools
- [ ] Network simulation tools (Chrome DevTools Network Throttling)

### Test Data Preparation

- [ ] Sample Excel files (.xlsx, .xls)
- [ ] Sample CSV files (various sizes)
- [ ] Sample PDF files
- [ ] Sample Word documents (.docx)
- [ ] Test API keys for each provider
- [ ] Invalid/expired API keys for error testing

---

## Accessibility Testing

### Screen Reader Testing (NVDA/JAWS/VoiceOver)

#### Basic Navigation
- [ ] Launch Excel and open Zano Sheets add-in
- [ ] Verify screen reader announces add-in name: "Zano Sheets"
- [ ] Tab through all interactive elements
- [ ] Verify each element is announced clearly

#### Chat Interface
- [ ] Navigate to chat input field
- [ ] Verify placeholder text is announced
- [ ] Type a message and verify it's announced
- [ ] Send message and verify response is announced
- [ ] Navigate through message history
- [ ] Verify role="user" and role="assistant" are announced

#### Buttons and Controls
- [ ] Verify all icon-only buttons have aria-labels:
  - [ ] Send button
  - [ ] Attachment button
  - [ ] Settings button
  - [ ] Theme toggle
  - [ ] Clear chat button
  - [ ] New chat button
  - [ ] Delete session button

#### Skip Links
- [ ] Press Tab at add-in start
- [ ] Verify "Skip to chat input" link is available
- [ ] Activate skip link and verify focus moves to input
- [ ] Verify skip link is hidden by default, visible on focus

#### Dynamic Content
- [ ] Send a message and wait for response
- [ ] Verify screen reader announces new content
- [ ] Verify status updates (tokens, cost) are announced
- [ ] Verify error messages are announced with role="alert"

#### Forms and Settings
- [ ] Navigate to Settings panel
- [ ] Verify all form fields have associated labels
- [ ] Verify required fields are announced
- [ ] Verify error messages are announced
- [ ] Verify success messages are announced

### Color Contrast Testing

#### Tools Required
- Chrome DevTools Lighthouse
- axe DevTools
- Contrast checker (https://webaim.org/resources/contrastchecker/)

#### Tests
- [ ] Run Lighthouse accessibility audit
- [ ] Run axe DevTools scan
- [ ] Verify all text meets WCAG AA (4.5:1 for normal text)
- [ ] Verify interactive elements meet WCAG AA (3:1 for graphics)
- [ ] Test in both light and dark themes
- [ ] Verify color is not the only means of conveying information
- [ ] Verify focus indicators are visible (3:1 contrast)

### Visual Accessibility

- [ ] Test at 100% zoom (normal)
- [ ] Test at 200% zoom
- [ ] Test at 400% zoom
- [ ] Verify no horizontal scrolling at 320px width
- [ ] Verify text reflows properly
- [ ] Verify no text overlaps

---

## Keyboard Navigation Testing

### Basic Keyboard Shortcuts

#### Global Shortcuts
- [ ] `Ctrl+K` - Clear chat (when not typing)
- [ ] `Ctrl+/` - Toggle Settings panel
- [ ] `Ctrl+Shift+N` - New chat session
- [ ] `Escape` - Stop generation / Close modals

#### Chat Input
- [ ] `Tab` - Navigate through interface
- [ ] `Shift+Tab` - Navigate backwards
- [ ] `Ctrl+Enter` / `Cmd+Enter` - Send message
- [ ] `Enter` - New line (in textarea)
- [ ] `Escape` - Stop generation when streaming

#### Session Management
- [ ] Navigate to session dropdown
- [ ] Use arrow keys to browse sessions
- [ ] Press Enter to select session
- [ ] Press Escape to close dropdown

#### Settings Panel
- [ ] Tab through all form fields
- [ ] Use arrow keys for dropdowns
- [ ] Use Space to toggle checkboxes
- [ ] Use Enter to confirm actions

### Focus Management

- [ ] Verify focus order is logical (top to bottom, left to right)
- [ ] Verify focus indicator is visible
- [ ] Verify focus is not lost when switching tabs
- [ ] Verify focus returns to triggering element after closing modals
- [ ] Verify focus trap in modals (can't tab outside)
- [ ] Verify focus moves to first element when opening panel
- [ ] Verify focus management during file upload

### Keyboard-Only Workflow

#### Complete Chat Session
1. [ ] Open add-in using keyboard only
2. [ ] Navigate to chat input
3. [ ] Type message without mouse
4. [ ] Send message using keyboard
5. [ ] Wait for response
6. [ ] Type follow-up question
7. [ ] Create new session using keyboard
8. [ ] Switch back to previous session
9. [ ] Clear chat using keyboard shortcut
10. [ ] Open settings using keyboard
11. [ ] Change provider using keyboard
12. [ ] Close settings using keyboard

#### File Upload
1. [ ] Navigate to attachment button
2. [ ] Press Enter to open file picker
3. [ ] Select file using keyboard
4. [ ] Confirm upload
5. [ ] Verify file appears in upload list
6. [ ] Send message with attachment

---

## Error Recovery Testing

### Authentication Errors (401)

#### Test Scenario 1: Invalid API Key
1. [ ] Enter invalid API key in Settings
2. [ ] Save settings
3. [ ] Send a message
4. [ ] Verify error message is user-friendly
5. [ ] Verify error mentions API key issue
6. [ ] Verify "Fix in Settings" button is shown
7. [ ] Click "Fix in Settings"
8. [ ] Update API key with valid key
9. [ ] Return to chat
10. [ ] Send message again
11. [ ] Verify message succeeds

#### Test Scenario 2: Expired OAuth Token
1. [ ] Use provider with OAuth (e.g., Google)
2. [ ] Manually revoke token in provider settings
3. [ ] Send a message
4. [ ] Verify error mentions re-authentication
5. [ ] Follow reconnection flow
6. [ ] Verify reconnection succeeds
7. [ ] Send message again
8. [ ] Verify message succeeds

### Rate Limiting (429)

#### Test Scenario 1: Provider Rate Limit
1. [ ] Send multiple messages rapidly
2. [ ] Trigger rate limit from provider
3. [ ] Verify 429 error is shown
4. [ ] Verify error mentions waiting
5. [ ] Verify retry-after delay is shown (if available)
6. [ ] Wait for retry period
7. [ ] Send message again
8. [ ] Verify message succeeds

#### Test Scenario 2: Automatic Retry
1. [ ] Configure provider with low rate limit
2. [ ] Send message that triggers 429
3. [ ] Verify automatic retry occurs
4. [ ] Verify retry happens after appropriate delay
5. [ ] Verify message succeeds after retry

### Network Errors

#### Test Scenario 1: No Internet Connection
1. [ ] Disconnect internet (disable WiFi/Network)
2. [ ] Send a message
3. [ ] Verify network error is shown
4. [ ] Verify error mentions checking connectivity
5. [ ] Verify message input is preserved
6. [ ] Reconnect internet
7. [ ] Click retry or send message again
8. [ ] Verify message succeeds

#### Test Scenario 2: Timeout
1. [ ] Use network throttling (Chrome DevTools)
2. [ ] Set latency to 5 seconds
3. [ ] Send a long message
4. [ ] Verify timeout warning appears at 4 minutes
5. [ ] Verify option to stop generation is shown
6. [ ] Wait for timeout or stop manually
7. [ ] Verify error message is shown
8. [ ] Verify partial response is displayed (if any)

### Server Errors (5xx)

#### Test Scenario 1: Server Unavailable (503)
1. [ ] Mock server error response
2. [ ] Send a message
3. [ ] Verify "temporarily unavailable" message
4. [ ] Verify retry option is available
5. [ ] Wait and retry
6. [ ] Verify message succeeds on retry

#### Test Scenario 2: Retry Logic
1. [ ] Configure provider to return 503
2. [ ] Send message
3. [ ] Verify automatic retry occurs
4. [ ] Verify max retry attempts are respected
5. [ ] Verify final error is shown after max retries

### File Upload Errors

#### Test Scenario 1: File Too Large
1. [ ] Try uploading file > 10MB
2. [ ] Verify error message mentions size limit
3. [ ] Verify error specifies max size
4. [ ] Upload smaller file
5. [ ] Verify upload succeeds

#### Test Scenario 2: Invalid File Type
1. [ ] Try uploading .exe file
2. [ ] Verify error message mentions supported types
3. [ ] Upload .xlsx file
4. [ ] Verify upload succeeds

#### Test Scenario 3: Corrupted File
1. [ ] Try uploading corrupted Excel file
2. [ ] Verify error message is helpful
3. [ ] Verify add-in doesn't crash
4. [ ] Verify user can try another file

---

## Cross-Browser Testing

### Desktop Excel

#### Windows
- [ ] Test on Excel 2016
- [ ] Test on Excel 2019
- [ ] Test on Excel 2021
- [ ] Test on Microsoft 365 (current channel)
- [ ] Test on Microsoft 365 (semi-annual channel)

#### Mac
- [ ] Test on Excel 2016 for Mac
- [ ] Test on Excel 2019 for Mac
- [ ] Test on Excel 2021 for Mac
- [ ] Test on Microsoft 365 for Mac

### Excel for Web

#### Browsers
- [ ] Chrome (latest)
- [ ] Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)

#### Features to Verify
- [ ] Basic chat functionality
- [ ] File upload/download
- [ ] Settings persistence
- [ ] Theme switching
- [ ] Keyboard navigation
- [ ] Screen reader support

### Platform-Specific Issues

#### Windows
- [ ] Verify high DPI (200%) scaling
- [ ] Verify Windows dark mode integration
- [ ] Verify Windows Narrator support

#### Mac
- [ ] Verify Retina display rendering
- [ ] Verify macOS dark mode integration
- [ ] Verify VoiceOver support
- [ ] Verify Touch Bar support (if applicable)

---

## Performance Benchmarking

### Load Time Tests

#### Initial Load
1. [ ] Clear browser cache
2. [ ] Open Excel and load add-in
3. [ ] Measure time to interactive (TTI)
4. [ ] Verify < 1 second for initial UI
5. [ ] Verify < 3 seconds for full load

#### Subsequent Loads
1. [ ] Close and reopen add-in
2. [ ] Measure load time
3. [ ] Verify < 500ms with cache

### Memory Tests

#### Memory Usage
1. [ ] Open add-in and check baseline memory
2. [ ] Send 10 messages
3. [ ] Check memory usage
4. [ ] Verify no significant leaks
5. [ ] Create and delete 5 sessions
6. [ ] Verify memory returns to baseline

#### Memory Leaks
1. [ ] Open Chrome DevTools Memory profiler
2. [ ] Take heap snapshot
3. [ ] Perform actions (send messages, switch sessions)
4. [ ] Take another heap snapshot
5. [ ] Compare and look for detached DOM nodes
6. [ ] Verify no increasing memory trend

### Rendering Performance

#### Frame Rate
1. [ ] Open Chrome DevTools Performance
2. [ ] Start recording
3. [ ] Send message and watch streaming
4. [ ] Stop recording
5. [ ] Verify FPS stays above 55
6. [ ] Verify no long tasks (> 50ms)

#### Large Message Lists
1. [ ] Create session with 100+ messages
2. [ ] Scroll through message list
3. [ ] Verify smooth scrolling (no jank)
4. [ ] Verify virtual scrolling is working

### Bundle Size

#### Check Bundle Size
1. [ ] Run `pnpm build`
2. [ ] Check dist/ folder sizes
3. [ ] Verify main bundle < 500KB
4. [ ] Verify total vendor chunks < 2MB each
5. [ ] Verify code-splitting is working

### Network Performance

#### API Call Optimization
1. [ ] Send message with 100 tokens
2. [ ] Check network tab
3. [ ] Verify single API call
4. [ ] Check response time
5. [ ] Verify < 2 seconds for first response

#### Caching
1. [ ] Enable prompt caching (if available)
2. [ ] Send messages with same context
3. [ ] Verify cache hits
4. [ ] Verify reduced tokens used
5. [ ] Verify cost reduction

---

## User Acceptance Testing

### New User Onboarding

#### First-Time User
1. [ ] Open add-in for first time
2. [ ] Verify onboarding tour appears
3. [ ] Follow tour steps
4. [ ] Verify tour is clear and helpful
5. [ ] Complete tour and start using
6. [ ] Verify tour doesn't appear again

#### Setting Up Provider
1. [ ] Go to Settings
2. [ ] Select provider (e.g., Anthropic)
3. [ ] Enter API key
4. [ ] Save settings
5. [ ] Verify validation works
6. [ ] Send first message
7. [ ] Verify success

### Daily Use Scenarios

#### Scenario 1: Quick Question
1. [ ] Open add-in
2. [ ] Type: "What's the formula to sum column A?"
3. [ ] Send message
4. [ ] Verify helpful response
5. [ ] Verify response is quick

#### Scenario 2: Data Analysis
1. [ ] Open Excel with sample data
2. [ ] Upload file to add-in
3. [ ] Ask: "Analyze this data and find trends"
4. [ ] Verify AI understands data
5. [ ] Verify insights are provided
6. [ ] Ask follow-up questions
7. [ ] Verify context is maintained

#### Scenario 3: Formula Help
1. [ ] Type complex formula requirement
2. [ ] Send message
3. [ ] Verify formula is provided
4. [ ] Copy formula to Excel
5. [ ] Verify formula works
6. [ ] Ask for explanation
7. [ ] Verify explanation is clear

#### Scenario 4: Multiple Sessions
1. [ ] Create session for "Budget Analysis"
2. [ ] Ask budget-related questions
3. [ ] Create new session for "Sales Data"
4. [ ] Ask sales-related questions
5. [ ] Switch back to "Budget Analysis"
6. [ ] Verify context is preserved
7. [ ] Verify history is intact

#### Scenario 5: Error Recovery
1. [ ] Start a task (e.g., data analysis)
2. [ ] Simulate network error
3. [ ] Verify error is handled gracefully
4. [ ] Recover from error
5. [ ] Continue task
6. [ ] Verify work is not lost

### Accessibility Testing (Real Users)

#### Screen Reader Users
- [ ] Recruit 2-3 screen reader users
- [ ] Have them complete common tasks
- [ ] Gather feedback on:
  - Navigation ease
  - Announcement clarity
  - Overall usability
- [ ] Address critical issues

#### Keyboard-Only Users
- [ ] Recruit 2-3 keyboard-only users
- [ ] Have them complete common tasks
- [ ] Gather feedback on:
  - Focus management
  - Shortcut discoverability
  - Task completion time
- [ ] Address critical issues

---

## Regression Testing

### Pre-Release Checklist

#### Critical Features
- [ ] Chat functionality works
- [ ] All providers connect successfully
- [ ] File upload works for all supported types
- [ ] Sessions persist across reloads
- [ ] Settings save correctly
- [ ] Theme switching works
- [ ] Keyboard shortcuts work
- [ ] Error handling works
- [ ] No console errors
- [ ] No memory leaks

#### Bug Fixes
- [ ] Verify fixed bugs are actually fixed
- [ ] Verify fix didn't break other features
- [ ] Test edge cases related to fix

#### New Features
- [ ] Test new feature thoroughly
- [ ] Test integration with existing features
- [ ] Test error cases
- [ ] Test accessibility
- [ ] Test performance
- [ ] Document any new test cases

### Smoke Tests

#### Quick Smoke Test (5 minutes)
1. [ ] Open add-in
2. [ ] Send "Hello" message
3. [ ] Verify response
4. [ ] Create new session
5. [ ] Switch theme
6. [ ] Close and reopen
7. [ ] Verify session persists

#### Full Smoke Test (15 minutes)
1. [ ] Complete quick smoke test
2. [ ] Test file upload
3. [ ] Test all providers
4. [ ] Test error handling
5. [ ] Test keyboard navigation
6. [ ] Test settings changes
7. [ ] Test session management

### Continuous Testing

#### Daily Tests
- [ ] Run automated test suite
- [ ] Quick smoke test on dev build
- [ ] Check for console errors
- [ ] Verify performance hasn't degraded

#### Weekly Tests
- [ ] Full smoke test
- [ ] Accessibility audit
- [ ] Performance benchmarks
- [ ] Cross-browser tests
- [ ] Security scan

#### Release Tests
- [ ] Complete manual test plan
- [ ] Full accessibility audit
- [ ] Full performance benchmark
- [ ] Cross-platform testing
- [ ] User acceptance testing
- [ ] Documentation review

---

## Test Reporting

### Bug Report Template

```markdown
## Bug Title

**Severity:** Critical / High / Medium / Low
**Priority:** P1 / P2 / P3 / P4

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- Platform: Windows/Mac/Web
- Excel Version: x.x.x
- Browser: Chrome/Edge/Firefox/Safari (if web)
- Screen Reader: NVDA/JAWS/VoiceOver (if applicable)

**Screenshots/Recordings:**
Attach if applicable

**Console Errors:```
Paste any console errors

**Additional Context:**
Any other relevant information
```

### Test Results Template

```markdown
## Test Results - [Date]

**Tester:** [Name]
**Build:** [Version]
**Environment:** [Platform/Browser]

### Summary
- Tests Run: X
- Tests Passed: X
- Tests Failed: X
- Tests Skipped: X

### Passed Tests
- [Test 1]
- [Test 2]

### Failed Tests
- [Test 1] - [Reason]
- [Test 2] - [Reason]

### Issues Found
1. [Issue 1]
2. [Issue 2]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]

### Sign-off
Approved for release: [Yes/No]
Tester signature: [Name]
Date: [Date]
```

---

## Appendix

### Test Data

#### Sample Excel Files
- [ ] Simple data (10 rows, 3 columns)
- [ ] Large dataset (1000+ rows)
- [ ] Complex formulas
- [ ] Multiple sheets
- [ ] Charts and graphs
- [ ] Pivot tables

#### Sample CSV Files
- [ ] Standard CSV (comma-separated)
- [ ] Semicolon-separated
- [ ] Tab-separated
- [ ] Various encodings (UTF-8, UTF-16, etc.)

### Provider-Specific Tests

#### Anthropic (Claude)
- [ ] Test with claude-3-5-sonnet
- [ ] Test with claude-3-5-haiku
- [ ] Test with claude-3-opus
- [ ] Test thinking modes
- [ ] Test prompt caching

#### OpenAI
- [ ] Test with gpt-4
- [ ] Test with gpt-4-turbo
- [ ] Test with gpt-3.5-turbo
- [ ] Test OAuth flow

#### Google
- [ ] Test with gemini-pro
- [ ] Test with gemini-ultra
- [ ] Test OAuth flow
- [ ] Test API key auth

### Known Issues to Monitor

- [ ] Excel for Mac performance
- [ ] Large file upload timeouts
- [ ] Specific screen reader quirks
- [ ] Provider rate limits
- [ ] Network instability handling

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-01-15 | Initial creation | Complete manual testing plan |

---

## Notes

- This testing plan should be updated as new features are added
- Prioritize testing based on risk and impact
- Automate repetitive tests when possible
- Keep test data up to date
- Share test results with the team regularly
- Document and track all issues found
