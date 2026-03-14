# Help System Integration Guide

This guide explains how to integrate the help system into your Zano Sheets application.

## Quick Start

### Option 1: Use the Enhanced Chat Interface (Recommended)

The easiest way to add help is to use the pre-built enhanced chat interface:

```tsx
// In your app.tsx or main entry point
import { ChatInterface } from "./chat/chat-interface-with-help";

export function App() {
  return <ChatInterface />;
}
```

This gives you:
- Help button in the header (Ctrl+?)
- Examples button in the header (Ctrl+Shift+E)
- Full-screen help overlay
- Example prompts library
- All keyboard shortcuts

### Option 2: Manually Integrate Components

If you want more control, integrate individual components:

```tsx
import { HelpPanel } from "./help/help-panel";
import { ExamplePrompts } from "./help/example-prompts";

function YourComponent() {
  const [showHelp, setShowHelp] = useState(false);
  const [showExamples, setShowExamples] = useState(false);

  return (
    <>
      {/* Your existing UI */}
      <button onClick={() => setShowHelp(true)}>Help</button>
      <button onClick={() => setShowExamples(true)}>Examples</button>

      {/* Help overlay */}
      {showHelp && (
        <div className="fixed inset-0 z-50">
          <HelpPanel onClose={() => setShowHelp(false)} />
        </div>
      )}

      {/* Examples overlay */}
      {showExamples && (
        <div className="fixed inset-0 z-50">
          <ExamplePrompts
            onPromptSelect={(prompt) => {
              // Handle the selected prompt
              sendMessage(prompt);
              setShowExamples(false);
            }}
            onClose={() => setShowExamples(false)}
          />
        </div>
      )}
    </>
  );
}
```

## Adding Tooltips to Settings

To add help tooltips to your settings panel:

### 1. Import the Tooltip Components

```tsx
import {
  ProviderHelpTooltip,
  ModelHelpTooltip,
  ThinkingModeHelpTooltip,
  ToolApprovalHelpTooltip,
  BashModeHelpTooltip,
  ApiKeyHelpTooltip,
} from "./help/tooltip";
```

### 2. Add Tooltips to Labels

Find each settings label and add the corresponding tooltip:

```tsx
{/* Provider selection */}
<label>
  <span className="flex items-center gap-2 text-xs text-(--chat-text-secondary)">
    Provider
    <ProviderHelpTooltip />
  </span>
  <select>{/* options */}</select>
</label>

{/* Model selection */}
<label>
  <span className="flex items-center gap-2 text-xs text-(--chat-text-secondary)">
    Model
    <ModelHelpTooltip />
  </span>
  <select>{/* options */}</select>
</label>

{/* Thinking mode */}
<div>
  <span className="flex items-center gap-2 text-xs text-(--chat-text-secondary)">
    Thinking Mode
    <ThinkingModeHelpTooltip />
  </span>
  <div className="flex gap-1">
    {/* thinking mode buttons */}
  </div>
</div>
```

### 3. Create Custom Toolips

For settings not covered by preset tooltips:

```tsx
import { HelpTooltip } from "./help/tooltip";

<HelpTooltip
  title="Your Setting Name"
  size="medium"
  content={
    <div>
      <p className="mb-2">Explanation of what this setting does.</p>
      <ul className="space-y-1 list-disc list-inside">
        <li>Option 1: Description</li>
        <li>Option 2: Description</li>
      </ul>
    </div>
  }
/>
```

## Adding Keyboard Shortcuts

Add these keyboard shortcuts to your main component:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ignore if typing in input
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    ) {
      return;
    }

    // Ctrl+?: Toggle help
    if (e.ctrlKey && e.key === "?") {
      e.preventDefault();
      setShowHelp((prev) => !prev);
      return;
    }

    // Ctrl+Shift+E: Toggle examples
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "e") {
      e.preventDefault();
      setShowExamples((prev) => !prev);
      return;
    }

    // Escape: Close help/examples
    if (e.key === "Escape" && (showHelp || showExamples)) {
      e.preventDefault();
      setShowHelp(false);
      setShowExamples(false);
      return;
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [showHelp, showExamples]);
```

## Customizing Help Content

### Modifying FAQ Content

Edit `help-panel.tsx` and update the `FAQS` array:

```tsx
const FAQS: FAQItem[] = [
  {
    id: "my-custom-faq",
    question: "How do I do X?",
    answer: `Here's how to do X:

1. Step one
2. Step two
3. Step three

**Tip**: You can also do Y instead.`,
    category: "Custom Category",
    keywords: ["x", "custom", "how-to"],
  },
  // ... more FAQs
];
```

### Modifying Example Prompts

Edit `example-prompts.tsx` and update the `EXAMPLE_PROMPTS` array:

```tsx
const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    id: "my-custom-prompt",
    text: "Do something amazing with my data",
    description: "Performs an amazing analysis",
    category: "My Custom Category",
  },
  // ... more prompts
];

// Also add to CATEGORIES array
const CATEGORIES = [
  "Data Analysis",
  "Formulas",
  "My Custom Category", // Add your category here
];
```

### Adding Custom Categories

1. Add the category to `CATEGORIES` in `example-prompts.tsx`
2. Create a category icon mapping:

```tsx
const CATEGORY_ICONS: Record<string, typeof Lightbulb> = {
  "Data Analysis": Database,
  "Formulas": Formula,
  "My Custom Category": YourCustomIcon, // Import from lucide-react
};
```

## Styling Customization

All components use CSS custom properties. To customize:

```css
/* In your global CSS or theme file */
:root {
  /* Override default colors */
  --chat-bg: #ffffff;
  --chat-border: #e5e7eb;
  --chat-accent: #3b82f6;
  --chat-text-primary: #111827;
  --chat-text-secondary: #6b7280;
  --chat-text-muted: #9ca3af;
  --chat-font-mono: 'SF Mono', 'Monaco', 'Courier New', monospace;
}

[data-theme="dark"] {
  /* Dark theme overrides */
  --chat-bg: #1f2937;
  --chat-border: #374151;
  --chat-accent: #60a5fa;
  --chat-text-primary: #f9fafb;
  --chat-text-secondary: #d1d5db;
  --chat-text-muted: #9ca3af;
}
```

## Testing the Integration

### Manual Testing Checklist

- [ ] Help button opens help panel
- [ ] Examples button opens examples library
- [ ] Keyboard shortcuts work (Ctrl+?, Ctrl+Shift+E, Escape)
- [ ] Search in help panel finds relevant FAQs
- [ ] Example prompts can be clicked and used
- [ ] Favorites are saved and restored
- [ ] Tooltips appear and disappear correctly
- [ ] Issue reporter creates GitHub issues
- [ ] All modals close on backdrop click
- [ ] All modals close on Escape key
- [ ] Focus is trapped in modals
- [ ] Screen readers announce modal content

### Accessibility Testing

```bash
# Install axe-core for automated accessibility testing
npm install --save-dev @axe-core/react

# Run in your tests
import { axe, toHaveNoViolations } from '@axe-core/react';

expect.extend(toHaveNoViolations);

it('should have no accessibility violations', async () => {
  const { container } = render(<HelpPanel />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## Troubleshooting

### Help Panel Not Opening

**Problem**: Clicking the help button does nothing.

**Solutions**:
1. Check that state is being updated: `setShowHelp(true)`
2. Verify z-index is higher than other content
3. Check browser console for errors

### Tooltips Not Appearing

**Problem**: Tooltip buttons are visible but tooltips don't appear.

**Solutions**:
1. Verify tooltip content is not empty
2. Check z-index of tooltip container
3. Ensure click outside handler is working

### Keyboard Shortcuts Not Working

**Problem**: Pressing Ctrl+? does nothing.

**Solutions**:
1. Ensure event listener is attached
2. Check that input elements are properly filtered
3. Verify preventDefault() is called

### Examples Not Being Sent

**Problem**: Clicking an example doesn't send the message.

**Solutions**:
1. Check that `onPromptSelect` callback is properly connected
2. Verify `sendMessage` function is available
3. Add console.log to debug the flow

## Performance Considerations

- Help components are lazy-loaded by default
- FAQ search is debounced (300ms)
- Favorites are stored in localStorage (not IndexedDB)
- Large lists should use virtualization if needed

## Future Enhancements

Possible improvements to consider:

1. **Video Tutorials**: Embed YouTube videos for complex topics
2. **Interactive Walkthroughs**: Step-by-step guided tours
3. **Context-Aware Help**: Show help based on user's current action
4. **Analytics**: Track which help topics are most accessed
5. **Search History**: Remember user's recent searches
6. **Print-Friendly Version**: Export help as PDF
7. **Offline Support**: Cache help content for offline use
8. **Multi-Language**: Translate help content
9. **Community Contributions**: Allow users to submit examples
10. **AI-Powered Search**: Use semantic search for better results

## Support

For issues or questions about the help system:

1. Check this README
2. Review the component documentation
3. Search existing GitHub issues
4. Create a new issue with the "help-system" label
