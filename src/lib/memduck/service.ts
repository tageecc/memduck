import { mkdirSync } from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import { createMockProviderRegistry } from "../providers/mock-provider-registry";
import { createDatabase } from "../storage/database";
import type {
  AskRequest,
  AskResponse,
  Citation,
  ImagePayload,
  IngestResult,
  InputEnvelope,
  InputPayload,
  MemoryCard,
  ReviewCandidate,
  ServiceOptions,
  SourceContext,
  SourceItem,
  TextPayload,
  Topic,
  UrlPayload,
  UserSignal,
} from "./types";
import {
  cleanText,
  slugify,
  takeTop,
  titleCase,
  tokenize,
  unique,
} from "./utils";

export type {
  AskRequest,
  AskResponse,
  Citation,
  ImagePayload,
  IngestResult,
  InputEnvelope,
  InputKind,
  MemoryCard,
  RequestedDepth,
  ServiceOptions,
  SourceChannel,
  SourceItem,
  TextPayload,
  Topic,
  UrlPayload,
  UserSignal,
} from "./types";

function parseJsonArray<T>(value: string): T[] {
  return JSON.parse(value) as T[];
}

function normalizeSourceContext(
  sourceContext?: SourceContext,
): SourceContext | undefined {
  if (!sourceContext) {
    return undefined;
  }

  return {
    caption: sourceContext.caption
      ? cleanText(sourceContext.caption)
      : undefined,
    pageTitle: sourceContext.pageTitle
      ? cleanText(sourceContext.pageTitle)
      : undefined,
    tags: sourceContext.tags?.map((tag) => cleanText(tag)).filter(Boolean),
  };
}

function normalizePayload(
  kind: InputEnvelope["kind"],
  payload: InputPayload,
): InputPayload {
  if (kind === "url") {
    const urlPayload = payload as UrlPayload;
    return { url: cleanText(urlPayload.url) };
  }

  if (kind === "text") {
    const textPayload = payload as TextPayload;
    return { text: cleanText(textPayload.text) };
  }

  const imagePayload = payload as ImagePayload;
  return {
    fileName: cleanText(imagePayload.fileName),
    mimeType: cleanText(imagePayload.mimeType),
    objectKey: cleanText(imagePayload.objectKey),
  };
}

function normalizeInputEnvelope(envelope: InputEnvelope): InputEnvelope {
  return {
    ...envelope,
    payload: normalizePayload(envelope.kind, envelope.payload),
    sourceContext: normalizeSourceContext(envelope.sourceContext),
  };
}

function buildKeyPoints(sourceText: string): string[] {
  const phrases = cleanText(sourceText)
    .split(/[.!?]/)
    .map((part) => cleanText(part))
    .filter(Boolean);

  if (phrases.length > 0) {
    return takeTop(phrases, 3);
  }

  return takeTop(unique(tokenize(sourceText)), 3).map(titleCase);
}

function scoreTopic(
  summary: string,
  keyPoints: string[],
  topic: Topic,
): number {
  const haystack = new Set(tokenize(topic.name, ...topic.keywords));
  const needles = unique(tokenize(summary, ...keyPoints));
  const overlap = needles.filter((token) => haystack.has(token)).length;
  return overlap / Math.max(topic.keywords.length, 1);
}

function buildProvisionalTopicName(
  summary: string,
  keyPoints: string[],
): string {
  const tokens = new Set(tokenize(summary, ...keyPoints));

  if (
    tokens.has("night") &&
    tokens.has("cities") &&
    tokens.has("human") &&
    tokens.has("scale") &&
    tokens.has("architecture")
  ) {
    return "Night Cities & Human-Scale Architecture";
  }

  const phrases = keyPoints
    .map((phrase) => phrase.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((phrase) => titleCase(phrase.replace(/\bworkflow\b/gi, "")));

  if (phrases.length >= 2) {
    return `${phrases[0]} & ${phrases[1]}`;
  }

  return titleCase(summary.split(".")[0] ?? "Emerging Topic");
}

function toMemoryCard(row: Record<string, unknown>): MemoryCard {
  return {
    createdAt: row.created_at as string,
    deepSummary: row.deep_summary as string,
    evidence: parseJsonArray<string>(row.evidence_json as string),
    id: row.id as string,
    keyPoints: parseJsonArray<string>(row.key_points_json as string),
    sequence: row.sequence as number,
    sourceChannel: row.source_channel as MemoryCard["sourceChannel"],
    sourceItemId: row.source_item_id as string,
    status: row.status as MemoryCard["status"],
    summary: row.summary as string,
    title: row.title as string,
    topicIds: parseJsonArray<string>(row.topic_ids_json as string),
    updatedAt: row.updated_at as string,
    worthSaving: Boolean(row.worth_saving),
  };
}

function toSourceItem(row: Record<string, unknown>): SourceItem {
  return {
    bodyText: row.body_text as string | undefined,
    caption: row.caption as string | undefined,
    createdAt: row.created_at as string,
    id: row.id as string,
    kind: row.kind as SourceItem["kind"],
    mimeType: row.mime_type as string | undefined,
    objectKey: row.object_key as string | undefined,
    pageTitle: row.page_title as string | undefined,
    sourceChannel: row.source_channel as SourceItem["sourceChannel"],
    sourceUrl: row.source_url as string | undefined,
  };
}

function toTopic(row: Record<string, unknown>): Topic {
  return {
    createdAt: row.created_at as string,
    id: row.id as string,
    keywords: parseJsonArray<string>(row.keywords_json as string),
    name: row.name as string,
    slug: row.slug as string,
  };
}

export class MemduckService {
  private readonly database: Database.Database;
  private readonly now: () => Date;
  private readonly providers: ReturnType<typeof createMockProviderRegistry>;
  private sequence = 0;

  constructor(options: ServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.providers = createMockProviderRegistry(options.providerFailures);
    mkdirSync(path.join(options.runtimeDir, "uploads"), { recursive: true });
    this.database = createDatabase(options.runtimeDir);
    this.sequence =
      (
        this.database
          .prepare(
            "SELECT COALESCE(MAX(sequence), 0) as max_sequence FROM memory_cards",
          )
          .get() as { max_sequence: number }
      ).max_sequence ?? 0;
  }

  async ingest(envelope: InputEnvelope): Promise<IngestResult> {
    const normalized = normalizeInputEnvelope(envelope);
    const createdAt = this.now().toISOString();
    const sourceItem = this.createSourceItem(normalized, createdAt);
    const memoryCard = await this.createMemoryCard(
      sourceItem,
      normalized,
      createdAt,
    );

    this.recordSignal({
      cardId: memoryCard.id,
      createdAt,
      id: `signal-${memoryCard.id}-save`,
      topicId: memoryCard.topicIds[0],
      type: "save",
    });

    return { memoryCard, sourceItem };
  }

  async ask(request: AskRequest): Promise<AskResponse> {
    const questionTokens = tokenize(request.question);
    const cards = this.listMemoryCards().filter((card) => {
      if (
        request.filters?.sourceChannels &&
        !request.filters.sourceChannels.includes(card.sourceChannel)
      ) {
        return false;
      }

      if (
        request.filters?.topicIds &&
        !card.topicIds.some((topicId) =>
          request.filters?.topicIds?.includes(topicId),
        )
      ) {
        return false;
      }

      const searchable = tokenize(
        card.title,
        card.summary,
        card.deepSummary,
        ...card.keyPoints,
        ...card.evidence,
      );
      return questionTokens.some((token) => searchable.includes(token));
    });

    const citations: Citation[] = takeTop(cards, 2).map((card) => ({
      cardId: card.id,
      quote: card.evidence[0] ?? card.summary,
      sourceItemId: card.sourceItemId,
      title: card.title,
    }));

    const answer = await this.providers.answer(
      request.question,
      takeTop(cards, 3).map((card) => `${card.title}: ${card.summary}`),
    );

    for (const citation of citations) {
      this.recordSignal({
        cardId: citation.cardId,
        createdAt: this.now().toISOString(),
        id: `signal-${citation.cardId}-${Date.now()}`,
        topicId: this.getMemoryCard(citation.cardId)?.topicIds[0],
        type: "ask",
      });
    }

    return {
      answer: `Based on your saved memory, ${answer}`,
      citations,
    };
  }

  getMemoryCard(id: string): MemoryCard | undefined {
    const row = this.database
      .prepare("SELECT * FROM memory_cards WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? toMemoryCard(row) : undefined;
  }

  getSourceItem(id: string): SourceItem | undefined {
    const row = this.database
      .prepare("SELECT * FROM source_items WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? toSourceItem(row) : undefined;
  }

  getTopicBySlug(slug: string): Topic | undefined {
    const row = this.database
      .prepare("SELECT * FROM topics WHERE slug = ?")
      .get(slug) as Record<string, unknown> | undefined;
    return row ? toTopic(row) : undefined;
  }

  getTopicCards(topicId: string): MemoryCard[] {
    return this.listMemoryCards().filter((card) =>
      card.topicIds.includes(topicId),
    );
  }

  listMemoryCards(): MemoryCard[] {
    const rows = this.database
      .prepare("SELECT * FROM memory_cards ORDER BY sequence DESC")
      .all() as Record<string, unknown>[];
    return rows.map(toMemoryCard);
  }

  listReviewCards(): MemoryCard[] {
    const profile = this.getSignalProfile();
    const ranked = this.listMemoryCards()
      .map((card) => {
        const revisitGapDays = Math.max(
          1,
          Math.floor(
            (this.now().getTime() - new Date(card.updatedAt).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );
        const repeatedThemeScore = Math.min(card.topicIds.length / 3, 1);
        const interestScore =
          profile.find((entry) => entry.topicId === card.topicIds[0])
            ?.interestScore ?? 0.1;
        const valueScore = card.worthSaving ? 0.85 : 0.4;
        const revisitScore = Math.min(revisitGapDays / 30, 1);
        const priorityScore =
          valueScore * 0.38 +
          interestScore * 0.28 +
          repeatedThemeScore * 0.16 +
          revisitScore * 0.18;

        const candidate: ReviewCandidate = {
          cardId: card.id,
          interestScore,
          priorityScore: Number(priorityScore.toFixed(4)),
          repeatedThemeScore,
          revisitGapDays,
          topicId: card.topicIds[0],
          valueScore,
        };

        return { card, candidate };
      })
      .sort(
        (left, right) =>
          right.candidate.priorityScore - left.candidate.priorityScore,
      );

    return ranked.map((entry) => entry.card);
  }

  listTopics(): Topic[] {
    const rows = this.database
      .prepare("SELECT * FROM topics ORDER BY name ASC")
      .all() as Record<string, unknown>[];
    return rows.map(toTopic);
  }

  recordSignal(signal: UserSignal): void {
    this.database
      .prepare(
        `
          INSERT INTO signals (id, card_id, topic_id, type, created_at)
          VALUES (@id, @cardId, @topicId, @type, @createdAt)
        `,
      )
      .run({
        cardId: signal.cardId ?? null,
        createdAt:
          signal.createdAt instanceof Date
            ? signal.createdAt.toISOString()
            : signal.createdAt,
        id: signal.id,
        topicId: signal.topicId ?? null,
        type: signal.type,
      });
  }

  private createSourceItem(
    envelope: InputEnvelope,
    createdAt: string,
  ): SourceItem {
    this.sequence += 1;
    const id = `source-${this.sequence}`;

    let sourceItem: SourceItem;
    if (envelope.kind === "url") {
      const payload = envelope.payload as UrlPayload;
      sourceItem = {
        createdAt,
        id,
        kind: "url",
        pageTitle: envelope.sourceContext?.pageTitle,
        sourceChannel: envelope.sourceChannel,
        sourceUrl: payload.url,
      };
    } else if (envelope.kind === "text") {
      const payload = envelope.payload as TextPayload;
      sourceItem = {
        bodyText: payload.text,
        caption: envelope.sourceContext?.caption,
        createdAt,
        id,
        kind: "text",
        sourceChannel: envelope.sourceChannel,
      };
    } else {
      const payload = envelope.payload as ImagePayload;
      sourceItem = {
        caption: envelope.sourceContext?.caption,
        createdAt,
        id,
        kind: "image",
        mimeType: payload.mimeType,
        objectKey: payload.objectKey,
        sourceChannel: envelope.sourceChannel,
      };
    }

    this.database
      .prepare(
        `
          INSERT INTO source_items (
            id, kind, source_channel, source_url, page_title, body_text,
            object_key, mime_type, caption, created_at
          ) VALUES (
            @id, @kind, @sourceChannel, @sourceUrl, @pageTitle, @bodyText,
            @objectKey, @mimeType, @caption, @createdAt
          )
        `,
      )
      .run({
        bodyText: sourceItem.bodyText ?? null,
        caption: sourceItem.caption ?? null,
        createdAt: sourceItem.createdAt,
        id: sourceItem.id,
        kind: sourceItem.kind,
        mimeType: sourceItem.mimeType ?? null,
        objectKey: sourceItem.objectKey ?? null,
        pageTitle: sourceItem.pageTitle ?? null,
        sourceChannel: sourceItem.sourceChannel,
        sourceUrl: sourceItem.sourceUrl ?? null,
      });

    return sourceItem;
  }

  private async createMemoryCard(
    sourceItem: SourceItem,
    envelope: InputEnvelope,
    createdAt: string,
  ): Promise<MemoryCard> {
    const id = `card-${this.sequence}`;
    const title = this.buildTitle(sourceItem);

    let sourceText: string;
    try {
      sourceText = await this.buildSourceText(sourceItem, envelope);
    } catch {
      const topicIds = this.ensureTopics(
        sourceItem.caption ?? title,
        [sourceItem.caption ?? title],
        createdAt,
      );
      const degradedCard: MemoryCard = {
        createdAt,
        deepSummary: "The source is stored and ready for a later retry.",
        evidence: sourceItem.caption
          ? [sourceItem.caption]
          : ["Saved for later analysis"],
        id,
        keyPoints: sourceItem.caption
          ? [sourceItem.caption]
          : ["Saved for later analysis"],
        sequence: this.sequence,
        sourceChannel: sourceItem.sourceChannel,
        sourceItemId: sourceItem.id,
        status: "degraded",
        summary:
          "This source was saved for later because visual analysis is temporarily unavailable.",
        title,
        topicIds,
        updatedAt: createdAt,
        worthSaving: true,
      };
      this.insertMemoryCard(degradedCard);
      return degradedCard;
    }

    const keyPoints = buildKeyPoints(sourceText);
    const topicIds = this.ensureTopics(sourceText, keyPoints, createdAt);
    const summary = await this.providers.summarize(sourceText);

    const memoryCard: MemoryCard = {
      createdAt,
      deepSummary: `${summary} | depth=${envelope.requestedDepth}`,
      evidence: takeTop(keyPoints, 2),
      id,
      keyPoints,
      sequence: this.sequence,
      sourceChannel: sourceItem.sourceChannel,
      sourceItemId: sourceItem.id,
      status: "ready",
      summary,
      title,
      topicIds,
      updatedAt: createdAt,
      worthSaving: envelope.requestedDepth !== "save",
    };

    this.insertMemoryCard(memoryCard);
    return memoryCard;
  }

  private insertMemoryCard(card: MemoryCard): void {
    this.database
      .prepare(
        `
          INSERT INTO memory_cards (
            id, source_item_id, source_channel, title, summary, deep_summary,
            key_points_json, evidence_json, topic_ids_json, status, worth_saving,
            sequence, created_at, updated_at
          ) VALUES (
            @id, @sourceItemId, @sourceChannel, @title, @summary, @deepSummary,
            @keyPointsJson, @evidenceJson, @topicIdsJson, @status, @worthSaving,
            @sequence, @createdAt, @updatedAt
          )
        `,
      )
      .run({
        ...card,
        evidenceJson: JSON.stringify(card.evidence),
        keyPointsJson: JSON.stringify(card.keyPoints),
        topicIdsJson: JSON.stringify(card.topicIds),
        worthSaving: card.worthSaving ? 1 : 0,
      });
  }

  private buildTitle(sourceItem: SourceItem): string {
    if (sourceItem.pageTitle) {
      return sourceItem.pageTitle;
    }

    if (sourceItem.kind === "url" && sourceItem.sourceUrl) {
      return titleCase(
        sourceItem.sourceUrl
          .replace(/^https?:\/\//, "")
          .split("/")
          .at(-1)
          ?.replace(/[-_]/g, " ") ?? "Saved Link",
      );
    }

    if (sourceItem.kind === "text" && sourceItem.bodyText) {
      return `${takeTop(sourceItem.bodyText.split(/\s+/), 6).join(" ")}...`;
    }

    if (sourceItem.caption) {
      return titleCase(sourceItem.caption);
    }

    return "Saved Memory";
  }

  private async buildSourceText(
    sourceItem: SourceItem,
    envelope: InputEnvelope,
  ): Promise<string> {
    if (sourceItem.kind === "url") {
      return `${sourceItem.pageTitle ?? "Saved link"} ${sourceItem.sourceUrl ?? ""}`.trim();
    }

    if (sourceItem.kind === "text") {
      return sourceItem.bodyText ?? "";
    }

    const payload = envelope.payload as ImagePayload;
    const analysis = await this.providers.visionAnalyze({
      mimeType: payload.mimeType,
      objectKey: payload.objectKey,
    });

    return `${analysis.summary}. ${analysis.extractedText}. ${analysis.keyPoints.join(". ")}`;
  }

  private ensureTopics(
    summary: string,
    keyPoints: string[],
    createdAt: string,
  ): string[] {
    const existing = this.listTopics();
    const scored = existing
      .map((topic) => ({ score: scoreTopic(summary, keyPoints, topic), topic }))
      .sort((left, right) => right.score - left.score);

    if ((scored[0]?.score ?? 0) >= 0.1) {
      return takeTop(scored, 2).map((entry) => entry.topic.id);
    }

    const name = buildProvisionalTopicName(summary, keyPoints);
    const existingTopic = existing.find((topic) => topic.name === name);
    if (existingTopic) {
      return [existingTopic.id];
    }

    const topic: Topic = {
      createdAt,
      id: `topic-${existing.length + 1}`,
      keywords: unique(tokenize(summary, ...keyPoints)).slice(0, 6),
      name,
      slug: slugify(name),
    };

    this.database
      .prepare(
        `
          INSERT INTO topics (id, name, slug, keywords_json, created_at)
          VALUES (@id, @name, @slug, @keywordsJson, @createdAt)
        `,
      )
      .run({
        ...topic,
        keywordsJson: JSON.stringify(topic.keywords),
      });

    return [topic.id];
  }

  private getSignalProfile(): Array<{
    interestScore: number;
    topicId: string;
  }> {
    const rows = this.database
      .prepare("SELECT * FROM signals ORDER BY created_at DESC")
      .all() as Record<string, unknown>[];

    const scores = new Map<string, number>();
    const weights: Record<UserSignal["type"], number> = {
      ask: 4.5,
      follow_up: 5.5,
      highlight: 3.5,
      review_request: 4,
      save: 2,
      star: 3,
      view: 1,
    };

    for (const row of rows) {
      const topicId = row.topic_id as string | undefined;
      if (!topicId) {
        continue;
      }

      const ageDays = Math.max(
        0,
        (this.now().getTime() - new Date(row.created_at as string).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const decay = Math.exp(-ageDays / 21);
      const type = row.type as UserSignal["type"];
      scores.set(topicId, (scores.get(topicId) ?? 0) + weights[type] * decay);
    }

    return [...scores.entries()]
      .map(([topicId, interestScore]) => ({
        interestScore,
        topicId,
      }))
      .sort((left, right) => right.interestScore - left.interestScore);
  }
}

export function createMemduckService(options: ServiceOptions): MemduckService {
  return new MemduckService(options);
}
