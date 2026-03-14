import {
  BookOpen,
  Bug,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Github,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Search,
  Shield,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface HelpPanelProps {
  onClose: () => void;
  onExamplePrompt?: (prompt: string) => void;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
}

const FAQS: FAQItem[] = [
  {
    id: "data-usage",
    question: "How is my data used?",
    answer:
      "Your Excel data stays in Excel. Only your prompts and selected cell contents are sent to AI providers. We never send your entire workbook unless you explicitly select a range. All data is transmitted securely over HTTPS.",
    category: "Privacy & Security",
    keywords: ["data", "privacy", "security", "sent", "transmitted"],
  },
  {
    id: "provider-choice",
    question: "Which AI provider should I choose?",
    answer:
      "Each provider has strengths:\n\n• **Claude (Anthropic)** - Excellent at complex reasoning and analysis\n• **GPT-4 (OpenAI)** - Great for general tasks and coding\n• **Gemini (Google)** - Strong at multi-modal tasks\n\nStart with Claude for Excel work - it handles data analysis particularly well.",
    category: "Getting Started",
    keywords: [
      "provider",
      "ai",
      "model",
      "choose",
      "selection",
      "anthropic",
      "openai",
      "google",
    ],
  },
  {
    id: "thinking-mode",
    question: "What are thinking modes?",
    answer:
      "Thinking modes control how much time the AI spends reasoning before responding:\n\n• **None** - Fast responses, minimal internal reasoning\n• **Low** - Quick reasoning for simple tasks\n• **Medium** - Balanced reasoning for most tasks\n• **High** - Deep reasoning for complex analysis\n\nHigher modes take longer but produce better results for complex tasks.",
    category: "Features",
    keywords: ["thinking", "mode", "reasoning", "time", "speed"],
  },
  {
    id: "tool-approval",
    question: "What are tool approval modes?",
    answer:
      "Tool approval controls when the AI can perform actions in Excel:\n\n• **Always Approve** - AI performs actions without asking (fastest)\n• **Manual Approval** - You approve each action (safest)\n• **Smart Approval** - AI asks only for risky actions\n\nStart with Manual Approval until you trust the system.",
    category: "Safety",
    keywords: ["approval", "tool", "permission", "safe", "security", "action"],
  },
  {
    id: "bash-mode",
    question: "What are bash modes?",
    answer:
      "Bash modes control code execution:\n\n• **Disabled** - No code execution (safest)\n• **Read-only** - Can read files but not modify\n• **Full** - Can execute any code\n\nUse Read-only for exploring data. Only use Full if you understand the risks.",
    category: "Safety",
    keywords: ["bash", "code", "execute", "run", "terminal", "command"],
  },
  {
    id: "api-key",
    question: "How do I add an API key?",
    answer:
      "1. Go to Settings (click the gear icon)\n2. Find your provider section\n3. Click 'Set API Key'\n4. Enter your key\n5. Choose storage mode:\n   - **Browser Storage** - Convenient, stays in browser\n   - **Session Only** - Cleared when Excel closes\n\nYour keys are encrypted and never sent to our servers.",
    category: "Setup",
    keywords: ["api", "key", "setup", "configure", "add"],
  },
  {
    id: "cost-control",
    question: "How can I control costs?",
    answer:
      "• Use **Thinking: None** for simple tasks\n• Start with **GPT-3.5** instead of GPT-4\n• Enable **Prompt Caching** (reduces costs by ~90%)\n• Monitor token usage in the status bar\n• Use Manual Approval to avoid unintended actions\n\nThe status bar shows real-time cost tracking.",
    category: "Tips",
    keywords: ["cost", "money", "price", "token", "save", "reduce"],
  },
  {
    id: "error-help",
    question: "I'm getting an error. What should I do?",
    answer:
      "1. Check the error message for specific details\n2. Verify your API key is valid in Settings\n3. Try switching to a different provider/model\n4. Check if you're rate-limited (wait a minute)\n5. Click 'Report a Problem' to get help\n\nCommon errors:\n• 401 - Invalid API key\n• 429 - Rate limit exceeded\n• 500 - Provider temporarily down",
    category: "Troubleshooting",
    keywords: ["error", "problem", "issue", "fail", "trouble", "fix"],
  },
  {
    id: "examples",
    question: "What can I ask Zano Sheets to do?",
    answer:
      "Here are some examples:\n\n**Data Analysis:**\n• 'Summarize the sales data in column B'\n• 'Find patterns in this customer list'\n• 'Compare Q1 and Q2 performance'\n\n**Formulas:**\n• 'Explain the formula in C5'\n• 'Create a VLOOKUP for these names'\n• 'Build a pivot table from this data'\n\n**Charts:**\n• 'Create a bar chart of sales by region'\n• 'Plot a trend line for this data'\n\nSee the Example Prompts section for more!",
    category: "Getting Started",
    keywords: ["example", "ask", "prompt", "what", "can", "do"],
  },
];

export function HelpPanel({ onClose, onExamplePrompt }: HelpPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Filter FAQs based on search
  const filteredFaqs = useCallback(() => {
    if (!searchQuery.trim()) {
      return FAQS;
    }

    const query = searchQuery.toLowerCase();
    return FAQS.filter(
      (faq) =>
        faq.question.toLowerCase().includes(query) ||
        faq.answer.toLowerCase().includes(query) ||
        faq.keywords.some((kw) => kw.includes(query)),
    );
  }, [searchQuery]);

  // Group FAQs by category
  const faqsByCategory = useCallback(() => {
    const filtered = filteredFaqs();
    const grouped: Record<string, FAQItem[]> = {};

    filtered.forEach((faq) => {
      if (!grouped[faq.category]) {
        grouped[faq.category] = [];
      }
      grouped[faq.category].push(faq);
    });

    return grouped;
  }, [filteredFaqs]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (searchQuery) {
        clearSearch();
      } else {
        onClose();
      }
    }
  };

  const toggleFaq = (id: string) => {
    setExpandedFaq((prev) => (prev === id ? null : id));
  };

  const toggleCategory = (category: string) => {
    setExpandedCategory((prev) => (prev === category ? null : category));
  };

  const groupedFaqs = faqsByCategory();
  const hasResults = Object.keys(groupedFaqs).length > 0;

  return (
    <div className="help-panel flex flex-col h-full bg-(--chat-bg)">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--chat-border)">
        <div className="flex items-center gap-2">
          <HelpCircle size={18} className="text-(--chat-accent)" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-(--chat-text-primary)">
            Help & Support
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
          aria-label="Close help"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-(--chat-border)">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-(--chat-text-muted)"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder="Search help... (Esc to close)"
            className="w-full pl-9 pr-8 py-2 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded focus:outline-none focus:ring-1 focus:ring-(--chat-accent) text-(--chat-text-primary) placeholder-(--chat-text-muted)"
            style={{ fontFamily: "var(--chat-font-mono)" }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!hasResults ? (
          <div className="flex flex-col items-center justify-center py-12 text-(--chat-text-muted)">
            <Search size={32} className="mb-3 opacity-50" />
            <p className="text-xs">
              No results found for &quot;{searchQuery}&quot;
            </p>
            <p className="text-xs mt-1">Try different keywords</p>
          </div>
        ) : (
          <>
            {/* Quick Links */}
            {!searchQuery && (
              <div className="mb-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-3">
                  Quick Links
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  <QuickLinkButton
                    icon={Lightbulb}
                    title="Getting Started"
                    description="New to Zano Sheets? Start here."
                    onClick={() => toggleCategory("Getting Started")}
                  />
                  <QuickLinkButton
                    icon={Shield}
                    title="Understanding Safety"
                    description="Learn about approval modes and security."
                    onClick={() => toggleCategory("Safety")}
                  />
                  <QuickLinkButton
                    icon={BookOpen}
                    title="Example Prompts"
                    description="See what you can ask Zano Sheets."
                    onClick={() => {
                      if (onExamplePrompt) {
                        onExamplePrompt("");
                      }
                    }}
                  />
                  <QuickLinkButton
                    icon={Bug}
                    title="Report a Problem"
                    description="Found an issue? Let us know."
                    onClick={() => {
                      const reportSection =
                        document.getElementById("issue-reporter");
                      reportSection?.scrollIntoView({ behavior: "smooth" });
                    }}
                  />
                </div>
              </div>
            )}

            {/* FAQs by Category */}
            <div className="space-y-4">
              {Object.entries(groupedFaqs).map(([category, faqs]) => (
                <div key={category}>
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-2 w-full text-left mb-2 group"
                  >
                    {expandedCategory === category ? (
                      <ChevronDown size={14} className="text-(--chat-accent)" />
                    ) : (
                      <ChevronRight
                        size={14}
                        className="text-(--chat-text-muted)"
                      />
                    )}
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) group-hover:text-(--chat-text-primary) transition-colors">
                      {category}
                    </h3>
                    <span className="text-xs text-(--chat-text-muted)">
                      ({faqs.length})
                    </span>
                  </button>

                  {expandedCategory === category || searchQuery ? (
                    <div className="space-y-2 ml-4">
                      {faqs.map((faq) => (
                        <FAQItem
                          key={faq.id}
                          faq={faq}
                          isExpanded={expandedFaq === faq.id}
                          onToggle={() => toggleFaq(faq.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Documentation Links */}
            {!searchQuery && (
              <div className="mt-6 pt-6 border-t border-(--chat-border)">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-3">
                  Documentation
                </h3>
                <div className="space-y-2">
                  <DocLink
                    href="https://github.com/brantenK/Zano-sheets/blob/main/docs/ARCHITECTURE.md"
                    title="Architecture Documentation"
                    icon={FileText}
                  />
                  <DocLink
                    href="https://github.com/brantenK/Zano-sheets/blob/main/docs/TROUBLESHOOTING.md"
                    title="Troubleshooting Guide"
                    icon={MessageSquare}
                  />
                  <DocLink
                    href="https://github.com/brantenK/Zano-sheets/issues"
                    title="GitHub Issues"
                    icon={Github}
                  />
                  <DocLink
                    href="https://github.com/brantenK/Zano-sheets/discussions"
                    title="Community Discussions"
                    icon={MessageSquare}
                  />
                </div>
              </div>
            )}

            {/* Issue Reporter */}
            {!searchQuery && (
              <div
                id="issue-reporter"
                className="mt-6 pt-6 border-t border-(--chat-border)"
              >
                <h3 className="text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-3">
                  Still Need Help?
                </h3>
                <IssueReporter />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FAQItem({
  faq,
  isExpanded,
  onToggle,
}: {
  faq: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-(--chat-border) rounded overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-start gap-2 w-full text-left px-3 py-2 hover:bg-(--chat-bg-secondary) transition-colors"
      >
        <HelpCircle
          size={14}
          className={`mt-0.5 shrink-0 transition-colors ${
            isExpanded ? "text-(--chat-accent)" : "text-(--chat-text-muted)"
          }`}
        />
        <span className="text-xs text-(--chat-text-primary) flex-1">
          {faq.question}
        </span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 ml-6">
          <div className="text-xs text-(--chat-text-secondary) whitespace-pre-wrap leading-relaxed">
            {faq.answer}
          </div>
        </div>
      )}
    </div>
  );
}

function QuickLinkButton({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof HelpCircle;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 p-3 bg-(--chat-bg-secondary) border border-(--chat-border) rounded hover:border-(--chat-accent) transition-colors text-left group"
    >
      <Icon size={16} className="text-(--chat-accent) shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-(--chat-text-primary) group-hover:text-(--chat-accent) transition-colors">
          {title}
        </div>
        <div className="text-xs text-(--chat-text-muted) mt-0.5">
          {description}
        </div>
      </div>
    </button>
  );
}

function DocLink({
  href,
  title,
  icon: Icon,
}: {
  href: string;
  title: string;
  icon: typeof FileText;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-xs text-(--chat-accent) hover:text-(--chat-text-primary) transition-colors"
    >
      <Icon size={14} />
      <span className="flex-1">{title}</span>
      <ExternalLink size={12} />
    </a>
  );
}

function IssueReporter() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-(--chat-text-secondary)">
        Found a bug or have a suggestion? Help us improve by reporting it.
      </p>
      <div className="flex gap-2">
        <a
          href="https://github.com/brantenK/Zano-sheets/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-(--chat-accent) text-white text-xs font-medium rounded hover:opacity-90 transition-opacity"
        >
          <Github size={14} />
          Create GitHub Issue
        </a>
      </div>
    </div>
  );
}
