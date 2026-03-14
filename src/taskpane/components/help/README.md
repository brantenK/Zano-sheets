# Help & Support System

A comprehensive in-app help system for Zano Sheets that provides context-aware guidance and support resources.

## Features

### 1. Help Panel
- **Searchable FAQ**: Full-text search across all help content
- **Categorized Content**: Organized by topic (Getting Started, Safety, Features, etc.)
- **Quick Links**: Fast access to common help topics
- **Documentation Links**: Direct links to GitHub docs and troubleshooting guides
- **Issue Reporting**: Built-in problem reporting with pre-filled GitHub issues

### 2. Interactive Tooltips
Context-sensitive help buttons that explain complex features:
- **Provider Selection**: Which AI provider to choose and why
- **Model Selection**: Understanding different model capabilities and costs
- **Thinking Modes**: How thinking levels affect response quality and speed
- **Tool Approval**: Understanding the different approval modes
- **Bash Modes**: Code execution security levels
- **API Key Storage**: How API keys are stored and protected

### 3. Example Prompts Library
- **Categorized Examples**: Data Analysis, Formulas, Charts, Data Cleaning, Productivity
- **One-Click Use**: Click any example to use it immediately
- **Favorites System**: Save your most-used prompts
- **Search**: Filter examples by keyword
- **Copy to Clipboard**: Quick copy for manual pasting

### 4. Issue Reporter
- **Structured Forms**: Different forms for bugs, features, performance, and security issues
- **Severity Levels**: Low, Medium, High, Critical
- **System Details**: Automatically includes provider, model, OS, and Excel version
- **GitHub Integration**: Creates pre-filled GitHub issues with one click
- **Email Support**: Alternative contact method for sensitive issues

## Components

### HelpPanel
Main help panel with searchable FAQ and quick links.

```tsx
import { HelpPanel } from "./help";

<HelpPanel
  onClose={() => setShowHelp(false)}
  onExamplePrompt={(prompt) => sendMessage(prompt)}
/>
```

### HelpTooltip
Reusable tooltip component for contextual help.

```tsx
import { HelpTooltip } from "./help";

<HelpTooltip
  title="Feature Name"
  content="Detailed explanation of the feature"
/>
```

### Preset Tooltips
Pre-configured tooltips for common settings:

```tsx
import {
  ProviderHelpTooltip,
  ModelHelpTooltip,
  ThinkingModeHelpTooltip,
  ToolApprovalHelpTooltip,
  BashModeHelpTooltip,
  ApiKeyHelpTooltip,
} from "./help";

// Usage
<label>
  Provider
  <ProviderHelpTooltip />
</label>
```

### ExamplePrompts
Browsable library of example prompts.

```tsx
import { ExamplePrompts } from "./help";

<ExamplePrompts
  onPromptSelect={(prompt) => sendMessage(prompt)}
  onClose={() => setShowExamples(false)}
/>
```

### IssueReporter
Form for reporting bugs and requesting features.

```tsx
import { IssueReporter } from "./help";

<IssueReporter onClose={() => setShowReporter(false)} />
```

## Integration

### Adding to Chat Interface

1. **Import the components**:
```tsx
import {
  HelpPanel,
  ExamplePrompts,
} from "../help";
```

2. **Add state for help views**:
```tsx
const [helpView, setHelpView] = useState<'help' | 'examples' | null>(null);
```

3. **Add help buttons to header**:
```tsx
<button onClick={() => setHelpView('help')}>
  <HelpCircle size={14} />
</button>
<button onClick={() => setHelpView('examples')}>
  <Lightbulb size={14} />
</button>
```

4. **Render the help overlay**:
```tsx
{helpView && (
  <div className="absolute inset-0 z-40 bg-(--chat-bg)">
    {helpView === 'help' ? (
      <HelpPanel onClose={() => setHelpView(null)} />
    ) : (
      <ExamplePrompts
        onPromptSelect={handlePrompt}
        onClose={() => setHelpView(null)}
      />
    )}
  </div>
)}
```

### Adding Keyboard Shortcuts

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+?: Open help
    if (e.ctrlKey && e.key === "?") {
      e.preventDefault();
      setHelpView(v => v === 'help' ? null : 'help');
    }

    // Ctrl+Shift+E: Open examples
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'e') {
      e.preventDefault();
      setHelpView(v => v === 'examples' ? null : 'examples');
    }

    // Escape: Close help
    if (e.key === 'Escape' && helpView) {
      e.preventDefault();
      setHelpView(null);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [helpView]);
```

### Adding Tooltips to Settings

Replace static labels with labels that include tooltips:

```tsx
// Before
<span className="text-xs text-(--chat-text-secondary)">
  Provider
</span>

// After
<span className="flex items-center gap-2 text-xs text-(--chat-text-secondary)">
  Provider
  <ProviderHelpTooltip />
</span>
```

## Content Management

### Adding FAQ Items

Edit `help-panel.tsx` and add to the `FAQS` array:

```tsx
{
  id: "unique-id",
  question: "Your question?",
  answer: "Your detailed answer with **markdown** formatting.",
  category: "Category Name",
  keywords: ["search", "keywords"],
}
```

### Adding Example Prompts

Edit `example-prompts.tsx` and add to the `EXAMPLE_PROMPTS` array:

```tsx
{
  id: "unique-id",
  text: "The actual prompt text",
  description: "What this prompt does",
  category: "Category Name",
}
```

## Styling

All help components use TailwindCSS with CSS custom properties for theming:

- `--chat-bg`: Background color
- `--chat-border`: Border color
- `--chat-accent`: Accent color (brand color)
- `--chat-text-primary`: Primary text color
- `--chat-text-secondary`: Secondary text color
- `--chat-text-muted`: Muted text color
- `--chat-font-mono`: Monospace font family

## Accessibility

- **Keyboard Navigation**: All help features are keyboard accessible
- **ARIA Labels**: Proper labeling for screen readers
- **Focus Management**: Focus is trapped in modals
- **Semantic HTML**: Proper heading hierarchy and landmarks
- **Color Contrast**: WCAG AA compliant contrast ratios

## Performance

- **Lazy Loading**: Help components are loaded on demand
- **LocalStorage**: Favorites and preferences persist locally
- **Search Optimization**: Debounced search for better performance
- **Virtual Scrolling**: Large lists use virtual scrolling (if needed)

## Future Enhancements

- [ ] Video tutorials integration
- [ ] Interactive walkthroughs
- [ ] Community-contributed examples
- [ ] Multi-language support
- [ ] Context-aware help suggestions
- [ ] Help analytics to improve content
- [ ] Integration with customer support chat
