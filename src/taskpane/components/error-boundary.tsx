import * as Sentry from "@sentry/react";
import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";
import { ErrorDisplay } from "./error-display";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: "",
    errorStack: "",
    showDetails: false,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error.message || "Something went wrong",
      errorStack: error.stack ?? "",
      showDetails: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[UI] Unhandled render error:", error, errorInfo);
    Sentry.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
    });
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
      errorStack: "",
      showDetails: false,
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { errorMessage, errorStack } = this.state;

    return (
      <div
        className="h-screen w-full flex items-center justify-center bg-(--chat-bg) px-4"
        style={{ fontFamily: "var(--chat-font-mono)" }}
      >
        <div className="w-full max-w-xl space-y-4">
          <div className="text-xs uppercase tracking-widest text-(--chat-text-muted)">
            Unhandled UI Error
          </div>

          <ErrorDisplay
            error={errorMessage}
            onRetry={this.handleRetry}
            onCustomAction={(action) => {
              if (action === "Reload add-in") {
                this.handleReload();
              }
            }}
          />

          {errorStack && (
            <details className="text-xs">
              <summary className="cursor-pointer text-(--chat-text-muted) hover:text-(--chat-text-secondary) underline underline-offset-2">
                Technical details
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto text-xs text-(--chat-error) bg-(--chat-bg) border border-(--chat-border) p-2 whitespace-pre-wrap break-words">
                {errorStack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
