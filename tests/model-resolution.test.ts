import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderConfig } from "../src/lib/provider-config";

const { getModelMock, buildCustomModelMock } = vi.hoisted(() => ({
  getModelMock: vi.fn(),
  buildCustomModelMock: vi.fn(),
}));

vi.mock("@mariozechner/pi-ai", async () => {
  const actual = await vi.importActual("@mariozechner/pi-ai");
  return {
    ...actual,
    getModel: getModelMock,
  };
});

vi.mock("../src/lib/provider-config", async () => {
  const actual = await vi.importActual("../src/lib/provider-config");
  return {
    ...actual,
    buildCustomModel: buildCustomModelMock,
  };
});

import { resolveAgentModel } from "../src/lib/chat/model-resolution";

const baseConfig: ProviderConfig = {
  provider: "openai",
  apiKey: "sk-test",
  model: "gpt-4o",
  useProxy: false,
  proxyUrl: "",
  thinking: "none",
  followMode: true,
  authMethod: "apikey",
};

beforeEach(() => {
  getModelMock.mockReset();
  buildCustomModelMock.mockReset();
});

describe("resolveAgentModel", () => {
  it("returns a descriptive error when a provider model cannot be resolved", () => {
    getModelMock.mockImplementation(() => {
      throw new Error("missing model");
    });

    expect(resolveAgentModel(baseConfig)).toEqual({
      baseModel: null,
      error:
        "Model 'gpt-4o' is not available for provider 'openai'. Re-select the model in Settings.",
    });
  });

  it("returns a descriptive error when a custom model cannot be built", () => {
    buildCustomModelMock.mockReturnValue(null);

    expect(
      resolveAgentModel({
        ...baseConfig,
        provider: "custom",
        model: "custom-model",
        apiType: "openai",
      }),
    ).toEqual({
      baseModel: null,
      error:
        "Custom endpoint configuration is invalid. Review API type, base URL, and model settings.",
    });
  });
});
