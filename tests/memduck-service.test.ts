import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createMemduckService,
  type InputEnvelope,
} from "../src/lib/memduck/service";

const testRuntimeDir =
  "/Users/tagecc/Documents/workspace/memduck/.memduck/test-runtime";

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
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      runtimeDir: testRuntimeDir,
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
          fileName: "cluster.png",
          mimeType: "image/png",
          objectKey: "uploads/cluster.png",
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

  it("stores degraded image captures even when visual analysis is unavailable", async () => {
    const service = createMemduckService({
      providerFailures: { visionAnalyze: "vision unavailable" },
      runtimeDir: testRuntimeDir,
    });

    const result = await service.ingest({
      kind: "image",
      payload: {
        fileName: "broken.png",
        mimeType: "image/png",
        objectKey: "uploads/broken.png",
      },
      requestedDepth: "deep",
      sourceChannel: "telegram",
    });

    expect(result.memoryCard.status).toBe("degraded");
    expect(result.sourceItem.objectKey).toBe("uploads/broken.png");
    expect(result.memoryCard.summary).toContain("saved for later");
  });

  it("answers questions with citations grounded in saved cards", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      runtimeDir: testRuntimeDir,
    });

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
  });

  it("ranks review candidates using value, recency gap, and interaction signals", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-18T12:00:00.000Z"),
      runtimeDir: testRuntimeDir,
    });

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
