import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemduckService } from "../src/lib/memduck/service";

const testRuntimeDir =
  "/Users/tagecc/Documents/workspace/memduck/.memduck/provider-test-runtime";

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
    const service = createMemduckService({
      now: () => new Date("2026-04-20T09:00:00.000Z"),
      runtimeDir: testRuntimeDir,
    });

    expect(service.getSetupState()).toEqual({
      hasAnyMemories: false,
      needsOnboarding: true,
      providerConfigured: false,
      providerKind: null,
    });

    service.saveProviderSettings({
      kind: "mock",
    });

    expect(service.getSetupState()).toEqual({
      hasAnyMemories: false,
      needsOnboarding: true,
      providerConfigured: true,
      providerKind: "mock",
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
      providerKind: "mock",
    });
  });

  it("uses the configured openai-compatible provider for summarize and answer", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const lastMessage = body.messages?.at(-1)?.content ?? "";
      const content = lastMessage.includes("Answer the question")
        ? "API answer"
        : "API summary";

      return new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200,
        },
      );
    });

    const service = createMemduckService({
      providerFetch: fetcher,
      runtimeDir: testRuntimeDir,
    });

    service.saveProviderSettings({
      answerModel: "answer-model",
      apiKey: "sk-test",
      baseUrl: "https://api.example.com/v1",
      kind: "openai-compatible",
      summarizeModel: "summary-model",
      visionModel: "vision-model",
    });

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
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });
});
