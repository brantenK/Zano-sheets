# Help System - Quick Start Guide

## 5-Minute Integration

### Step 1: Choose Your Integration Method

**Option A: Use the Pre-Built Enhanced Interface (Easiest)**
```tsx
// In your app.tsx
import { ChatInterface } from "./chat/chat-interface-with-help";

export function App() {
  return <ChatInterface />;
}
```

✅ Done! You now have:
- Help button (Ctrl+?)
- Examples button (Ctrl+Shift+E)
- Full help system
- All keyboard shortcuts

**Option B: Add Help to Existing Interface**
```tsx
// 1. Import components
import { HelpPanel, ExamplePrompts } from "./help";

// 2. Add state
const [showHelp, setShowHelp] = useState(false);

// 3. Add button to your header
<button onClick={() => setShowHelp(true)}>
  <HelpCircle size={14} />
</button>

// 4. Render overlay
{showHelp && (
  <div className="fixed inset-0 z-50">
    <HelpPanel onClose={() => setShowHelp(false)} />
  </div>
)}
```

### Step 2: Add Tooltips to Settings (Optional)

```tsx
// Import preset tooltips
import {
  ProviderHelpTooltip,
  ModelHelpTooltip,
  ThinkingModeHelpTooltip,
} from "./help";

// Add to labels in your settings panel
<label>
  <span className="flex items-center gap-2">
    Provider
    <ProviderHelpTooltip />
  </span>
  <select>...</select>
</label>
```

### Step 3: Customize Content (Optional)

**Add FAQ Items:**
```tsx
// In help-panel.tsx, add to FAQS array
{
  id: "my-faq",
  question: "How do I...?",
  answer: "Here's how...",
  category: "My Category",
  keywords: ["search", "terms"],
}
```

**Add Example Prompts:**
```tsx
// In example-prompts.tsx, add to EXAMPLE_PROMPTS array
{
  id: "my-prompt",
  text: "Do something amazing",
  description: "Performs amazing task",
  category: "My Category",
}
```

## Testing

1. **Open Help**: Click help button or press `Ctrl+?`
2. **Search**: Type "provider" in search box
3. **Use Example**: Click any example prompt
4. **Report Issue**: Click "Create GitHub Issue"
5. **Keyboard**: Press `Escape` to close modals

## File Structure

```
src/taskpane/components/help/
├── help-panel.tsx          # Main help panel with FAQ
├── tooltip.tsx             # Tooltip components
├── example-prompts.tsx     # Example prompts library
├── issue-reporter.tsx      # Bug/feature reporting
├── index.ts                # Exports
├── README.md               # Full documentation
├── INTEGRATION.md          # Integration guide
└── QUICKSTART.md           # This file
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+?` | Open/close help |
| `Ctrl+Shift+E` | Open/close examples |
| `Escape` | Close any modal |
| `/` (in help) | Focus search |

## Common Tasks

### Add a new tooltip for a custom setting
```tsx
import { HelpTooltip } from "./help";

<HelpTooltip
  title="My Setting"
  content="Explanation of my setting"
/>
```

### Change tooltip position
```tsx
<HelpTooltip
  placement="bottom"  // top, bottom, left, right
  content="..."
/>
```

### Change tooltip size
```tsx
<HelpTooltip
  size="large"  // small, medium, large
  content="..."
/>
```

## Support

- 📖 Full docs: `README.md`
- 🔧 Integration guide: `INTEGRATION.md`
- 📝 Summary: `docs/HELP_SYSTEM_SUMMARY.md`
- 🐛 Issues: GitHub issues

## Checklist

- [ ] Import help components
- [ ] Add help button to header
- [ ] Add state for help view
- [ ] Render help overlay
- [ ] Test keyboard shortcuts
- [ ] Add tooltips to settings (optional)
- [ ] Customize FAQ content (optional)
- [ ] Add example prompts (optional)

That's it! You now have a comprehensive help system. 🎉
