/**
 * Type-safe adapter layer for pi-ai library interfaces.
 *
 * This module provides wrapper types and conversion functions to safely
 * bridge between our internal types and pi-ai's interfaces without using
 * unsafe `as never` casts.
 */

import type {
  Api,
  Model,
  AssistantMessage,
  UserMessage,
  Context as PiAiContext,
  StreamOptions,
} from "@mariozechner/pi-ai";

/**
 * Internal representation of model identifiers.
 * Maps to pi-ai's provider and model ID combinations.
 */
export interface ModelIdentifier {
  provider: string;
  model: string;
}

/**
 * Type-safe context for streaming operations.
 * Extends pi-ai's Context with our application-specific properties.
 */
export interface StreamContext extends Partial<PiAiContext> {
  systemPrompt: string;
  messages: Array<UserMessage | AssistantMessage>;
}

/**
 * Options for streaming operations.
 * Extends pi-ai's StreamOptions with our custom options.
 */
export interface StreamOptionsExtended extends Partial<StreamOptions> {
  apiKey?: string;
  maxTokens?: number;
  sessionId?: string;
  temperature?: number;
}

/**
 * Registry of supported provider APIs.
 * Maps our internal provider names to pi-ai's API identifiers.
 */
export const SUPPORTED_APIS = {
  ANTHROPIC_MESSAGES: "anthropic-messages",
  OPENAI_COMPLETIONS: "openai-completions",
  OPENAI_RESPONSES: "openai-responses",
  AZURE_OPENAI_RESPONSES: "azure-openai-responses",
  OPENAI_CODEX_RESPONSES: "openai-codex-responses",
  GOOGLE_GENERATIVE_AI: "google-generative-ai",
  GOOGLE_GEMINI_CLI: "google-gemini-cli",
  GOOGLE_VERTEX: "google-vertex",
  BEDROCK_CONVERSE_STREAM: "bedrock-converse-stream",
} as const;

export type SupportedApi = (typeof SUPPORTED_APIS)[keyof typeof SUPPORTED_APIS];

/**
 * Type guard to check if a provider string is a supported API.
 */
export function isSupportedApi(provider: string): provider is SupportedApi {
  return Object.values(SUPPORTED_APIS).includes(provider as SupportedApi);
}

/**
 * Safely converts a model identifier to pi-ai's API type.
 * Returns the API string if valid, throws otherwise.
 */
export function providerToApi(provider: string): Api {
  if (!isSupportedApi(provider)) {
    throw new Error(
      `Unsupported provider: ${provider}. Must be one of: ${Object.values(SUPPORTED_APIS).join(", ")}`
    );
  }
  return provider as Api;
}

/**
 * Type-safe wrapper for getting a model from pi-ai's registry.
 * Uses runtime validation to ensure type safety.
 */
export function getModelSafe(
  provider: string,
  modelId: string
): Model<Api> | null {
  try {
    const { getModel } = require("@mariozechner/pi-ai");
    const api = providerToApi(provider);
    return getModel(api, modelId);
  } catch (error) {
    console.error(`Failed to get model ${modelId} for provider ${provider}:`, error);
    return null;
  }
}

/**
 * Converts our stream context to pi-ai's expected format.
 */
export function toPiAiContext(context: StreamContext): PiAiContext {
  return {
    systemPrompt: context.systemPrompt,
    messages: context.messages,
  };
}

/**
 * Converts our stream options to pi-ai's expected format.
 */
export function toPiAiOptions(options: StreamOptionsExtended): StreamOptions {
  const piAiOptions: StreamOptions = {};

  if (options.apiKey) {
    piAiOptions.apiKey = options.apiKey;
  }
  if (options.maxTokens) {
    piAiOptions.maxTokens = options.maxTokens;
  }
  if (options.sessionId) {
    piAiOptions.sessionId = options.sessionId;
  }
  if (options.temperature !== undefined) {
    piAiOptions.temperature = options.temperature;
  }

  return piAiOptions;
}

/**
 * Validates that a model instance has the expected API.
 */
export function validateModelApi(model: Model<Api>, expectedApi: Api): boolean {
  return model.api === expectedApi;
}

/**
 * Type-safe model wrapper that enforces API type consistency.
 */
export class TypedModel<T extends ModelIdentifier> {
  constructor(
    private readonly model: Model<Api>,
    public readonly identifier: T
  ) {}

  get api(): Api {
    return this.model.api;
  }

  get id(): string {
    return this.model.id;
  }

  unwrap(): Model<Api> {
    return this.model;
  }

  /**
   * Creates a typed model from an identifier.
   * Returns null if the model cannot be resolved.
   */
  static fromIdentifier<T extends ModelIdentifier>(
    identifier: T
  ): TypedModel<T> | null {
    const model = getModelSafe(identifier.provider, identifier.model);
    if (!model) {
      return null;
    }

    const expectedApi = providerToApi(identifier.provider);
    if (!validateModelApi(model, expectedApi)) {
      console.error(
        `Model API mismatch: expected ${expectedApi}, got ${model.api}`
      );
      return null;
    }

    return new TypedModel(model, identifier);
  }
}

/**
 * Result type for model resolution operations.
 */
export interface ModelResolutionResult<T extends ModelIdentifier> {
  success: boolean;
  model?: TypedModel<T>;
  error?: string;
}

/**
 * Resolves a model identifier to a typed model instance.
 */
export function resolveModel<T extends ModelIdentifier>(
  identifier: T
): ModelResolutionResult<T> {
  try {
    const typedModel = TypedModel.fromIdentifier(identifier);
    if (!typedModel) {
      return {
        success: false,
        error: `Model '${identifier.model}' not found for provider '${identifier.provider}'`,
      };
    }
    return {
      success: true,
      model: typedModel,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
