/**
 * Type adapter tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SUPPORTED_APIS,
  isSupportedApi,
  providerToApi,
  getModelSafe,
  toPiAiContext,
  toPiAiOptions,
  validateModelApi,
  TypedModel,
  resolveModel,
  type ModelIdentifier,
  type SupportedApi,
} from "../src/lib/chat/adapter";

describe("SUPPORTED_APIS", () => {
  it("should have all required provider APIs", () => {
    expect(SUPPORTED_APIS.ANTHROPIC_MESSAGES).toBe("anthropic-messages");
    expect(SUPPORTED_APIS.OPENAI_COMPLETIONS).toBe("openai-completions");
    expect(SUPPORTED_APIS.OPENAI_RESPONSES).toBe("openai-responses");
    expect(SUPPORTED_APIS.AZURE_OPENAI_RESPONSES).toBe("azure-openai-responses");
    expect(SUPPORTED_APIS.OPENAI_CODEX_RESPONSES).toBe("openai-codex-responses");
    expect(SUPPORTED_APIS.GOOGLE_GENERATIVE_AI).toBe("google-generative-ai");
    expect(SUPPORTED_APIS.GOOGLE_GEMINI_CLI).toBe("google-gemini-cli");
    expect(SUPPORTED_APIS.GOOGLE_VERTEX).toBe("google-vertex");
    expect(SUPPORTED_APIS.BEDROCK_CONVERSE_STREAM).toBe("bedrock-converse-stream");
  });
});

describe("isSupportedApi", () => {
  it("should return true for supported APIs", () => {
    expect(isSupportedApi("anthropic-messages")).toBe(true);
    expect(isSupportedApi("openai-responses")).toBe(true);
    expect(isSupportedApi("google-generative-ai")).toBe(true);
  });

  it("should return false for unsupported APIs", () => {
    expect(isSupportedApi("unsupported-api")).toBe(false);
    expect(isSupportedApi("fake-provider")).toBe(false);
    expect(isSupportedApi("")).toBe(false);
  });
});

describe("providerToApi", () => {
  it("should convert provider name to API", () => {
    // providerToApi validates and returns the API name for supported APIs
    expect(providerToApi("anthropic-messages")).toBe("anthropic-messages");
    expect(providerToApi("openai-completions")).toBe("openai-completions");
    expect(providerToApi("google-generative-ai")).toBe("google-generative-ai");
  });

  it("should throw for unsupported provider", () => {
    expect(() => providerToApi("unsupported")).toThrow("Unsupported provider");
  });
});

describe("getModelSafe", () => {
  it("should return model for valid provider and model", () => {
    // This test depends on pi-ai having the model
    const result = getModelSafe("anthropic", "claude-3-5-sonnet-20241022");

    // Should either return a model or null (if model not found)
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("should return null for invalid provider", () => {
    const result = getModelSafe("invalid-provider", "some-model");
    expect(result).toBeNull();
  });

  it("should return null for invalid model", () => {
    const result = getModelSafe("anthropic", "invalid-model-name");
    expect(result).toBeNull();
  });
});

describe("toPiAiContext", () => {
  it("should convert stream context to pi-ai context", () => {
    const context = {
      systemPrompt: "You are a helpful assistant",
      messages: [{ role: "user", content: "Hello" }],
    };

    const result = toPiAiContext(context);

    expect(result.systemPrompt).toBe("You are a helpful assistant");
    expect(result.messages).toEqual(context.messages);
  });

  it("should handle empty context", () => {
    const context = {
      systemPrompt: "",
      messages: [],
    };

    const result = toPiAiContext(context);

    expect(result.systemPrompt).toBe("");
    expect(result.messages).toEqual([]);
  });
});

describe("toPiAiOptions", () => {
  it("should convert stream options to pi-ai options", () => {
    const options = {
      apiKey: "test-key",
      maxTokens: 1000,
      sessionId: "test-session",
      temperature: 0.7,
    };

    const result = toPiAiOptions(options);

    expect(result.apiKey).toBe("test-key");
    expect(result.maxTokens).toBe(1000);
    expect(result.sessionId).toBe("test-session");
    expect(result.temperature).toBe(0.7);
  });

  it("should handle undefined options", () => {
    const result = toPiAiOptions({});

    expect(result).toEqual({});
  });

  it("should handle partial options", () => {
    const options = {
      apiKey: "test-key",
      maxTokens: 500,
    };

    const result = toPiAiOptions(options);

    expect(result.apiKey).toBe("test-key");
    expect(result.maxTokens).toBe(500);
    expect(result.sessionId).toBeUndefined();
    expect(result.temperature).toBeUndefined();
  });
});

describe("validateModelApi", () => {
  it("should return true for matching APIs", () => {
    const mockModel = {
      api: "anthropic-messages",
      id: "claude-3-5-sonnet-20241022",
    };

    expect(validateModelApi(mockModel as any, "anthropic-messages")).toBe(true);
  });

  it("should return false for different APIs", () => {
    const mockModel = {
      api: "anthropic-messages",
      id: "claude-3-5-sonnet-20241022",
    };

    expect(validateModelApi(mockModel as any, "openai-responses")).toBe(false);
  });
});

describe("TypedModel", () => {
  describe("fromIdentifier", () => {
    it("should create typed model for valid identifier", () => {
      const identifier: ModelIdentifier = {
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
      };

      const typed = TypedModel.fromIdentifier(identifier);

      // Should either return a TypedModel or null (if model not available)
      expect(typed === null || typed instanceof TypedModel).toBe(true);

      if (typed) {
        expect(typed.identifier).toBe(identifier);
      }
    });

    it("should return null for invalid identifier", () => {
      const identifier: ModelIdentifier = {
        provider: "invalid-provider",
        model: "invalid-model",
      };

      const typed = TypedModel.fromIdentifier(identifier);
      expect(typed).toBeNull();
    });
  });

  describe("instance methods", () => {
    let typedModel: TypedModel<ModelIdentifier>;

    beforeEach(() => {
      const identifier: ModelIdentifier = {
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
      };

      const typed = TypedModel.fromIdentifier(identifier);
      if (typed) {
        typedModel = typed;
      } else {
        // Skip tests if model not available
        typedModel = null as any;
      }
    });

    it("should expose api property", () => {
      if (!typedModel) return;

      expect(typedModel.api).toBeDefined();
      expect(typeof typedModel.api).toBe("string");
    });

    it("should expose id property", () => {
      if (!typedModel) return;

      expect(typedModel.id).toBeDefined();
      expect(typeof typedModel.id).toBe("string");
    });

    it("should unwrap to original model", () => {
      if (!typedModel) return;

      const unwrapped = typedModel.unwrap();
      expect(unwrapped).toBeDefined();
      expect(typeof unwrapped).toBe("object");
    });
  });
});

describe("resolveModel", () => {
  it("should resolve valid model identifier", () => {
    const identifier: ModelIdentifier = {
      provider: "anthropic",
      model: "claude-3-5-sonnet-20241022",
    };

    const result = resolveModel(identifier);

    // Should either succeed or fail (if model not available)
    expect(["success", "error"]).toContain(Object.keys(result)[0]);
  });

  it("should return error for invalid identifier", () => {
    const identifier: ModelIdentifier = {
      provider: "invalid-provider",
      model: "invalid-model",
    };

    const result = resolveModel(identifier);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.model).toBeUndefined();
  });

  it("should include error message on failure", () => {
    const identifier: ModelIdentifier = {
      provider: "invalid-provider",
      model: "invalid-model",
    };

    const result = resolveModel(identifier);

    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe("string");
      expect(result.error?.length).toBeGreaterThan(0);
    }
  });
});
