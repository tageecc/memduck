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

  it("finishes onboarding once a real provider is configured", async () => {
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
      needsOnboarding: false,
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

  it("persists provider profiles with the selected provider id and model", () => {
    const service = createMemduckService({
      runtimeDir: testRuntimeDir,
    });

    service.saveProviderSettings(
      defaultProviderSettings({
        answerModel: "qwen-plus",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        kind: "openai-compatible",
        model: "qwen-plus",
        providerId: "qwen",
        rerankModel: "qwen-plus",
        summarizeModel: "qwen-plus",
        visionModel: "qwen-plus",
      }),
    );

    expect(service.listProviderProfiles()).toHaveLength(1);
    expect(service.getActiveProviderProfile()).toMatchObject({
      model: "qwen-plus",
      providerId: "qwen",
    });
  });

  it("does not expose incomplete stored provider profiles to the UI", () => {
    const service = createMemduckService({
      runtimeDir: testRuntimeDir,
    });
    const writeSetting = (
      service as unknown as {
        writeSetting: (key: string, value: unknown) => void;
      }
    ).writeSetting.bind(service);

    writeSetting("active_provider_profile_id", "broken-profile");
    writeSetting("provider_profiles", [
      {
        answerModel: "qwen-plus",
        apiKey: "sk-test",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        createdAt: "2026-04-26T05:46:49.662Z",
        embeddingModel: "text-embedding-3-small",
        id: "broken-profile",
        kind: "openai-compatible",
        name: "Qwen Provider",
        rerankModel: "qwen-plus",
        summarizeModel: "qwen-plus",
        updatedAt: "2026-04-26T05:46:49.662Z",
        visionModel: "qwen-plus",
      },
    ]);

    expect(service.listProviderProfiles()).toEqual([]);
    expect(service.getActiveProviderProfile()).toBeNull();
    expect(service.getSetupState()).toMatchObject({
      providerConfigured: false,
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
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://api.example.com/v1/chat/completions",
    );
  });

  it("fails stalled openai-compatible answer streams instead of hanging", async () => {
    vi.useFakeTimers();

    const baseFetcher = createOpenAICompatibleFetcher({
      answer: "streamed answer",
    });
    const fetcher = vi.fn<typeof fetch>(async (request, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        stream?: boolean;
      };

      if (String(request).endsWith("/chat/completions") && body.stream) {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(
                  'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
                ),
              );
            },
          }),
          {
            headers: { "content-type": "text/event-stream" },
            status: 200,
          },
        );
      }

      return baseFetcher(request, init);
    });

    const service = createMemduckService({
      providerFetch: fetcher,
      runtimeDir: testRuntimeDir,
    });

    service.saveProviderSettings(defaultProviderSettings());
    await service.ingest({
      kind: "text",
      payload: { text: "Streaming timeout memory." },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const events = service
      .askStream({ question: "What did I save?" })
      [Symbol.asyncIterator]();

    await events.next();
    await events.next();
    const stalled = events.next();
    const stalledExpectation = expect(stalled).rejects.toThrow(
      "Provider stream timed out.",
    );

    await vi.advanceTimersByTimeAsync(16_000);

    await stalledExpectation;
    vi.useRealTimers();
  });

  it("fails stalled openai-compatible non-streaming requests instead of hanging", async () => {
    vi.useFakeTimers();

    const fetcher = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined),
    );
    const service = createMemduckService({
      providerFetch: fetcher,
      runtimeDir: testRuntimeDir,
    });

    service.saveProviderSettings(defaultProviderSettings());

    const ingest = service.ingest({
      kind: "text",
      payload: { text: "Non-streaming timeout memory." },
      requestedDepth: "quick",
      sourceChannel: "web",
    });
    const expectation = expect(ingest).rejects.toThrow(
      "Provider request timed out.",
    );

    await vi.advanceTimersByTimeAsync(31_000);

    await expectation;
    vi.useRealTimers();
  });

  it("fails stalled openai-compatible completion bodies instead of hanging", async () => {
    vi.useFakeTimers();

    const baseFetcher = createOpenAICompatibleFetcher({
      memoryDigest: {
        deepSummary: "API deep summary",
        evidence: ["body timeout evidence"],
        keyPoints: ["body timeout point"],
        summary: "API summary",
        worthSaving: true,
      },
    });
    const fetcher = vi.fn<typeof fetch>(async (request, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const isMemoryDigest =
        String(request).endsWith("/chat/completions") &&
        body.messages?.some((message) =>
          message.content?.includes("Compile a quick memory card"),
        );

      if (isMemoryDigest) {
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode("{"));
            },
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      return baseFetcher(request, init);
    });
    const service = createMemduckService({
      providerFetch: fetcher,
      runtimeDir: testRuntimeDir,
    });

    service.saveProviderSettings(defaultProviderSettings());

    const ingest = service.ingest({
      kind: "text",
      payload: { text: "Completion body timeout memory." },
      requestedDepth: "quick",
      sourceChannel: "web",
    });
    const expectation = expect(ingest).rejects.toThrow(
      "Provider request timed out.",
    );

    await vi.advanceTimersByTimeAsync(31_000);

    await expectation;
    vi.useRealTimers();
  });
});
