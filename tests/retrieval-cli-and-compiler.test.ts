import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getExtensionConnectionStatus } from "../src/lib/channels/extension";
import { createMemduckService } from "../src/lib/memduck/service";
import {
  createOpenAICompatibleFetcher,
  defaultProviderSettings,
} from "./support/provider-fixtures";

const testRuntimeDir = path.join(
  process.cwd(),
  ".memduck/retrieval-cli-runtime",
);

describe("retrieval engine, topic compiler, extension status, and cli helpers", () => {
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

  it("uses stored embeddings and reranking to retrieve semantically related cards", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);

      if (url.endsWith("/embeddings")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          input?: string;
        };
        const text = body.input ?? "";

        if (text.includes("spaced repetition")) {
          return new Response(
            JSON.stringify({
              data: [{ embedding: [0.99, 0.01, 0.01] }],
            }),
            {
              headers: { "content-type": "application/json" },
              status: 200,
            },
          );
        }

        if (text.includes("retrieval practice")) {
          return new Response(
            JSON.stringify({
              data: [{ embedding: [0.98, 0.02, 0.01] }],
            }),
            {
              headers: { "content-type": "application/json" },
              status: 200,
            },
          );
        }

        return new Response(
          JSON.stringify({
            data: [{ embedding: [0.02, 0.99, 0.03] }],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.at(-1)?.content ?? "";

      if (
        prompt.includes("Compile a quick memory card") ||
        prompt.includes("Compile a deep memory card") ||
        prompt.includes("Compile a memory card")
      ) {
        if (prompt.includes("Spaced repetition")) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      deepSummary:
                        "Spaced repetition helps memory stay available over longer intervals.",
                      evidence: [
                        "Spaced repetition helps memory stay available over longer intervals",
                      ],
                      keyPoints: [
                        "Spaced repetition helps memory stay available over longer intervals",
                      ],
                      summary:
                        "Spaced repetition helps memory stay available over longer intervals",
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

        if (prompt.includes("Retrieval practice")) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      deepSummary:
                        "Retrieval practice strengthens memory when recall happens before rereading.",
                      evidence: [
                        "Retrieval practice strengthens memory when you force recall before rereading",
                      ],
                      keyPoints: [
                        "Retrieval practice strengthens memory when you force recall before rereading",
                      ],
                      summary:
                        "Retrieval practice strengthens memory when recall happens before rereading",
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

        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    deepSummary:
                      "A separate note about design systems and interface tokens.",
                    evidence: [
                      "A separate note about design systems and consistent interface tokens",
                    ],
                    keyPoints: [
                      "A separate note about design systems and consistent interface tokens",
                    ],
                    summary:
                      "A separate note about design systems and interface tokens",
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
        if (prompt.includes("retrieval")) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      matches: [],
                      newTopics: [
                        {
                          confidence: 0.94,
                          keywords: [
                            "retrieval practice",
                            "memory recall",
                            "durable learning",
                          ],
                          name: "Retrieval Practice",
                          reason: "The card is centered on retrieval practice.",
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

        if (prompt.includes("Spaced repetition")) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      matches: [],
                      newTopics: [
                        {
                          confidence: 0.93,
                          keywords: [
                            "spaced repetition",
                            "memory retention",
                            "review intervals",
                          ],
                          name: "Spaced Repetition",
                          reason: "The card is centered on spaced repetition.",
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
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    matches: [],
                    newTopics: [
                      {
                        confidence: 0.83,
                        keywords: ["design systems", "interface tokens"],
                        name: "Design Systems",
                        reason:
                          "The card is about design systems and interface tokens.",
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

      if (prompt.includes("Return JSON with rankedIds")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"rankedIds":["card-2","card-1","card-3"],"reasoning":"spaced repetition is the closest match, followed by retrieval practice"}',
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
          choices: [
            { message: { content: "Grounded answer from reranked cards" } },
          ],
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
        answerModel: "gpt-answer",
        apiKey: "sk-test",
        baseUrl: "https://api.example.com/v1",
        embeddingModel: "text-embedding-3-small",
        id: "openai-main",
        kind: "openai",
        name: "OpenAI Main",
        rerankModel: "gpt-rerank",
        summarizeModel: "gpt-summary",
        visionModel: "gpt-vision",
      },
      { makeActive: true },
    );

    await service.ingest({
      kind: "text",
      payload: {
        text: "Retrieval practice strengthens memory when you force recall before rereading.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "Spaced repetition helps memory stay available over longer intervals.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "A separate note about design systems and consistent interface tokens.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const retrieval = await service.retrieveCards({
      limit: 2,
      query: "How do I retain knowledge with spaced repetition?",
    });

    expect(retrieval.items).toHaveLength(2);
    expect(retrieval.items[0]?.card.title).toContain("Spaced repetition");
    expect(retrieval.items[1]?.card.title).toContain("Retrieval practice");
    expect(retrieval.strategy).toBe("embedding-rerank");
  });

  it("keeps retrieval on the embedding and rerank pipeline for all configured providers", async () => {
    const service = createMemduckService({
      providerFetch: createOpenAICompatibleFetcher({
        summary: "Semantic summary",
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    await service.ingest({
      kind: "text",
      payload: {
        text: "Semantic memory needs grounding in the cards you have already saved.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const retrieval = await service.retrieveCards({
      limit: 1,
      query: "supply chain risk exposure",
    });

    expect(retrieval.items).toHaveLength(1);
    expect(retrieval.strategy).toBe("embedding-rerank");
  });

  it("supports date filters for grounded retrieval", async () => {
    let currentTime = new Date("2026-04-10T09:00:00.000Z");
    const service = createMemduckService({
      now: () => currentTime,
      providerFetch: createOpenAICompatibleFetcher({
        summary: "Date filter summary",
      }),
      runtimeDir: testRuntimeDir,
    });

    service.saveProviderSettings(defaultProviderSettings());

    await service.ingest({
      kind: "text",
      payload: {
        text: "Memory systems need weekly review rituals to stay useful.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    currentTime = new Date("2026-04-20T09:00:00.000Z");

    await service.ingest({
      kind: "text",
      payload: {
        text: "Recent memory work emphasizes weekly review plus retrieval prompts.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const retrieval = await service.retrieveCards({
      filters: {
        dateFrom: "2026-04-15T00:00:00.000Z",
      },
      limit: 5,
      query: "weekly review",
    });

    expect(retrieval.items).toHaveLength(1);
    expect(retrieval.items[0]?.card.title).toContain("Recent memory work");
  });

  it("compiles topic and review state into stored summaries instead of only heuristics", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.at(-1)?.content ?? "";

      if (
        prompt.includes("Compile a quick memory card") ||
        prompt.includes("Compile a deep memory card") ||
        prompt.includes("Compile a memory card")
      ) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    deepSummary: "Compiled summary for the saved memory card.",
                    evidence: ["Compiled summary"],
                    keyPoints: ["Compiled summary"],
                    summary: "Compiled summary",
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
                        confidence: 0.9,
                        keywords: ["memory retention", "review cadence"],
                        name: "Memory Retention",
                        reason:
                          "The card is about durable memory and review cadence.",
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

      if (prompt.includes("Compile a topic summary")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"summary":"Memory retention topic summary","repeatedPoints":["retrieval practice matters","review cadence matters"],"conflictPoints":["daily vs weekly review"],"nextQuestions":["Which cadence fits this topic best?"]}',
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

      if (prompt.includes("Compile review buckets")) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    '{"today":["card-1"],"staleHighValue":["card-2"],"themeMomentum":["card-1","card-2"]}',
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

      if (prompt.includes("Return JSON with rankedIds")) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"rankedIds":["card-1"]}' } }],
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200,
          },
        );
      }

      if (String(_input).endsWith("/embeddings")) {
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

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Compiled summary" } }],
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
        answerModel: "gpt-answer",
        apiKey: "sk-test",
        baseUrl: "https://api.example.com/v1",
        embeddingModel: "text-embedding-3-small",
        id: "openai-main",
        kind: "openai",
        name: "OpenAI Main",
        rerankModel: "gpt-rerank",
        summarizeModel: "gpt-summary",
        visionModel: "gpt-vision",
      },
      { makeActive: true },
    );

    await service.ingest({
      kind: "text",
      payload: {
        text: "Retrieval practice is one of the strongest signals for durable learning.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "One author prefers daily review while another prefers weekly review for long-term recall.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    await service.compileKnowledge();

    const compiledTopics = service.listCompiledTopics();
    const compiledReview = service.getCompiledReviewBuckets();

    expect(compiledTopics.length).toBeGreaterThan(0);
    expect(compiledTopics[0]?.summary).toBe("Memory retention topic summary");
    expect(compiledTopics[0]?.nextQuestions[0]).toContain("cadence");
    if (!compiledReview) {
      throw new Error("Compiled review buckets were not generated.");
    }
    expect(compiledReview.today.length).toBeGreaterThan(0);
    expect(compiledReview.staleHighValue.length).toBeGreaterThan(0);
  });

  it("reports extension connection status from stored heartbeats", () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-20T12:10:00.000Z"),
      runtimeDir: testRuntimeDir,
    });

    service.recordChannelHeartbeat({
      channel: "extension",
      metadata: {
        baseUrl: "http://127.0.0.1:3000",
        extensionVersion: "0.1.0",
      },
      occurredAt: "2026-04-20T12:09:30.000Z",
    });

    const status = getExtensionConnectionStatus(
      service.getChannelConnectionStatus("extension"),
      new Date("2026-04-20T12:10:00.000Z"),
    );

    expect(status.connected).toBe(true);
    expect(status.label).toContain("Connected");
  });

  it("supports memduck init, doctor, help, and dev CLI commands", async () => {
    const {
      buildDoctorReport,
      buildUsageText,
      parseCliArgs,
      scaffoldInitFiles,
    } = await import("../scripts/cli");

    expect(parseCliArgs(["init"])).toEqual({
      command: "init",
      flags: {},
      invalidCommand: null,
    });
    expect(parseCliArgs(["doctor"])).toEqual({
      command: "doctor",
      flags: {},
      invalidCommand: null,
    });
    expect(parseCliArgs(["dev", "--with-telegram"])).toEqual({
      command: "dev",
      flags: { withTelegram: true },
      invalidCommand: null,
    });
    expect(parseCliArgs(["ship-it"])).toEqual({
      command: "help",
      flags: {},
      invalidCommand: "ship-it",
    });

    await scaffoldInitFiles({
      cwd: testRuntimeDir,
      runtimeDir: `${testRuntimeDir}/runtime`,
    });

    const fs = await import("node:fs/promises");
    const envFile = await fs.readFile(`${testRuntimeDir}/.env.local`, "utf8");

    expect(envFile).toContain("MEMDUCK_RUNTIME_DIR=");
    expect(envFile).toContain("MEMDUCK_BASE_URL=");

    expect(
      buildDoctorReport({
        hasEnvLocal: true,
        hasRuntimeDir: true,
        providerConfigured: true,
        telegramConfigured: false,
      }),
    ).toContain("Provider: configured");
    expect(buildUsageText("ship-it")).toContain("Unknown command: ship-it");
    expect(buildUsageText()).toContain("memduck doctor");
  });
});
