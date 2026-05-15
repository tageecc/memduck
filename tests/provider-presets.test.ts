import { describe, expect, it } from "vitest";

import {
  buildProviderSettings,
  createProviderDraft,
  defaultsForProvider,
  labelForProvider,
  listProviderCatalog,
  providerCatalogIds,
} from "../src/lib/providers/provider-presets";

describe("provider presets", () => {
  it("returns a compact draft for each provider kind used by setup", () => {
    expect(createProviderDraft("openai")).toMatchObject({
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      name: "OpenAI Provider",
    });

    expect(createProviderDraft("gemini")).toMatchObject({
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.5-flash",
      name: "Gemini Provider",
    });
  });

  it("exposes a provider-owned model catalog and expands one selected model internally", () => {
    const catalog = listProviderCatalog();

    expect(catalog.map((entry) => entry.id)).toEqual([...providerCatalogIds]);
    expect(catalog.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "alibaba-model-studio",
        "amazon-bedrock",
        "anthropic-vertex",
        "azure-speech",
        "byteplus",
        "byteplus-plan",
        "cerebras",
        "chutes",
        "cloudflare-ai-gateway",
        "claude-max-api-proxy",
        "comfyui",
        "copilot-proxy",
        "deepgram",
        "deepinfra",
        "deepseek",
        "ds4",
        "elevenlabs",
        "fal",
        "fireworks",
        "github-copilot",
        "google",
        "google-vertex",
        "google-gemini-cli",
        "gradium",
        "groq",
        "huggingface",
        "inferrs",
        "inworld",
        "kilocode",
        "kimi",
        "litellm",
        "lmstudio",
        "minimax",
        "minimax-portal",
        "moonshot",
        "opencode-go",
        "openai-codex",
        "openrouter",
        "perplexity",
        "qianfan",
        "qwen",
        "runway",
        "senseaudio",
        "sglang",
        "stepfun-plan",
        "synthetic",
        "tencent-tokenhub",
        "venice",
        "vercel-ai-gateway",
        "volcengine-plan",
        "volcengine",
        "xai",
        "xiaomi",
        "zai",
        "custom",
      ]),
    );
    expect(
      catalog.find((entry) => entry.id === "openai")?.models,
    ).toContainEqual({ id: "gpt-4.1-mini", label: "GPT-4.1 Mini" });
    expect(
      catalog.every((entry) =>
        Object.values(entry.capabilities).every(
          (capability) => typeof capability === "boolean",
        ),
      ),
    ).toBe(true);
    expect(
      catalog.find((entry) => entry.id === "openai")?.capabilities,
    ).toEqual({
      chat: true,
      embedding: true,
      rerank: true,
      vision: true,
    });
    expect(
      catalog.find((entry) => entry.id === "senseaudio")?.capabilities,
    ).toEqual({
      chat: false,
      embedding: false,
      rerank: false,
      vision: false,
    });

    expect(
      buildProviderSettings({
        apiKey: "sk-test",
        model: "gpt-4.1",
        providerId: "openai",
      }),
    ).toMatchObject({
      answerModel: "gpt-4.1",
      baseUrl: "https://api.openai.com/v1",
      embeddingModel: "text-embedding-3-small",
      kind: "openai",
      model: "gpt-4.1",
      providerId: "openai",
      rerankModel: "gpt-4.1",
      summarizeModel: "gpt-4.1",
      visionModel: "gpt-4.1",
    });

    expect(
      buildProviderSettings({
        apiKey: "sk-qwen",
        model: "qwen-plus",
        providerId: "qwen",
      }),
    ).toMatchObject({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      embeddingModel: "text-embedding-v4",
      model: "qwen-plus",
      providerId: "qwen",
    });
  });

  it("keeps provider labels and defaults aligned for onboarding switches", () => {
    const openai = defaultsForProvider("openai");
    const ollama = defaultsForProvider("ollama");

    expect(labelForProvider("custom")).toBe("Custom");
    expect(openai.embeddingModel).not.toBe(ollama.embeddingModel);
    expect(openai.rerankModel).not.toBe(ollama.rerankModel);
    expect(openai.visionModel).not.toBe(ollama.visionModel);
  });
});
