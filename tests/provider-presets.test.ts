import { describe, expect, it } from "vitest";

import {
  createProviderDraft,
  defaultsForProviderKind,
  labelForProviderKind,
} from "../src/lib/providers/provider-presets";

describe("provider presets", () => {
  it("returns a full draft for each provider kind used by setup", () => {
    expect(createProviderDraft("openai")).toMatchObject({
      answerModel: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
      embeddingModel: "text-embedding-3-small",
      name: "OpenAI Provider",
      rerankModel: "gpt-4.1-mini",
      summarizeModel: "gpt-4.1-mini",
      visionModel: "gpt-4.1-mini",
    });

    expect(createProviderDraft("gemini")).toMatchObject({
      answerModel: "gemini-2.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      embeddingModel: "text-embedding-004",
      name: "Gemini Provider",
      rerankModel: "gemini-2.5-flash",
      summarizeModel: "gemini-2.5-flash",
      visionModel: "gemini-2.5-flash",
    });
  });

  it("keeps provider labels and defaults aligned for onboarding switches", () => {
    const openai = defaultsForProviderKind("openai");
    const ollama = defaultsForProviderKind("ollama");

    expect(labelForProviderKind("openai-compatible")).toBe("OpenAI-compatible");
    expect(openai.embeddingModel).not.toBe(ollama.embeddingModel);
    expect(openai.rerankModel).not.toBe(ollama.rerankModel);
    expect(openai.visionModel).not.toBe(ollama.visionModel);
  });
});
