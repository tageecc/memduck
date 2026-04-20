import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTelegramRuntimeConfig } from "../src/lib/channels/telegram-runtime";
import { createMemduckService } from "../src/lib/memduck/service";

const testRuntimeDir =
  "/Users/tagecc/Documents/workspace/memduck/.memduck/provider-channel-test-runtime";

describe("provider profiles, channel center, and conversation threads", () => {
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

  it("manages multiple provider profiles and uses the active profile for digestion", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);

      if (url.includes("anthropic.com")) {
        return new Response(
          JSON.stringify({
            content: [{ text: "Anthropic summary" }],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "OpenAI summary" } }],
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

    service.saveProviderProfile(
      {
        answerModel: "claude-answer",
        apiKey: "anthropic-key",
        id: "anthropic-main",
        kind: "anthropic",
        name: "Anthropic Main",
        summarizeModel: "claude-summary",
        visionModel: "claude-vision",
      },
      { makeActive: true },
    );

    const anthropicCard = await service.ingest({
      kind: "text",
      payload: { text: "Use the active provider for the first summary." },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    service.saveProviderProfile({
      answerModel: "gpt-answer",
      apiKey: "openai-key",
      id: "openai-main",
      kind: "openai",
      name: "OpenAI Main",
      summarizeModel: "gpt-summary",
      visionModel: "gpt-vision",
    });
    service.setActiveProviderProfile("openai-main");

    const openaiCard = await service.ingest({
      kind: "text",
      payload: {
        text: "Switching the active profile should switch providers.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    expect(anthropicCard.memoryCard.summary).toBe("Anthropic summary");
    expect(openaiCard.memoryCard.summary).toBe("OpenAI summary");
    expect(service.listProviderProfiles().map((profile) => profile.id)).toEqual(
      ["anthropic-main", "openai-main"],
    );
    expect(service.getActiveProviderProfile()?.id).toBe("openai-main");
  });

  it("persists channel center settings and resolves telegram runtime config", () => {
    const service = createMemduckService({
      runtimeDir: testRuntimeDir,
    });

    service.saveChannelSettings({
      extension: {
        captureBaseUrl: "http://127.0.0.1:3000",
        enabled: true,
      },
      telegram: {
        baseUrl: "http://127.0.0.1:3000",
        botToken: "saved-bot-token",
        botUsername: "memduck_bot",
        enabled: true,
      },
      web: {
        enabled: true,
      },
    });

    expect(service.getChannelSettings().telegram.botUsername).toBe(
      "memduck_bot",
    );
    expect(
      resolveTelegramRuntimeConfig({
        env: {},
        settings: service.getChannelSettings(),
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:3000",
      token: "saved-bot-token",
    });
  });

  it("lists conversation threads with previews and returns the stored transcript", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-20T12:00:00.000Z"),
      runtimeDir: testRuntimeDir,
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "Topic notes become useful when the memory layer preserves recall context.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    const firstAnswer = await service.ask({
      question: "What did I save about memory layers?",
    });

    await service.ask({
      conversationId: firstAnswer.conversationId,
      question: "What should I remember about recall context?",
    });

    const conversations = service.listConversations();
    const thread = service.getConversationThread(firstAnswer.conversationId);

    expect(conversations).toHaveLength(1);
    expect(conversations[0]?.messageCount).toBe(4);
    expect(conversations[0]?.lastMessagePreview).toContain(
      "Based on your saved memory",
    );
    expect(thread?.messages).toHaveLength(4);
    expect(thread?.messages[0]?.role).toBe("user");
    expect(thread?.messages[3]?.role).toBe("assistant");
  });
});
