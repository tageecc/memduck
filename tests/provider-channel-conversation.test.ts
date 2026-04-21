import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveTelegramRuntimeConfig } from "../src/lib/channels/telegram-runtime";
import { createMemduckService } from "../src/lib/memduck/service";
import {
  createOpenAICompatibleFetcher,
  defaultProviderSettings,
} from "./support/provider-fixtures";

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
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);

      if (url.includes("anthropic.com")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          system?: string;
          messages?: Array<{
            content?: Array<{
              text?: string;
              type?: string;
            }>;
          }>;
        };
        const prompt =
          body.messages?.[0]?.content
            ?.map((entry) => entry.text ?? "")
            .filter(Boolean)
            .join("\n") ?? "";

        if (
          body.system?.includes("Project the text into a semantic vector") ||
          prompt.includes("embedding array")
        ) {
          return new Response(
            JSON.stringify({
              content: [{ text: '{"embedding":[0.9,0.1,0.1]}' }],
            }),
            {
              headers: { "content-type": "application/json" },
              status: 200,
            },
          );
        }

        if (prompt.includes("Compile a memory card")) {
          return new Response(
            JSON.stringify({
              content: [
                {
                  text: JSON.stringify({
                    deepSummary:
                      "Anthropic provider digest for the saved memory.",
                    evidence: ["Use the active provider for the first summary"],
                    keyPoints: [
                      "Use the active provider for the first summary",
                    ],
                    summary: "Anthropic summary",
                    worthSaving: true,
                  }),
                },
              ],
            }),
            {
              headers: { "content-type": "application/json" },
              status: 200,
            },
          );
        }

        if (prompt.includes("Resolve topic links")) {
          return new Response(
            JSON.stringify({
              content: [
                {
                  text: JSON.stringify({
                    matches: [],
                    newTopics: [
                      {
                        confidence: 0.9,
                        keywords: ["provider runtime", "anthropic"],
                        name: "Provider Runtime",
                        reason:
                          "The card is about which provider is active for digestion.",
                      },
                    ],
                  }),
                },
              ],
            }),
            {
              headers: { "content-type": "application/json" },
              status: 200,
            },
          );
        }

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

      if (url.endsWith("/embeddings")) {
        return new Response(
          JSON.stringify({
            data: [{ embedding: [0.9, 0.1, 0.1] }],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{
          content?:
            | string
            | Array<{
                text?: string;
                type?: string;
              }>;
        }>;
      };
      const promptContent = body.messages?.at(-1)?.content;
      const prompt =
        typeof promptContent === "string"
          ? promptContent
          : Array.isArray(promptContent)
            ? promptContent
                .map((entry) => entry.text ?? "")
                .filter(Boolean)
                .join("\n")
            : "";

      if (prompt.includes("Compile a memory card")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    deepSummary: "OpenAI provider digest for the saved memory.",
                    evidence: [
                      "Switching the active profile should switch providers",
                    ],
                    keyPoints: [
                      "Switching the active profile should switch providers",
                    ],
                    summary: "OpenAI summary",
                    worthSaving: true,
                  }),
                },
              },
            ],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      if (prompt.includes("Resolve topic links")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    matches: [
                      {
                        confidence: 0.91,
                        reason:
                          "This card is also about provider switching and runtime selection.",
                        topicId: "topic-1",
                      },
                    ],
                    newTopics: [],
                  }),
                },
              },
            ],
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
        baseUrl: "https://api.anthropic.com",
        embeddingModel: "claude-embed",
        id: "anthropic-main",
        kind: "anthropic",
        name: "Anthropic Main",
        rerankModel: "claude-rerank",
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
      baseUrl: "https://api.openai.com/v1",
      embeddingModel: "text-embedding-3-small",
      id: "openai-main",
      kind: "openai",
      name: "OpenAI Main",
      rerankModel: "gpt-rerank",
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

  it("builds runtime diagnostics for the channels page", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);

      if (url.endsWith("/embeddings")) {
        return new Response(
          JSON.stringify({
            data: [{ embedding: [0.7, 0.2, 0.1] }],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{
          content?:
            | string
            | Array<{
                text?: string;
                type?: string;
              }>;
        }>;
      };
      const promptContent = body.messages?.at(-1)?.content;
      const prompt =
        typeof promptContent === "string"
          ? promptContent
          : Array.isArray(promptContent)
            ? promptContent
                .map((entry) => entry.text ?? "")
                .filter(Boolean)
                .join("\n")
            : "";

      if (prompt.includes("Compile a memory card")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    deepSummary:
                      "OpenAI diagnostics digest for the saved memory card.",
                    evidence: [
                      "Saved memory cards should show up in the runtime diagnostics",
                    ],
                    keyPoints: [
                      "Saved memory cards should show up in the runtime diagnostics",
                    ],
                    summary: "OpenAI summary",
                    worthSaving: true,
                  }),
                },
              },
            ],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      if (prompt.includes("Resolve topic links")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    matches: [],
                    newTopics: [
                      {
                        confidence: 0.88,
                        keywords: ["runtime diagnostics", "memory cards"],
                        name: "Runtime Diagnostics",
                        reason:
                          "The card is about runtime diagnostics and surfaced memory cards.",
                      },
                    ],
                  }),
                },
              },
            ],
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
      now: () => new Date("2026-04-20T13:00:00.000Z"),
      runtimeDir: testRuntimeDir,
    });

    service.saveProviderProfile(
      {
        answerModel: "gpt-answer",
        apiKey: "openai-key",
        baseUrl: "https://api.openai.com/v1",
        embeddingModel: "text-embedding-3-small",
        id: "openai-main",
        kind: "openai",
        name: "OpenAI Main",
        rerankModel: "gpt-4.1-mini",
        summarizeModel: "gpt-summary",
        visionModel: "gpt-vision",
      },
      { makeActive: true },
    );

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

    service.recordChannelHeartbeat({
      channel: "extension",
      metadata: {
        version: "0.1.0",
      },
      occurredAt: "2026-04-20T12:58:00.000Z",
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "Saved memory cards should show up in the runtime diagnostics.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const diagnostics = service.getRuntimeDiagnostics();

    expect(diagnostics.setup.providerConfigured).toBe(true);
    expect(diagnostics.provider?.name).toBe("OpenAI Main");
    expect(diagnostics.features.embeddings).toBe(true);
    expect(diagnostics.channels.extension.connected).toBe(true);
    expect(diagnostics.channels.telegram.configured).toBe(true);
    expect(diagnostics.stats.memoryCards).toBe(1);
  });

  it("lists conversation threads with previews and returns the stored transcript", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-20T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        answer: "Stored conversation answer",
        summary: "Conversation summary",
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

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
