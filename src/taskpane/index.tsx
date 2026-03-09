import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./components/app";
import "./index.css";

// Initialize startup telemetry as early as possible
// Import dynamically to avoid blocking the main bundle
import { initStartupTelemetry } from "../lib/startup-telemetry";

// Initialize startup timing
initStartupTelemetry();

Sentry.init({
  dsn: "https://a91fd4e21fea892bf4b448ef09c321d2@o4510685409181696.ingest.de.sentry.io/4510963341983824",
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  // Capture 100% of errors, 10% of performance traces
  tracesSampleRate: 0.1,
});

const title = "Zano Sheets";

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

Office.onReady(() => {
  root?.render(<App title={title} />);
});
