import path from "node:path";
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
});
