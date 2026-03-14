import {
  AlertTriangle,
  Bug,
  ChevronDown,
  ChevronUp,
  Github,
  Loader2,
  Mail,
} from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";

interface IssueReporterProps {
  onClose?: () => void;
}

type IssueType = "bug" | "feature" | "performance" | "security";
type IssueSeverity = "low" | "medium" | "high" | "critical";

interface IssueFormData {
  type: IssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  steps: string;
  expectedBehavior: string;
  actualBehavior: string;
  includeSystemDetails: boolean;
  includeTelemetry: boolean;
  email: string;
}

const ISSUE_TYPES: Record<IssueType, { label: string; icon: typeof Bug }> = {
  bug: { label: "Bug Report", icon: Bug },
  feature: { label: "Feature Request", icon: ChevronUp },
  performance: { label: "Performance Issue", icon: AlertTriangle },
  security: { label: "Security Issue", icon: AlertTriangle },
};

const SEVERITY_LEVELS: Record<IssueSeverity, { label: string; color: string }> =
  {
    low: { label: "Low", color: "text-(--chat-text-secondary)" },
    medium: { label: "Medium", color: "text-yellow-600" },
    high: { label: "High", color: "text-orange-600" },
    critical: { label: "Critical", color: "text-(--chat-error)" },
  };

export function IssueReporter({ onClose }: IssueReporterProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState<IssueFormData>({
    type: "bug",
    severity: "medium",
    title: "",
    description: "",
    steps: "",
    expectedBehavior: "",
    actualBehavior: "",
    includeSystemDetails: true,
    includeTelemetry: false,
    email: "",
  });

  const handleChange = useCallback(
    (field: keyof IssueFormData, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const generateGitHubUrl = useCallback(() => {
    const systemDetails = formData.includeSystemDetails
      ? getSystemDetails()
      : null;

    let body = `## ${ISSUE_TYPES[formData.type].label}\n\n`;
    body += `### Description\n${formData.description}\n\n`;

    if (formData.type === "bug") {
      if (formData.steps) {
        body += `### Steps to Reproduce\n${formData.steps}\n\n`;
      }
      if (formData.expectedBehavior) {
        body += `### Expected Behavior\n${formData.expectedBehavior}\n\n`;
      }
      if (formData.actualBehavior) {
        body += `### Actual Behavior\n${formData.actualBehavior}\n\n`;
      }
    } else if (formData.type === "feature") {
      if (formData.actualBehavior) {
        body += `### Proposed Solution\n${formData.actualBehavior}\n\n`;
      }
    }

    if (systemDetails) {
      body += `### System Details\n\`\`\`\n${systemDetails}\n\`\`\`\n\n`;
    }

    body += `### Severity\n${formData.severity.toUpperCase()}\n\n`;

    if (formData.email) {
      body += `### Contact\n${formData.email}\n`;
    }

    const params = new URLSearchParams({
      title: formData.title || `[${formData.type}] Issue from Zano Sheets`,
      body,
      labels: [formData.type, formData.severity].join(","),
    });

    return `https://github.com/brantenK/Zano-sheets/issues/new?${params.toString()}`;
  }, [formData]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setIsSubmitting(true);

      const url = generateGitHubUrl();
      window.open(url, "_blank");

      setIsSubmitting(false);
      onClose?.();
    },
    [generateGitHubUrl, onClose],
  );

  const isValid =
    formData.title.trim().length > 0 && formData.description.trim().length > 0;

  return (
    <div className="issue-reporter">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Issue Type Selection */}
        <fieldset>
          <legend className="block text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-2">
            Issue Type
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ISSUE_TYPES).map(
              ([type, { label, icon: Icon }]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleChange("type", type)}
                  className={`
                  flex items-center gap-2 px-3 py-2 text-xs rounded border transition-colors
                  ${
                    formData.type === type
                      ? "border-(--chat-accent) bg-(--chat-accent)/10 text-(--chat-accent)"
                      : "border-(--chat-border) text-(--chat-text-secondary) hover:border-(--chat-accent)"
                  }
                `}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ),
            )}
          </div>
        </fieldset>

        {/* Severity Selection */}
        <fieldset>
          <legend className="block text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-2">
            Severity
          </legend>
          <div className="flex gap-2">
            {Object.entries(SEVERITY_LEVELS).map(
              ([level, { label, color }]) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleChange("severity", level)}
                  className={`
                  flex-1 px-3 py-2 text-xs rounded border transition-colors
                  ${
                    formData.severity === level
                      ? "border-(--chat-accent) bg-(--chat-accent)/10 text-(--chat-accent)"
                      : `border-(--chat-border) ${color} hover:border-(--chat-accent)`
                  }
                `}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </fieldset>

        {/* Title */}
        <div>
          <label
            htmlFor="issue-title"
            className="block text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-2"
          >
            Title *
          </label>
          <input
            id="issue-title"
            type="text"
            value={formData.title}
            onChange={(e) => handleChange("title", e.target.value)}
            placeholder="Brief description of the issue"
            className="w-full px-3 py-2 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded focus:outline-none focus:ring-1 focus:ring-(--chat-accent) text-(--chat-text-primary) placeholder-(--chat-text-muted)"
            style={{ fontFamily: "var(--chat-font-mono)" }}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label
            htmlFor="issue-description"
            className="block text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-2"
          >
            Description *
          </label>
          <textarea
            id="issue-description"
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Describe the issue or feature request in detail"
            rows={4}
            className="w-full px-3 py-2 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded focus:outline-none focus:ring-1 focus:ring-(--chat-accent) text-(--chat-text-primary) placeholder-(--chat-text-muted) resize-y"
            style={{ fontFamily: "var(--chat-font-mono)" }}
            required
          />
        </div>

        {/* Bug-specific fields */}
        {formData.type === "bug" && (
          <>
            <div>
              <label
                htmlFor="issue-steps"
                className="block text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-2"
              >
                Steps to Reproduce
              </label>
              <textarea
                id="issue-steps"
                value={formData.steps}
                onChange={(e) => handleChange("steps", e.target.value)}
                placeholder="1. First step&#10;2. Second step&#10;3. ..."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded focus:outline-none focus:ring-1 focus:ring-(--chat-accent) text-(--chat-text-primary) placeholder-(--chat-text-muted) resize-y"
                style={{ fontFamily: "var(--chat-font-mono)" }}
              />
            </div>

            <div>
              <label
                htmlFor="issue-expected"
                className="block text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-2"
              >
                Expected Behavior
              </label>
              <textarea
                id="issue-expected"
                value={formData.expectedBehavior}
                onChange={(e) =>
                  handleChange("expectedBehavior", e.target.value)
                }
                placeholder="What should have happened?"
                rows={2}
                className="w-full px-3 py-2 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded focus:outline-none focus:ring-1 focus:ring-(--chat-accent) text-(--chat-text-primary) placeholder-(--chat-text-muted) resize-y"
                style={{ fontFamily: "var(--chat-font-mono)" }}
              />
            </div>

            <div>
              <label
                htmlFor="issue-actual"
                className="block text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-2"
              >
                Actual Behavior
              </label>
              <textarea
                id="issue-actual"
                value={formData.actualBehavior}
                onChange={(e) => handleChange("actualBehavior", e.target.value)}
                placeholder="What actually happened?"
                rows={2}
                className="w-full px-3 py-2 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded focus:outline-none focus:ring-1 focus:ring-(--chat-accent) text-(--chat-text-primary) placeholder-(--chat-text-muted) resize-y"
                style={{ fontFamily: "var(--chat-font-mono)" }}
              />
            </div>
          </>
        )}

        {/* Feature-specific fields */}
        {formData.type === "feature" && (
          <div>
            <label
              htmlFor="issue-proposed"
              className="block text-xs font-semibold uppercase tracking-wider text-(--chat-text-secondary) mb-2"
            >
              Proposed Solution
            </label>
            <textarea
              id="issue-proposed"
              value={formData.actualBehavior}
              onChange={(e) => handleChange("actualBehavior", e.target.value)}
              placeholder="How would you like this feature to work?"
              rows={3}
              className="w-full px-3 py-2 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded focus:outline-none focus:ring-1 focus:ring-(--chat-accent) text-(--chat-text-primary) placeholder-(--chat-text-muted) resize-y"
              style={{ fontFamily: "var(--chat-font-mono)" }}
            />
          </div>
        )}

        {/* Advanced Options */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-(--chat-text-muted) hover:text-(--chat-text-primary) transition-colors"
          >
            {showAdvanced ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            Advanced Options
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 ml-4">
              <label className="flex items-center gap-2 text-xs text-(--chat-text-secondary)">
                <input
                  type="checkbox"
                  checked={formData.includeSystemDetails}
                  onChange={(e) =>
                    handleChange("includeSystemDetails", e.target.checked)
                  }
                  className="rounded"
                />
                Include system details (provider, model, OS)
              </label>

              <label className="flex items-center gap-2 text-xs text-(--chat-text-secondary)">
                <input
                  type="checkbox"
                  checked={formData.includeTelemetry}
                  onChange={(e) =>
                    handleChange("includeTelemetry", e.target.checked)
                  }
                  className="rounded"
                />
                Include performance telemetry (if available)
              </label>

              <div>
                <label
                  htmlFor="issue-email"
                  className="block text-xs text-(--chat-text-secondary) mb-1"
                >
                  Email (optional)
                </label>
                <input
                  id="issue-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded focus:outline-none focus:ring-1 focus:ring-(--chat-accent) text-(--chat-text-primary) placeholder-(--chat-text-muted)"
                  style={{ fontFamily: "var(--chat-font-mono)" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* System Details Preview */}
        {formData.includeSystemDetails && (
          <details className="mt-4">
            <summary className="text-xs text-(--chat-text-muted) cursor-pointer hover:text-(--chat-text-primary) transition-colors">
              Preview system details that will be included
            </summary>
            <pre className="mt-2 p-3 text-xs bg-(--chat-bg-secondary) border border-(--chat-border) rounded overflow-x-auto text-(--chat-text-secondary)">
              {getSystemDetails()}
            </pre>
          </details>
        )}

        {/* Submit Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5
              text-white text-xs font-medium rounded
              transition-opacity
              ${
                isValid && !isSubmitting
                  ? "bg-(--chat-accent) hover:opacity-90"
                  : "bg-(--chat-text-muted) cursor-not-allowed opacity-50"
              }
            `}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Github size={14} />
                Create GitHub Issue
              </>
            )}
          </button>

          <a
            href="mailto:support@zanosheets.com?subject=Zano%20Sheets%20Support"
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-(--chat-bg-secondary) border border-(--chat-border) text-(--chat-text-secondary) text-xs rounded hover:text-(--chat-text-primary) transition-colors"
          >
            <Mail size={14} />
            Email Support
          </a>
        </div>

        <p className="text-xs text-(--chat-text-muted) text-center">
          By creating an issue, you agree to GitHub&apos;s Terms of Service.
          Issues are public by default.
        </p>
      </form>
    </div>
  );
}

function getSystemDetails(): string {
  const windowWithConfig = window as Window & {
    providerConfig?: {
      provider?: string;
      model?: string;
      thinking?: string;
    };
    Office?: {
      context?: {
        diagnostics?: {
          version?: string;
        };
      };
    };
  };
  const provider = windowWithConfig.providerConfig?.provider || "Unknown";
  const model = windowWithConfig.providerConfig?.model || "Unknown";
  const thinking = windowWithConfig.providerConfig?.thinking || "none";
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;
  const cookieEnabled = navigator.cookieEnabled;
  const onLine = navigator.onLine;

  // Try to get Excel version if available
  const excelVersion =
    windowWithConfig.Office?.context?.diagnostics?.version || "Unknown";

  return `
Provider: ${provider}
Model: ${model}
Thinking Mode: ${thinking}
Platform: ${platform}
User Agent: ${userAgent}
Language: ${language}
Excel Version: ${excelVersion}
Cookies: ${cookieEnabled ? "Enabled" : "Disabled"}
Online: ${onLine ? "Yes" : "No"}
Timestamp: ${new Date().toISOString()}
  `.trim();
}
