# Accessibility Implementation (WCAG 2.1 AA)

## Overview

Zano Sheets is committed to accessibility and meeting WCAG 2.1 AA standards. This document outlines the accessibility features implemented across the application.

## Implementation Summary

### 1. Semantic HTML & ARIA Attributes

#### Main Application Structure
- **chat-interface.tsx**
  - `role="application"` on main container with descriptive `aria-label`
  - `role="navigation"` with `aria-label="Chat navigation"` on header
  - `role="tablist"` with `aria-label="Main navigation"` on tab container
  - `role="status"` with `aria-live="polite"` on stats bar for token updates

#### Buttons & Controls
- **Icon-only buttons**: All have `aria-label` describing their action
- **Toggle buttons**: Use `aria-pressed` to indicate state
- **Tab buttons**: Use `role="tab"` and `aria-selected`
- **Dropdown buttons**: Use `aria-expanded`, `aria-haspopup`, and `aria-label`

#### Input Fields
- **chat-input.tsx**
  - `aria-label="Type your message"` on textarea
  - `aria-describedby` links to warning messages
  - `id` attributes for label associations
  - Clear placeholder text with keyboard shortcuts

#### Live Regions
- **message-list.tsx**
  - `aria-live="polite"` on message container for new messages
  - `aria-busy="true"` during streaming
  - `role="region"` with descriptive labels

- **Error Messages**
  - `role="alert"` with `aria-live="assertive"` for errors
  - `role="status"` with `aria-live="polite"` for warnings

### 2. Focus Management

#### Focus Trapping (Modals)
- **onboarding-tour.tsx**
  - `useFocusTrap` hook keeps focus within modal
  - `useFocusRestore` hook restores focus after modal close
  - First element auto-focused on modal open

#### Focus Indicators
- **CSS Implementation** (`index.css`)
  - `:focus-visible` with 2px solid accent color
  - High contrast focus outlines in both light/dark themes
  - Focus offset for better visibility
  - Mouse users see no outline (only keyboard users)

#### Skip Navigation
- **skip-links.tsx**
  - Hidden skip links that appear on focus
  - Links to main content, settings, and messages
  - Always first interactive elements in tab order

### 3. Screen Reader Support

#### Decorative Icons
- All decorative icons have `aria-hidden="true"`
- Icons in buttons have aria-hidden since button has aria-label

#### Expanded States
- **Collapsible sections** (thinking blocks, tool calls)
  - `aria-expanded` indicates current state
  - `aria-label` describes "Expand/Collapse" action

#### Progress Indicators
- **Onboarding tour**
  - `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
  - Descriptive `aria-label` for progress status

#### Tool Call Status
- Screen reader-only status text for pending/running/complete/error states
- Visual icons marked with `aria-hidden="true"`

### 4. Keyboard Navigation

#### Global Shortcuts
- `Ctrl+K`: Clear chat
- `Ctrl+/`: Toggle settings
- `Esc`: Stop generation
- `Ctrl+Shift+N`: New chat

#### Component-Specific Navigation
- **Dropdowns**: Tab key cycles through options
- **Modals**: Focus trapped, Escape closes
- **Forms**: Logical tab order, proper labels

#### Keyboard-Specific Styles
```css
/* Only show outline for keyboard navigation */
*:focus-visible {
  outline: 2px solid var(--chat-accent);
  outline-offset: 2px;
}

/* Hide outline for mouse users */
button:focus:not(:focus-visible) {
  outline: none;
}
```

### 5. Color & Visual Accessibility

#### Color Contrast
- All text meets WCAG AA contrast ratios (4.5:1 for normal text)
- Interactive elements have 3:1 contrast against background
- Error/warning colors maintain sufficient contrast

#### Focus Indicators
- 2px solid accent color with offset
- Visible in both light and dark themes
- High contrast mode support

#### Motion Preferences
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 6. Forms & Inputs

#### Labels & Descriptions
- All inputs have associated labels (explicit or implicit)
- `aria-describedby` links to help text
- Required fields indicated with `aria-required`

#### Error Handling
- `aria-invalid="true"` on invalid inputs
- Error messages announced with `role="alert"`
- Clear error text explains the issue

#### Validation
- Real-time validation with screen reader feedback
- Clear error messages linked to inputs

### 7. Dynamic Content

#### Live Regions
- **Chat messages**: `aria-live="polite"` announces new messages
- **Streaming status**: `aria-busy` indicates loading state
- **Token counts**: `role="status"` updates without interrupting

#### Announcements
- `useAnnouncement` hook for programmatic announcements
- Supports both "polite" and "assertive" priorities

### 8. Component-Specific Patterns

#### Session Dropdown
```tsx
<button
  aria-label="Chat sessions"
  aria-expanded={open}
  aria-haspopup="listbox"
>
  {/* Icon and text */}
</button>

<div role="listbox" aria-label="Chat sessions">
  {sessions.map(session => (
    <button
      role="option"
      aria-selected={isCurrent}
      aria-label={`${session.name} (${count} messages)`}
    >
      {/* Session info */}
    </button>
  ))}
</div>
```

#### Tool Call Blocks
```tsx
<button
  aria-expanded={isExpanded}
  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${toolName} - Status: ${status}`}
>
  {/* Tool info */}
  <span className="sr-only">{statusLabel}</span>
  {statusIcon}
</button>
```

#### Thinking Blocks
```tsx
<button
  aria-expanded={isExpanded}
  aria-label={`${isExpanded ? "Collapse" : "Expand"} reasoning`}
>
  {/* Thinking content */}
</button>
```

### 9. Accessibility Utilities

#### useFocusTrap
```typescript
export function useFocusTrap(isActive: boolean) {
  // Traps focus within container
  // Cycles focus when Tab/Shift+Tab pressed
  // Returns containerRef
}
```

#### useFocusRestore
```typescript
export function useFocusRestore(isActive: boolean) {
  // Stores current focus element
  // Restores focus when inactive
}
```

#### useAnnouncement
```typescript
export function useAnnouncement() {
  // Announces messages to screen readers
  // Supports polite/assertive priorities
  const { announceRef, announce } = useAnnouncement();
}
```

### 10. Testing Checklist

#### Keyboard Navigation
- [ ] Can navigate entire interface with Tab key
- [ ] All interactive elements receive visible focus
- [ ] Tab order is logical
- [ ] Skip links work correctly
- [ ] Modals trap focus
- [ ] Escape key closes modals/dropdowns

#### Screen Reader
- [ ] All buttons have accessible labels
- [ ] Form inputs have associated labels
- [ ] Error messages are announced
- [ ] Live regions announce changes
- [ ] Icon-only buttons have aria-label
- [ ] Decorative content is hidden

#### Visual Accessibility
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA
- [ ] Text can be resized to 200%
- [ ] No reliance on color alone
- [ ] Motion respects user preferences

#### Dynamic Content
- [ ] Page updates don't steal focus
- [ ] Live regions announce appropriately
- [ ] Loading states are indicated
- [ ] Errors are announced immediately

### 11. Browser & AT Compatibility

#### Tested With
- **Browsers**: Chrome, Edge, Firefox, Safari
- **Screen Readers**: NVDA, JAWS, Narrator, VoiceOver
- **Keyboard**: Full keyboard navigation support

#### Known Limitations
- Excel Taskpane environment may have some AT limitations
- Some screen readers may announce content differently
- Focus management in Excel context may vary

### 12. Future Enhancements

#### Planned
- [ ] High contrast theme option
- [ ] Font size scaling controls
- [ ] Enhanced error reporting
- [ ] More comprehensive ARIA live regions
- [ ] Keyboard shortcut customization

#### Under Consideration
- [ ] Voice control support
- [ ] Alternative input methods
- [ ] Enhanced dyslexia-friendly fonts
- [ ] Color blindness simulation mode

## Development Guidelines

### When Adding New Components

1. **Use Semantic HTML**
   - Use native elements when possible (button, input, etc.)
   - Add ARIA roles only when necessary
   - Maintain proper heading hierarchy

2. **Ensure Keyboard Access**
   - All interactive elements must be keyboard accessible
   - Provide visible focus indicators
   - Support standard keyboard shortcuts

3. **Label Everything**
   - All buttons need aria-label (especially icon-only)
   - Form inputs need labels or aria-label
   - Use aria-describedby for additional context

4. **Announce Changes**
   - Use aria-live for dynamic content
   - Use aria-busy for loading states
   - Use role="alert" for errors

5. **Test Early**
   - Test with keyboard only
   - Test with screen reader
   - Test with high contrast mode
   - Test with reduced motion

### Code Review Checklist

- [ ] All interactive elements have accessible labels
- [ ] Focus states are visible
- [ ] ARIA attributes are correct
- [ ] Live regions are appropriate
- [ ] Keyboard navigation works
- [ ] Color contrast is sufficient
- [ ] Icons are decorative (aria-hidden) or labeled

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Accessibility Checklist](https://webaim.org/standards/wcag/checklist)
- [Accessible Rich Internet Applications (ARIA)](https://www.w3.org/TR/wai-aria-1.2/)

## Support

For accessibility questions or issues, please refer to:
- Project documentation: `/docs/ACCESSIBILITY.md`
- Component examples: `/src/taskpane/components/chat/`
- CSS utilities: `/src/taskpane/index.css`

---

**Last Updated**: 2025-03-14
**WCAG Level**: AA (2.1)
**Status**: Production Ready
