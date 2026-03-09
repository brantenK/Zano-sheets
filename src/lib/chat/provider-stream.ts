import type { Api, Model } from "@mariozechner/pi-ai";

type BaseStreamSimple =
  typeof import("@mariozechner/pi-ai/dist/stream.js").streamSimple;
type StreamSimpleParams = Parameters<BaseStreamSimple>;
type StreamSimpleResult = ReturnType<BaseStreamSimple>;

export async function streamSimple(
  ...args: StreamSimpleParams
): Promise<StreamSimpleResult> {
  const [model, context, options] = args;
  const api = (model as Model<Api>).api;

  switch (api) {
    case "anthropic-messages": {
      const module = await import(
        "@mariozechner/pi-ai/dist/providers/anthropic.js"
      );
      return module.streamSimpleAnthropic(
        model as never,
        context as never,
        options as never,
      );
    }
    case "openai-completions": {
      const module = await import(
        "@mariozechner/pi-ai/dist/providers/openai-completions.js"
      );
      return module.streamSimpleOpenAICompletions(
        model as never,
        context as never,
        options as never,
      );
    }
    case "openai-responses": {
      const module = await import(
        "@mariozechner/pi-ai/dist/providers/openai-responses.js"
      );
      return module.streamSimpleOpenAIResponses(
        model as never,
        context as never,
        options as never,
      );
    }
    case "azure-openai-responses": {
      const module = await import(
        "@mariozechner/pi-ai/dist/providers/azure-openai-responses.js"
      );
      return module.streamSimpleAzureOpenAIResponses(
        model as never,
        context as never,
        options as never,
      );
    }
    case "openai-codex-responses": {
      const module = await import(
        "@mariozechner/pi-ai/dist/providers/openai-codex-responses.js"
      );
      return module.streamSimpleOpenAICodexResponses(
        model as never,
        context as never,
        options as never,
      );
    }
    case "google-generative-ai": {
      const module = await import(
        "@mariozechner/pi-ai/dist/providers/google.js"
      );
      return module.streamSimpleGoogle(
        model as never,
        context as never,
        options as never,
      );
    }
    case "google-gemini-cli": {
      const module = await import(
        "@mariozechner/pi-ai/dist/providers/google-gemini-cli.js"
      );
      return module.streamSimpleGoogleGeminiCli(
        model as never,
        context as never,
        options as never,
      );
    }
    case "google-vertex": {
      const module = await import(
        "@mariozechner/pi-ai/dist/providers/google-vertex.js"
      );
      return module.streamSimpleGoogleVertex(
        model as never,
        context as never,
        options as never,
      );
    }
    case "bedrock-converse-stream": {
      const module = await import(
        "@mariozechner/pi-ai/dist/providers/amazon-bedrock.js"
      );
      return module.streamSimpleBedrock(
        model as never,
        context as never,
        options as never,
      );
    }
    default:
      throw new Error(`Unsupported model API: ${String(api)}`);
  }
}
