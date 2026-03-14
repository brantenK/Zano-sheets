import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  Flame,
  Lightbulb,
  Plus,
  Star,
  Table,
  X,
} from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";

interface ExamplePrompt {
  id: string;
  text: string;
  description: string;
  category: string;
}

interface ExamplePromptsProps {
  onPromptSelect: (prompt: string) => void;
  onClose?: () => void;
}

const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  // Data Analysis
  {
    id: "summarize-data",
    text: "Summarize the data in the selected range and provide key insights.",
    description: "Get an overview of your data with key statistics",
    category: "Data Analysis",
  },
  {
    id: "find-patterns",
    text: "Analyze the data in column B and find any patterns or trends.",
    description: "Discover trends and patterns in your data",
    category: "Data Analysis",
  },
  {
    id: "compare-ranges",
    text: "Compare the data in ranges A1:A10 and B1:B10. What are the key differences?",
    description: "Analyze differences between two data sets",
    category: "Data Analysis",
  },
  {
    id: "find-outliers",
    text: "Identify any outliers or anomalies in the selected data.",
    description: "Find unusual values that might need attention",
    category: "Data Analysis",
  },
  {
    id: "correlation",
    text: "Calculate the correlation between columns A and B and explain what it means.",
    description: "Understand relationships between variables",
    category: "Data Analysis",
  },

  // Formulas
  {
    id: "explain-formula",
    text: "Explain the formula in cell C5 step by step.",
    description: "Understand how complex formulas work",
    category: "Formulas",
  },
  {
    id: "create-vlookup",
    text: "Create a VLOOKUP formula to find prices in column B based on product names in column A.",
    description: "Generate a VLOOKUP formula for your data",
    category: "Formulas",
  },
  {
    id: "nested-if",
    text: "Create a nested IF formula that categorizes values in column A as 'Low', 'Medium', or 'High'.",
    description: "Build conditional logic with nested IFs",
    category: "Formulas",
  },
  {
    id: "index-match",
    text: "Write an INDEX-MATCH formula to look up data more efficiently than VLOOKUP.",
    description: "Use advanced lookup techniques",
    category: "Formulas",
  },
  {
    id: "array-formula",
    text: "Create an array formula to sum all values in column A that meet multiple criteria.",
    description: "Perform complex calculations with array formulas",
    category: "Formulas",
  },

  // Charts & Visualization
  {
    id: "create-bar-chart",
    text: "Create a bar chart showing sales by region from the selected data.",
    description: "Visualize data with a bar chart",
    category: "Charts & Visualization",
  },
  {
    id: "create-line-chart",
    text: "Create a line chart showing the trend of data in column A over time.",
    description: "Display trends with a line chart",
    category: "Charts & Visualization",
  },
  {
    id: "create-pie-chart",
    text: "Create a pie chart showing the distribution of categories in column A.",
    description: "Show proportions with a pie chart",
    category: "Charts & Visualization",
  },
  {
    id: "create-pivot",
    text: "Create a pivot table to summarize sales data by product and region.",
    description: "Summarize data with a pivot table",
    category: "Charts & Visualization",
  },
  {
    id: "conditional-format",
    text: "Apply conditional formatting to highlight cells in column A that are above average.",
    description: "Make important values stand out",
    category: "Charts & Visualization",
  },

  // Data Cleaning
  {
    id: "remove-duplicates",
    text: "Remove duplicate rows from the selected range while keeping the first occurrence.",
    description: "Clean up duplicate data",
    category: "Data Cleaning",
  },
  {
    id: "split-text",
    text: "Split the names in column A into separate first and last name columns.",
    description: "Separate text into multiple columns",
    category: "Data Cleaning",
  },
  {
    id: "standardize-format",
    text: "Standardize the date formats in column A to MM/DD/YYYY.",
    description: "Make data formats consistent",
    category: "Data Cleaning",
  },
  {
    id: "trim-spaces",
    text: "Remove leading and trailing spaces from all cells in the selected range.",
    description: "Clean up whitespace in text",
    category: "Data Cleaning",
  },
  {
    id: "fill-blanks",
    text: "Fill blank cells in column A with the value from the cell above.",
    description: "Complete incomplete data sets",
    category: "Data Cleaning",
  },

  // Productivity
  {
    id: "create-budget",
    text: "Create a budget template with income, expenses, and savings categories.",
    description: "Set up a personal budget tracker",
    category: "Productivity",
  },
  {
    id: "create-invoice",
    text: "Create an invoice template with line items, totals, and tax calculation.",
    description: "Generate a professional invoice",
    category: "Productivity",
  },
  {
    id: "create-calendar",
    text: "Create a calendar view for the selected month with dates in column A.",
    description: "Build a calendar from your data",
    category: "Productivity",
  },
  {
    id: "create-dashboard",
    text: "Create a dashboard with key metrics and charts from this data.",
    description: "Build a summary dashboard",
    category: "Productivity",
  },
  {
    id: "automate-task",
    text: "Create a macro or formula to automatically calculate commissions based on sales in column A.",
    description: "Automate repetitive calculations",
    category: "Productivity",
  },
];

const CATEGORIES = Array.from(new Set(EXAMPLE_PROMPTS.map((p) => p.category)));

const CATEGORY_ICONS: Record<string, typeof Lightbulb> = {
  "Data Analysis": Database,
  Formulas: Lightbulb,
  "Charts & Visualization": BarChart3,
  "Data Cleaning": Table,
  Productivity: Lightbulb,
};

const FAVORITES_KEY = "zanosheets-favorite-prompts";

export function ExamplePrompts({
  onPromptSelect,
  onClose,
}: ExamplePromptsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES.slice(0, 2)), // Expand first 2 categories by default
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) {
        setFavorites(new Set(JSON.parse(saved)));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save favorites to localStorage
  const saveFavorites = useCallback((newFavorites: Set<string>) => {
    try {
      localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(Array.from(newFavorites)),
      );
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      const newFavorites = new Set(favorites);
      if (newFavorites.has(id)) {
        newFavorites.delete(id);
      } else {
        newFavorites.add(id);
      }
      setFavorites(newFavorites);
      saveFavorites(newFavorites);
    },
    [favorites, saveFavorites],
  );

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const filteredPrompts = EXAMPLE_PROMPTS.filter((prompt) => {
    const query = searchQuery.toLowerCase();
    return (
      prompt.text.toLowerCase().includes(query) ||
      prompt.description.toLowerCase().includes(query) ||
      prompt.category.toLowerCase().includes(query)
    );
  });

  const groupedPrompts = searchQuery
    ? { All: filteredPrompts }
    : Object.fromEntries(
        CATEGORIES.map((cat) => [
          cat,
          filteredPrompts.filter((p) => p.category === cat),
        ]),
      );

  const handleUsePrompt = useCallback(
    (prompt: string) => {
      onPromptSelect(prompt);
      if (onClose) {
        onClose();
      }
    },
    [onPromptSelect, onClose],
  );

  const handleCopyPrompt = useCallback((prompt: ExamplePrompt) => {
    navigator.clipboard.writeText(prompt.text);
    setCopiedId(prompt.id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const favoritePrompts = EXAMPLE_PROMPTS.filter((p) => favorites.has(p.id));

  return (
    <div className="example-prompts flex flex-col h-full bg-(--chat-bg)">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--chat-border)">
        <div className="flex items-center gap-2">
          <Lightbulb size={18} className="text-(--chat-accent)" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-(--chat-text-primary)">
            Example Prompts
          </h2>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
            aria-label="Close examples"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-(--chat-border)">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search examples..."
          className="w-full px-3 py-2 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded focus:outline-none focus:ring-1 focus:ring-(--chat-accent) text-(--chat-text-primary) placeholder-(--chat-text-muted)"
          style={{ fontFamily: "var(--chat-font-mono)" }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* Favorites Section */}
        {!searchQuery && favoritePrompts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Flame size={14} className="text-(--chat-accent)" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary)">
                Favorites
              </h3>
              <span className="text-xs text-(--chat-text-muted)">
                ({favoritePrompts.length})
              </span>
            </div>
            <div className="space-y-2">
              {favoritePrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  onUse={handleUsePrompt}
                  onCopy={handleCopyPrompt}
                  onToggleFavorite={toggleFavorite}
                  isFavorite={favorites.has(prompt.id)}
                  isCopied={copiedId === prompt.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="space-y-4">
          {Object.entries(groupedPrompts).map(([category, prompts]) => {
            if (prompts.length === 0) return null;

            const Icon = CATEGORY_ICONS[category] || Lightbulb;
            const isExpanded =
              searchQuery.length > 0 || expandedCategories.has(category);

            return (
              <div key={category}>
                <button
                  type="button"
                  onClick={() => !searchQuery && toggleCategory(category)}
                  className="flex items-center gap-2 w-full text-left mb-2 group disabled:cursor-default"
                  disabled={searchQuery.length > 0}
                >
                  {searchQuery.length === 0 ? (
                    isExpanded ? (
                      <ChevronDown size={14} className="text-(--chat-accent)" />
                    ) : (
                      <ChevronRight
                        size={14}
                        className="text-(--chat-text-muted)"
                      />
                    )
                  ) : null}
                  <Icon size={14} className="text-(--chat-accent)" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary)">
                    {category}
                  </h3>
                  <span className="text-xs text-(--chat-text-muted)">
                    ({prompts.length})
                  </span>
                </button>

                {isExpanded && (
                  <div className="space-y-2 ml-6">
                    {prompts.map((prompt) => (
                      <PromptCard
                        key={prompt.id}
                        prompt={prompt}
                        onUse={handleUsePrompt}
                        onCopy={handleCopyPrompt}
                        onToggleFavorite={toggleFavorite}
                        isFavorite={favorites.has(prompt.id)}
                        isCopied={copiedId === prompt.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PromptCard({
  prompt,
  onUse,
  onCopy,
  onToggleFavorite,
  isFavorite,
  isCopied,
}: {
  prompt: ExamplePrompt;
  onUse: (prompt: string) => void;
  onCopy: (prompt: ExamplePrompt) => void;
  onToggleFavorite: (id: string) => void;
  isFavorite: boolean;
  isCopied: boolean;
}) {
  return (
    <div className="p-3 bg-(--chat-bg-secondary) border border-(--chat-border) rounded hover:border-(--chat-accent) transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs text-(--chat-text-primary) font-medium flex-1">
          {prompt.description}
        </p>
        <button
          type="button"
          onClick={() => onToggleFavorite(prompt.id)}
          className={`p-1 transition-colors shrink-0 ${
            isFavorite
              ? "text-(--chat-accent)"
              : "text-(--chat-text-muted) hover:text-(--chat-accent)"
          }`}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={12} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>
      <p className="text-xs text-(--chat-text-secondary) mb-3 line-clamp-2">
        &quot;{prompt.text}&quot;
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onUse(prompt.text)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-(--chat-accent) text-white text-xs font-medium rounded hover:opacity-90 transition-opacity"
        >
          <Plus size={12} />
          Use This
        </button>
        <button
          type="button"
          onClick={() => onCopy(prompt)}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-(--chat-bg) border border-(--chat-border) text-(--chat-text-secondary) text-xs rounded hover:text-(--chat-text-primary) transition-colors"
        >
          {isCopied ? (
            <>
              <Copy size={12} />
              Copied!
            </>
          ) : (
            <>
              <Copy size={12} />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
