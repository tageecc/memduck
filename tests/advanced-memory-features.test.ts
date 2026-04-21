import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMemduckService } from "../src/lib/memduck/service";
import {
  createAssetStore,
  downloadTelegramPhotoToAssetStore,
} from "../src/lib/storage/assets";
import {
  createOpenAICompatibleFetcher,
  defaultProviderSettings,
} from "./support/provider-fixtures";

const testRuntimeDir =
  "/Users/tagecc/Documents/workspace/memduck/.memduck/advanced-test-runtime";

describe("advanced memory features", () => {
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

  it("extracts readable body text and stores an html snapshot for url captures", async () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Ignored chrome</title>
        </head>
        <body>
          <nav>menu</nav>
          <article>
            <h1>Memory Systems Need Retrieval</h1>
            <p>Retrieval practice turns saved information into reusable memory.</p>
            <p>Compression without recall still leaves people with clutter.</p>
          </article>
        </body>
      </html>
    `;

    const service = createMemduckService({
      contentFetch: async () =>
        new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
          status: 200,
        }),
      now: () => new Date("2026-04-20T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        summary: "Retrieval practice summary",
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const result = await service.ingest({
      kind: "url",
      payload: { url: "https://example.com/retrieval-practice" },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const source = service.getSourceItem(result.sourceItem.id);

    expect(source?.bodyText).toContain(
      "Retrieval practice turns saved information into reusable memory.",
    );
    expect(source?.snapshotPath).toContain("snapshots");
    expect(result.memoryCard.summary).toContain("Retrieval practice");
  });

  it("stores uploaded image assets locally and can download telegram images into the runtime", async () => {
    const assetStore = createAssetStore(testRuntimeDir);

    const uploaded = await assetStore.saveBuffer({
      bytes: Buffer.from("image-bytes"),
      fileName: "capture.png",
      mimeType: "image/png",
      prefix: "uploads",
    });

    expect(uploaded.objectKey).toContain("uploads/");
    expect(assetStore.readAsBuffer(uploaded.objectKey).toString("utf8")).toBe(
      "image-bytes",
    );

    const telegramAsset = await downloadTelegramPhotoToAssetStore({
      assetStore,
      fetcher: async () =>
        new Response(Buffer.from("telegram-image"), { status: 200 }),
      photoUrl: "https://api.telegram.org/file/bot-token/path/photo.jpg",
    });

    expect(telegramAsset.objectKey).toContain("telegram/");
    expect(
      assetStore.readAsBuffer(telegramAsset.objectKey).toString("utf8"),
    ).toBe("telegram-image");
  });

  it("persists multi-turn ask conversations and exposes grouped review/topic insights", async () => {
    const service = createMemduckService({
      now: () => new Date("2026-04-20T12:00:00.000Z"),
      providerFetch: createOpenAICompatibleFetcher({
        answer: "retrieval practice keeps showing up across saved memory.",
        reviewCompilation: {
          staleHighValue: ["card-1", "card-2"],
          themeMomentum: ["card-1", "card-2"],
          today: ["card-1"],
        },
        summary: "Topic memory summary",
        topicCompilation: {
          conflictPoints: ["daily vs weekly review"],
          nextQuestions: ["Which cadence best fits this topic?"],
          repeatedPoints: ["retrieval practice matters"],
          summary: "Compiled topic summary",
        },
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const first = await service.ingest({
      kind: "text",
      payload: {
        text: "Retrieval practice keeps resurfacing as the most effective way to retain ideas over time.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "Another source says retrieval practice works best when paired with spaced review every week.",
      },
      requestedDepth: "deep",
      sourceChannel: "web",
    });

    await service.ingest({
      kind: "text",
      payload: {
        text: "One writer claims retrieval practice needs daily review, while another says retrieval practice becomes noisy when review happens every day and should stay weekly.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    const firstAnswer = await service.ask({
      question: "What have I saved about retrieval practice?",
    });

    const secondAnswer = await service.ask({
      conversationId: firstAnswer.conversationId,
      question: "What tension is there around review cadence?",
    });

    expect(firstAnswer.conversationId).toBeTruthy();
    expect(secondAnswer.conversationId).toBe(firstAnswer.conversationId);
    expect(
      service.getConversationMessages(firstAnswer.conversationId ?? "").length,
    ).toBe(4);

    const topicId = first.memoryCard.topicIds[0] ?? "";
    await service.ensureKnowledgeCompiled();
    const topicInsights = service.getTopicInsights(topicId);
    const reviewSections = service.getReviewSections();

    expect(topicInsights?.repeatedPoints.length).toBeGreaterThan(0);
    expect(topicInsights?.conflictPoints.length).toBeGreaterThan(0);
    expect(reviewSections.today.length).toBeGreaterThan(0);
    expect(reviewSections.staleHighValue.length).toBeGreaterThan(0);
  });

  it("tracks explicit memory signals and lets them influence review priority", async () => {
    let currentTime = new Date("2026-04-20T12:00:00.000Z");
    const service = createMemduckService({
      now: () => currentTime,
      providerFetch: createOpenAICompatibleFetcher({
        summary: "Signal summary",
      }),
      runtimeDir: testRuntimeDir,
    });
    service.saveProviderSettings(defaultProviderSettings());

    const first = await service.ingest({
      kind: "text",
      payload: {
        text: "A saved note about retrieval prompts and spaced review rituals.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    currentTime = new Date("2026-04-20T12:05:00.000Z");

    const second = await service.ingest({
      kind: "text",
      payload: {
        text: "A separate note about interface systems and token consistency.",
      },
      requestedDepth: "quick",
      sourceChannel: "web",
    });

    service.recordSignal({
      cardId: first.memoryCard.id,
      createdAt: currentTime.toISOString(),
      id: "signal-star-1",
      topicId: first.memoryCard.topicIds[0],
      type: "star",
    });
    service.recordSignal({
      cardId: first.memoryCard.id,
      createdAt: currentTime.toISOString(),
      id: "signal-highlight-1",
      topicId: first.memoryCard.topicIds[0],
      type: "highlight",
    });
    service.recordSignal({
      cardId: first.memoryCard.id,
      createdAt: currentTime.toISOString(),
      id: "signal-review-1",
      topicId: first.memoryCard.topicIds[0],
      type: "review_request",
    });

    const summary = service.getCardSignalSummary(first.memoryCard.id);
    const reviewCards = service.listReviewCards();

    expect(summary.counts.star).toBe(1);
    expect(summary.counts.highlight).toBe(1);
    expect(summary.counts.review_request).toBe(1);
    expect(summary.total).toBeGreaterThan(summary.counts.save);
    expect(reviewCards[0]?.id).toBe(first.memoryCard.id);
    expect(reviewCards[1]?.id).toBe(second.memoryCard.id);
  });
});
