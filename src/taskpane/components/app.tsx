import { type FC, lazy, Suspense, useEffect } from "react";
import { markFirstPaint, markInteractive } from "../../lib/startup-telemetry";
import { ErrorBoundary } from "./error-boundary";

const LazyChatInterface = lazy(async () => {
  const module = await import("./chat");
  return { default: module.ChatInterface };
});

interface AppProps {
  title: string;
}

function AppShell() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-(--chat-bg)">
      <div
        className="text-center"
        style={{ fontFamily: "var(--chat-font-mono)" }}
      >
        <div className="text-xs uppercase tracking-[0.3em] text-(--chat-text-muted)">
          Zano Sheets
        </div>
        <div className="mt-3 text-sm text-(--chat-text-secondary)">
          Loading taskpane...
        </div>
      </div>
    </div>
  );
}

const App: FC<AppProps> = () => {
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        markFirstPaint();
      });
    });
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      markInteractive();
    }, 200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <ErrorBoundary>
      <div className="h-screen w-full overflow-hidden">
        <Suspense fallback={<AppShell />}>
          <LazyChatInterface />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
};

export default App;
