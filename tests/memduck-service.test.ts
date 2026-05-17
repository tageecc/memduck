import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createMemduckService,
  type InputEnvelope,
} from "../src/lib/memduck/service";
import { createAssetStore } from "../src/lib/storage/assets";
import {
  createOpenAICompatibleFetcher,
  defaultProviderSettings,
} from "./support/provider-fixtures";

const testRuntimeDir = path.join(process.cwd(), ".memduck/test-runtime");

describe("createMemduckService", () => {
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

  it("persists captures from web, extension, and telegram into SQLite-backed memory cards", async () => {
    const providerFetch = createOpenAICompatibleFetcher({
      summary: "Structured summary for saved memory.",
      vision: {
        extractedText: "Cluster labels from screenshot",
        keyPoints: ["topic cluster", "memory grouping"],
        summary: "Topic cluster screenshot",
      },
    });
    const service = createMemduckService({
      contentFetch: async () =>
        new Response(
          `
            <!doctype html>
            <html>
              <body>
                <article>
                  <h1>Personal Memory Engine Notes</h1>
                  <p>Digest first, archive second.</p>
                </article>
              </body>
            </html>
          `,
          {
            headers: { "content-type": "text/html; charset=utf-8" },
            status: 200,
          },
        ),
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch,
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());
    const assetStore = createAssetStore(testRuntimeDir);
    const uploadedImage = assetStore.saveBuffer({
      bytes: Buffer.from("cluster-image"),
      fileName: "cluster.png",
      mimeType: "image/png",
      prefix: "uploads",
    });

    const envelopes: InputEnvelope[] = [
      {
        kind: "url",
        payload: { url: "https://example.com/personal-memory-engine" },
        requestedDepth: "quick",
        sourceChannel: "web",
        sourceContext: { pageTitle: "Personal Memory Engine Notes" },
      },
      {
        kind: "text",
        payload: {
          text: "Repeated retrieval practice makes saved material more reusable.",
        },
        requestedDepth: "save",
        sourceChannel: "extension",
      },
      {
        kind: "image",
        payload: {
          fileName: uploadedImage.fileName,
          mimeType: uploadedImage.mimeType,
          objectKey: uploadedImage.objectKey,
        },
        requestedDepth: "deep",
        sourceChannel: "telegram",
        sourceContext: { caption: "Topic cluster screenshot" },
      },
    ];

    for (const envelope of envelopes) {
      await service.ingest(envelope);
    }

    const cards = service.listMemoryCards();

    expect(cards).toHaveLength(3);
    expect(cards.map((card) => card.sourceChannel)).toEqual([
      "telegram",
      "extension",
      "web",
    ]);
    expect(cards[0]?.title).toContain("Topic");
  });

  it("treats save, quick, and deep as distinct ingest stages", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        summary: "Staged memory summary",
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const saved = await service.ingest({
      kind: "text",
      payload: {
        text: "Save-first notes should land in the inbox before deep digestion.",
      },
      requestedDepth: "save",
      sourceChannel: "web",
    });

    const quick = await service.ingest({
      kind: "text",
      payload: {
        text: "Quick analysis should create a usable card without topic compilation.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const deep = await service.ingest({
      kind: "text",
      payload: {
        text: "Deep analysis should produce topic links and a compiled-ready memory card.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    expect(saved.memoryCard.status).toBe("saved");
    expect(saved.memoryCard.summary).toBe("");
    expect(service.listSourceChunks(saved.sourceItem.id)).toHaveLength(0);
    expect(service.listTopicLinksForCard(saved.memoryCard.id)).toHaveLength(0);

    expect(quick.memoryCard.status).toBe("quick_ready");
    expect(quick.memoryCard.summary).toContain("Quick analysis");
    expect(
      service.listSourceChunks(quick.sourceItem.id).length,
    ).toBeGreaterThan(0);
    expect(service.listTopicLinksForCard(quick.memoryCard.id)).toHaveLength(0);

    expect(deep.memoryCard.status).toBe("deep_ready");
    expect(service.listSourceChunks(deep.sourceItem.id).length).toBeGreaterThan(
      0,
    );
    expect(
      service.listTopicLinksForCard(deep.memoryCard.id).length,
    ).toBeGreaterThan(0);
  });

  it("upgrades quick cards to deep with local topic fallback when topic resolution stalls", async () => {
    const baseFetcher = createOpenAICompatibleFetcher({
      summary: "Next.js topic fallback summary",
    });
    let failTopicResolution = false;
    let deepDigestCalls = 0;
    const providerFetch = async (
      request: Parameters<typeof fetch>[0],
      init: Parameters<typeof fetch>[1],
    ) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages
        ?.map((message) => message.content)
        .join("\n");

      if (prompt?.includes("Compile a deep memory card")) {
        deepDigestCalls += 1;
        throw new Error("Deep digest should not be repeated.");
      }

      if (failTopicResolution && prompt?.includes("Resolve topic links")) {
        throw new Error("Provider request timed out.");
      }

      return baseFetcher(request, init);
    };
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch,
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const quick = await service.ingest({
      kind: "text",
      payload: {
        text: "Next.js fallback topics should still close the memory loop after quick analysis.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    failTopicResolution = true;
    const deep = await service.analyzeMemoryCard(quick.memoryCard.id, "deep");

    expect(deep.status).toBe("deep_ready");
    expect(deep.topicIds.length).toBe(1);
    expect(deepDigestCalls).toBe(0);
    expect(service.listTopicLinksForCard(deep.id)).toHaveLength(1);
    expect(service.listTopics()[0]?.name).toBe("Next");
  });

  it("falls back to local topics when deep ingest topic resolution fails", async () => {
    const baseFetcher = createOpenAICompatibleFetcher({
      summary: "React local topic fallback summary",
    });
    const providerFetch = async (
      request: Parameters<typeof fetch>[0],
      init: Parameters<typeof fetch>[1],
    ) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages
        ?.map((message) => message.content)
        .join("\n");

      if (prompt?.includes("Resolve topic links")) {
        throw new Error("Provider request timed out.");
      }

      return baseFetcher(request, init);
    };
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch,
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const result = await service.ingest({
      kind: "text",
      payload: {
        text: "React notes should still receive a topic even if remote topic resolution fails.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    expect(result.memoryCard.status).toBe("deep_ready");
    expect(result.memoryCard.topicIds.length).toBe(1);
    expect(service.listTopicLinksForCard(result.memoryCard.id)).toHaveLength(1);
    expect(service.listTopics()[0]?.name).toBe("React");
  });

  it("normalizes legacy ready cards to quick-ready status", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        summary: "Legacy status summary",
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const result = await service.ingest({
      kind: "text",
      payload: {
        text: "Legacy ready rows should still count as analyzed memories.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const database = new Database(path.join(testRuntimeDir, "memduck.sqlite"));
    database
      .prepare("UPDATE memory_cards SET status = ? WHERE id = ?")
      .run("ready", result.memoryCard.id);
    database.close();

    expect(service.getMemoryCard(result.memoryCard.id)?.status).toBe(
      "quick_ready",
    );
    expect(service.listMemoryCards()[0]?.status).toBe("quick_ready");
  });

  it("fails image ingest when visual analysis does not return usable output", async () => {
    const service = createMemduckService({
      providerFetch: createOpenAICompatibleFetcher({
        vision: {
          extractedText: "",
          keyPoints: [],
          summary: "",
        },
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());
    const assetStore = createAssetStore(testRuntimeDir);
    const uploadedImage = assetStore.saveBuffer({
      bytes: Buffer.from("broken-image"),
      fileName: "broken.png",
      mimeType: "image/png",
      prefix: "uploads",
    });

    await expect(
      service.ingest({
        kind: "image",
        payload: {
          fileName: uploadedImage.fileName,
          mimeType: uploadedImage.mimeType,
          objectKey: uploadedImage.objectKey,
        },
        requestedDepth: "deep",
        sourceChannel: "telegram",
      }),
    ).rejects.toThrow("Provider returned an invalid vision payload.");
    expect(service.listMemoryCards()).toHaveLength(0);
  });

  it("answers questions with citations grounded in saved cards", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        answer: "memory loops and evidence make saved material reusable.",
        summary: "Memory note summary",
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    await service.ingest({
      kind: "text",
      payload: {
        text: "Memory systems become more useful when review and retrieval are part of the loop.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
      sourceContext: { caption: "memory systems note" },
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "Creators need compressed notes that can be reopened with context and evidence.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    const answer = await service.ask({
      question: "What have I saved about memory?",
    });

    expect(answer.answer).toContain("memory");
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.citations[0]?.cardId).toBeTruthy();
    expect(answer.citations[0]?.chunkId).toBeTruthy();
    expect(answer.citations[0]?.quote).toContain("Memory systems");
    expect(answer.citations[0]?.startOffset).toBeGreaterThanOrEqual(0);
    expect(answer.citations[0]?.endOffset).toBeGreaterThan(
      answer.citations[0]?.startOffset ?? 0,
    );
  });

  it("supports narrowing Ask to a single memory card", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        answer: "focused answer",
        summary: "Focused summary",
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const first = await service.ingest({
      kind: "text",
      payload: {
        text: "Retrieval practice strengthens memory when notes are revisited.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "Channel configuration matters when routing captures from Telegram.",
      },
      requestedDepth: "quick",
      sourceChannel: "telegram",
    });

    const answer = await service.ask({
      filters: {
        cardIds: [first.memoryCard.id],
      },
      question: "What did I save here?",
    });

    expect(answer.citations).toHaveLength(1);
    expect(answer.citations[0]?.cardId).toBe(first.memoryCard.id);
  });

  it("keeps Ask citations when retrieval falls back to local token ranking", async () => {
    const baseFetcher = createOpenAICompatibleFetcher({
      answer: "Next.js routing answer",
      summary: "Next.js routing summary",
    });
    let stallSearchEmbedding = false;
    const providerFetch = async (
      request: Parameters<typeof fetch>[0],
      init: Parameters<typeof fetch>[1],
    ) => {
      if (stallSearchEmbedding && String(request).endsWith("/embeddings")) {
        return new Promise<Response>(() => undefined);
      }

      return baseFetcher(request, init);
    };
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch,
      retrievalProviderDeadlineMs: 10,
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const card = await service.ingest({
      kind: "text",
      payload: {
        text: "Next.js routing keeps React applications navigable with file-based routes.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    stallSearchEmbedding = true;
    const answer = await service.ask({
      filters: {
        cardIds: [card.memoryCard.id],
      },
      question: "What did I save about Next.js routing?",
    });

    expect(answer.answer).toContain("Next.js routing answer");
    expect(answer.citations).toHaveLength(1);
    expect(answer.citations[0]?.cardId).toBe(card.memoryCard.id);
    expect(answer.citations[0]?.quote).toContain("Next.js routing");
  });

  it("ranks review candidates using value, recency gap, and interaction signals", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        summary: "Review summary",
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const first = await service.ingest({
      kind: "text",
      payload: {
        text: "High value note about memory retrieval loops and review routines.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "Short note about a generic product update with less lasting value.",
      },
      requestedDepth: "save",
      sourceChannel: "web",
    });

    service.recordSignal({
      cardId: first.memoryCard.id,
      createdAt: new Date("2026-04-18T11:00:00.000Z"),
      id: "signal-1",
      topicId: first.memoryCard.topicIds[0],
      type: "ask",
    });

    const review = service.listReviewCards();

    expect(review[0]?.id).toBe(first.memoryCard.id);
  });

  it("persists Telegram assistant state across service instances", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      runtimeDir: testRuntimeDir,
    });

    service.saveTelegramChatState("chat-42", {
      lastCardId: "card-1",
    });
    service.saveTelegramChatState("chat-42", {
      lastConversationId: "conversation-1",
    });

    const reloaded = createMemduckService({
      now: () => new Date("2026-04-18T12:05:00.000Z"),
      runtimeDir: testRuntimeDir,
    });

    expect(reloaded.getTelegramChatState("chat-42")).toMatchObject({
      chatId: "chat-42",
      lastCardId: "card-1",
      lastConversationId: "conversation-1",
    });
  });

  it("renames, merges, and unlinks topics while keeping card topic ids consistent", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        summary: "Topic management summary",
        topicResolution: (prompt) =>
          prompt.includes("Interface systems")
            ? {
                matches: [],
                newTopics: [
                  {
                    confidence: 0.86,
                    keywords: ["interface systems", "visual tokens"],
                    name: "Interface Systems",
                    reason: "The card focuses on interface systems.",
                  },
                ],
              }
            : {
                matches: [],
                newTopics: [
                  {
                    confidence: 0.94,
                    keywords: ["retrieval practice", "memory review"],
                    name: "Retrieval Practice",
                    reason: "The card focuses on retrieval practice.",
                  },
                ],
              },
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const retrieval = await service.ingest({
      kind: "text",
      payload: {
        text: "Retrieval practice turns review into long-term memory.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    const design = await service.ingest({
      kind: "text",
      payload: {
        text: "Interface systems depend on consistent visual tokens.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    const retrievalTopicId = retrieval.memoryCard.topicIds[0] ?? "";
    const designTopicId = design.memoryCard.topicIds[0] ?? "";

    const renamed = service.renameTopic(retrievalTopicId, {
      keywords: ["knowledge retention", "retrieval practice"],
      name: "Knowledge Retention",
    });

    expect(renamed.name).toBe("Knowledge Retention");
    expect(renamed.slug).toBe("knowledge-retention");

    const merged = service.mergeTopics({
      sourceTopicId: designTopicId,
      targetTopicId: retrievalTopicId,
    });

    expect(merged.id).toBe(retrievalTopicId);
    expect(service.getTopicBySlug("interface-systems")).toBeUndefined();
    expect(service.getTopicCards(retrievalTopicId)).toHaveLength(2);
    expect(service.getMemoryCard(design.memoryCard.id)?.topicIds).toEqual([
      retrievalTopicId,
    ]);

    const unlinked = service.removeTopicLink({
      cardId: design.memoryCard.id,
      topicId: retrievalTopicId,
    });

    expect(unlinked.topicIds).toEqual([]);
    expect(service.getTopicCards(retrievalTopicId)).toHaveLength(1);
  });

  it("invalidates compiled knowledge after deleting a memory card", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        reviewCompilation: {
          staleHighValue: [],
          themeMomentum: [],
          today: ["card-1"],
        },
        summary: "Deletion cache summary",
        topicCompilation: {
          conflictPoints: [],
          nextQuestions: ["What changed after deletion?"],
          repeatedPoints: ["Deletion should refresh compiled memory views."],
          summary: "Compiled deletion topic",
        },
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const saved = await service.ingest({
      kind: "text",
      payload: {
        text: "Retrieval practice notes should disappear from compiled review after deletion.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    await service.compileKnowledge();
    expect(service.needsKnowledgeCompilation()).toBe(false);

    service.deleteMemoryCard(saved.memoryCard.id);

    expect(service.getCompiledReviewBuckets()).toBeNull();
    expect(service.listCompiledTopics()).toEqual([]);
    expect(service.needsKnowledgeCompilation()).toBe(false);
  });
});
