import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemduckService } from "../src/lib/memduck/service";
import {
  createOpenAICompatibleFetcher,
  defaultProviderSettings,
} from "./support/provider-fixtures";

const testRuntimeDir = path.join(
  process.cwd(),
  ".memduck/provider-test-runtime",
);

describe("provider settings and setup state", () => {
  beforeEach(async () => {
    await import("node:fs/promises").then((fs) =>
      fs.rm(testRuntimeDir, { force: true, recursive: true }),
    );
  });

  afterEach(async () => {
    await import("node:fs/promises").then((fs) =>
      fs.rm(testRuntimeDir, { force: true, recursive: true }),
    );
  });

  it("tracks onboarding state from provider configuration and first real memory", async () => {
    const fetcher = createOpenAICompatibleFetcher({
      summary: "First memory summary",
    });
    const service = createMemduckService({
      now: () => new Date("2026-04-20T09:00:00.000Z"),
      providerFetch: fetcher,
      runtimeDir: testRuntimeDir,
    });

    expect(service.getSetupState()).toEqual({
      hasAnyMemories: false,
      needsOnboarding: true,
      providerConfigured: false,
      providerKind: null,
    });

    service.saveProviderSettings(defaultProviderSettings());

    expect(service.getSetupState()).toEqual({
      hasAnyMemories: false,
      needsOnboarding: true,
      providerConfigured: true,
      providerKind: "openai-compatible",
    });

    await service.ingest({
      kind: "text",
      payload: { text: "A first real memory card should complete onboarding." },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    expect(service.getSetupState()).toEqual({
      hasAnyMemories: true,
      needsOnboarding: false,
      providerConfigured: true,
      providerKind: "openai-compatible",
    });
  });

  it("uses the configured openai-compatible provider for summarize and answer", async () => {
    const fetcher = vi.fn(
      createOpenAICompatibleFetcher({
        answer: "API answer",
        memoryDigest: {
          deepSummary: "API deep summary",
          evidence: ["This note should go through the real provider path."],
          keyPoints: ["This note should go through the real provider path."],
          summary: "API summary",
          worthSaving: true,
        },
        summary: "API summary",
      }),
    );

    const service = createMemduckService({
      providerFetch: fetcher,
      runtimeDir: testRuntimeDir,
    });

    service.saveProviderSettings(
      defaultProviderSettings({
        answerModel: "answer-model",
        baseUrl: "https://api.example.com/v1",
        embeddingModel: "text-embedding-3-small",
        rerankModel: "rerank-model",
        summarizeModel: "summary-model",
        visionModel: "vision-model",
      }),
    );

    const ingestResult = await service.ingest({
      kind: "text",
      payload: { text: "This note should go through the real provider path." },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const answerResult = await service.ask({
      question: "What did I save?",
    });

    expect(ingestResult.memoryCard.summary).toBe("API summary");
    expect(answerResult.answer).toContain("API answer");
    expect(fetcher).toHaveBeenCalledTimes(7);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });
});
