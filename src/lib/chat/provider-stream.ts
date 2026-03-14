import type { Api, Model } from "@mariozechner/pi-ai";
import { withChunkHeartbeat } from "./stream-fallback";

type BaseStreamSimple = typeof import("@mariozechner/pi-ai").streamSimple;
type StreamSimpleParams = Parameters<BaseStreamSimple>;
type StreamSimpleResult = ReturnType<BaseStreamSimple>;

/**
 * Stream factory function signature.
 * Each provider implements this signature for their streaming logic.
 */
type StreamFactory = (
  model: Model<Api>,
  context: unknown,
  options: unknown,
) => Awaited<StreamSimpleResult>;

/**
 * Registry mapping API identifiers to their lazy-loaded stream factories.
 *
 * Each entry keeps the dynamic import() as a literal string so Vite can
 * still perform code-splitting (variable paths would defeat tree-shaking).
 */
const PROVIDER_REGISTRY: Record<
  string,
  {
    load: () => Promise<Record<string, unknown>>;
    factory: string;
  }
> = {
  "anthropic-messages": {
    load: () => import("@mariozechner/pi-ai"),
    factory: "streamSimpleAnthropic",
  },
  "openai-completions": {
    load: () => import("@mariozechner/pi-ai"),
    factory: "streamSimpleOpenAICompletions",
  },
  "openai-responses": {
    load: () => import("@mariozechner/pi-ai"),
    factory: "streamSimpleOpenAIResponses",
  },
  "azure-openai-responses": {
    load: () => import("@mariozechner/pi-ai"),
    factory: "streamSimpleAzureOpenAIResponses",
  },
  "openai-codex-responses": {
    load: () => import("@mariozechner/pi-ai"),
    factory: "streamSimpleOpenAICodexResponses",
  },
  "google-generative-ai": {
    load: () => import("@mariozechner/pi-ai"),
    factory: "streamSimpleGoogle",
  },
  "google-gemini-cli": {
    load: () => import("@mariozechner/pi-ai"),
    factory: "streamSimpleGoogleGeminiCli",
  },
  "google-vertex": {
    load: () => import("@mariozechner/pi-ai"),
    factory: "streamSimpleGoogleVertex",
  },
  "bedrock-converse-stream": {
    load: () => import("@mariozechner/pi-ai"),
    factory: "streamSimpleBedrock",
  },
};

/**
 * Type-safe wrapper that validates a factory function before calling it.
 */
function castFactory(factory: unknown, api: string): StreamFactory {
  if (typeof factory !== "function") {
    throw new Error(`Invalid stream factory for ${api}: not a function`);
  }
  return factory as StreamFactory;
}

export async function streamSimple(
  ...args: StreamSimpleParams
): Promise<Awaited<StreamSimpleResult>> {
  const [model, context, options] = args;
  const api = (model as Model<Api>).api;

  const entry = PROVIDER_REGISTRY[api];
  if (!entry) {
    throw new Error(`Unsupported model API: ${String(api)}`);
  }

  const mod = await entry.load();
  let rawFactory = mod[entry.factory];
  if (!rawFactory && api === "openai-codex-responses") {
    rawFactory = mod.streamSimpleOpenAIResponses;
  }
  const factory = castFactory(rawFactory, api);

  const stream = await factory(model, context, options);

  // Wrap with chunk-level heartbeat to detect mid-stream connection drops
  return withChunkHeartbeat(stream) as Awaited<StreamSimpleResult>;
}
