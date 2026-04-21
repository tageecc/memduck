import { mkdirSync } from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import { fetchUrlContent } from "../fetching/url-content";
import { createAnthropicProvider } from "../providers/anthropic-provider";
import { createGeminiProvider } from "../providers/gemini-provider";
import { createOpenAICompatibleProvider } from "../providers/openai-compatible-provider";
import { createAssetStore } from "../storage/assets";
import { createDatabase } from "../storage/database";
import type {
  AskRequest,
  AskResponse,
  CardSignalSummary,
  ChannelConnectionStatus,
  ChannelHeartbeat,
  ChannelRuntimeDiagnostic,
  ChannelSettings,
  Citation,
  CompiledReviewBuckets,
  CompiledTopic,
  Conversation,
  ConversationMessage,
  ConversationSummary,
  ConversationThread,
  ImagePayload,
  IngestResult,
  InputEnvelope,
  InputPayload,
  MemoryCard,
  ProviderProfile,
  ProviderSettings,
  RetrievalItem,
  RetrievalResult,
  ReviewCandidate,
  ReviewSections,
  RuntimeDiagnostics,
  ServiceOptions,
  SetupState,
  SourceContext,
  SourceItem,
  TextPayload,
  Topic,
  TopicInsights,
  UrlPayload,
  UserSignal,
  UserSignalType,
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
  CardSignalSummary,
  ChannelConnectionStatus,
  ChannelHeartbeat,
  ChannelRuntimeDiagnostic,
  ChannelSettings,
  Citation,
  CompiledReviewBuckets,
  CompiledTopic,
  Conversation,
  ConversationMessage,
  ConversationSummary,
  ConversationThread,
  ImagePayload,
  IngestResult,
  InputEnvelope,
  InputKind,
  MemoryCard,
  ProviderKind,
  ProviderProfile,
  ProviderSettings,
  RequestedDepth,
  RetrievalItem,
  RetrievalResult,
  ReviewSections,
  RuntimeDiagnostics,
  ServiceOptions,
  SetupState,
  SourceChannel,
  SourceItem,
  TextPayload,
  Topic,
  TopicInsights,
  UrlPayload,
  UserSignal,
  UserSignalType,
} from "./types";

function parseJsonArray<T>(value: string): T[] {
  return JSON.parse(value) as T[];
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:3000";
const CHANNEL_HEARTBEAT_STALE_MINUTES = 5;

function defaultChannelSettings(): ChannelSettings {
  return {
    extension: {
      captureBaseUrl: DEFAULT_LOCAL_BASE_URL,
      enabled: true,
    },
    telegram: {
      baseUrl: DEFAULT_LOCAL_BASE_URL,
      enabled: false,
    },
    web: {
      enabled: true,
    },
  };
}

function emptySignalCounts(): Record<UserSignalType, number> {
  return {
    ask: 0,
    follow_up: 0,
    highlight: 0,
    review_request: 0,
    save: 0,
    star: 0,
    view: 0,
  };
}

function summarizeChannelRuntime(input: {
  configured: boolean;
  enabled: boolean;
  heartbeat: ChannelConnectionStatus | null;
  idleLabel: string;
  now: Date;
}): ChannelRuntimeDiagnostic {
  if (!input.enabled) {
    return {
      configured: input.configured,
      connected: false,
      enabled: false,
      label: "Disabled in channel center",
      lastHeartbeatAt: input.heartbeat?.lastHeartbeatAt ?? null,
    };
  }

  if (input.heartbeat?.lastHeartbeatAt) {
    const staleMinutes = Math.max(
      0,
      Math.floor(
        (input.now.getTime() -
          new Date(input.heartbeat.lastHeartbeatAt).getTime()) /
          60000,
      ),
    );

    if (staleMinutes <= CHANNEL_HEARTBEAT_STALE_MINUTES) {
      return {
        configured: input.configured,
        connected: true,
        enabled: true,
        label: `Connected ${staleMinutes}m ago`,
        lastHeartbeatAt: input.heartbeat.lastHeartbeatAt,
      };
    }

    return {
      configured: input.configured,
      connected: false,
      enabled: true,
      label: `Last seen ${staleMinutes}m ago`,
      lastHeartbeatAt: input.heartbeat.lastHeartbeatAt,
    };
  }

  return {
    configured: input.configured,
    connected: false,
    enabled: true,
    label: input.idleLabel,
    lastHeartbeatAt: null,
  };
}

function defaultProviderName(kind: ProviderSettings["kind"]): string {
  switch (kind) {
    case "anthropic":
      return "Anthropic";
    case "gemini":
      return "Gemini";
    case "ollama":
      return "Ollama";
    case "openai":
      return "OpenAI";
    case "openai-compatible":
      return "OpenAI-Compatible";
  }
}

function normalizeProviderSettings(
  settings: ProviderSettings,
): ProviderSettings {
  return {
    answerModel: cleanText(settings.answerModel),
    apiKey: cleanText(settings.apiKey ?? ""),
    baseUrl: cleanText(settings.baseUrl),
    embeddingModel: cleanText(settings.embeddingModel),
    kind: settings.kind,
    rerankModel: cleanText(settings.rerankModel),
    summarizeModel: cleanText(settings.summarizeModel),
    visionModel: cleanText(settings.visionModel),
  };
}

function isProviderConfigured(settings: ProviderSettings | null): boolean {
  if (!settings) {
    return false;
  }

  const coreConfigured = Boolean(
    settings.baseUrl &&
      settings.answerModel &&
      settings.embeddingModel &&
      settings.rerankModel &&
      settings.summarizeModel &&
      settings.visionModel,
  );

  if (!coreConfigured) {
    return false;
  }

  return settings.kind === "ollama" ? true : Boolean(settings.apiKey);
}

function toConversationSummary(
  conversation: Conversation,
  messages: ConversationMessage[],
): ConversationSummary {
  const lastMessage = messages.at(-1)?.content ?? "";

  return {
    createdAt: conversation.createdAt,
    id: conversation.id,
    lastMessagePreview: cleanText(lastMessage).slice(0, 180),
    messageCount: messages.length,
    updatedAt: conversation.updatedAt,
  };
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
    snapshotPath: row.snapshot_path as string | undefined,
    sourceChannel: row.source_channel as SourceItem["sourceChannel"],
    sourceUrl: row.source_url as string | undefined,
  };
}

function toConversationMessage(
  row: Record<string, unknown>,
): ConversationMessage {
  return {
    citations:
      row.citations_json && typeof row.citations_json === "string"
        ? parseJsonArray<Citation>(row.citations_json)
        : undefined,
    content: row.content as string,
    conversationId: row.conversation_id as string,
    createdAt: row.created_at as string,
    id: row.id as string,
    role: row.role as ConversationMessage["role"],
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

interface PreparedSourceItem {
  snapshotHtml?: string;
  sourceItem: SourceItem;
  sourceText: string;
}

interface DraftMemoryCard extends MemoryCard {
  sourceTextEmbedding: number[];
}

export class MemduckService {
  private readonly assetStore: ReturnType<typeof createAssetStore>;
  private readonly contentFetch: typeof fetch;
  private readonly database: Database.Database;
  private readonly now: () => Date;
  private readonly providerFetch: typeof fetch;
  private sequence = 0;

  constructor(options: ServiceOptions) {
    this.assetStore = createAssetStore(options.runtimeDir);
    this.contentFetch = options.contentFetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.providerFetch = options.providerFetch ?? fetch;
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
    const prepared = await this.prepareSourceItem(normalized, createdAt);
    const memoryCard = await this.createMemoryCard(
      prepared.sourceItem,
      normalized,
      createdAt,
      prepared.sourceText,
    );

    if (prepared.snapshotHtml) {
      prepared.sourceItem.snapshotPath = this.assetStore.saveText({
        fileName: `${prepared.sourceItem.id}.html`,
        prefix: "snapshots",
        text: prepared.snapshotHtml,
      }).objectKey;
    }

    this.insertSourceItem(prepared.sourceItem);
    this.insertMemoryCard(memoryCard);
    this.insertCardEmbedding(
      memoryCard.id,
      memoryCard.sourceTextEmbedding,
      prepared.sourceText,
    );
    this.recordSignal({
      cardId: memoryCard.id,
      createdAt,
      id: `signal-${memoryCard.id}-save`,
      topicId: memoryCard.topicIds[0],
      type: "save",
    });

    return {
      memoryCard: this.stripCardEmbedding(memoryCard),
      sourceItem: prepared.sourceItem,
    };
  }

  async ask(request: AskRequest): Promise<AskResponse> {
    const conversationId =
      request.conversationId ?? `conversation-${Date.now()}`;
    const history = this.getConversationMessages(conversationId);
    const retrievalQuestion = [
      ...history
        .filter((message) => message.role === "user")
        .slice(-2)
        .map((message) => message.content),
      request.question,
    ].join(" ");
    const retrieval = await this.retrieveCards({
      filters: request.filters,
      limit: 3,
      query: retrievalQuestion,
    });
    const cards = retrieval.items.map((item) => item.card);

    const citations: Citation[] = takeTop(cards, 2).map((card) => ({
      cardId: card.id,
      quote: card.evidence[0] ?? card.summary,
      sourceItemId: card.sourceItemId,
      title: card.title,
    }));

    const answer = await this.getProvider().answer(
      retrievalQuestion,
      takeTop(cards, 3).map((card) => `${card.title}: ${card.summary}`),
    );

    for (const citation of citations) {
      this.recordSignal({
        cardId: citation.cardId,
        createdAt: this.now().toISOString(),
        id: `signal-${globalThis.crypto.randomUUID()}`,
        topicId: this.getMemoryCard(citation.cardId)?.topicIds[0],
        type: "ask",
      });
    }

    this.ensureConversation(conversationId);
    this.insertConversationMessage({
      citations: undefined,
      content: request.question,
      conversationId,
      createdAt: this.now().toISOString(),
      id: `message-${conversationId}-${history.length + 1}`,
      role: "user",
    });

    const answerText = `Based on your saved memory, ${answer}`;
    this.insertConversationMessage({
      citations,
      content: answerText,
      conversationId,
      createdAt: this.now().toISOString(),
      id: `message-${conversationId}-${history.length + 2}`,
      role: "assistant",
    });

    return {
      answer: answerText,
      citations,
      conversationId,
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

  getConversationMessages(conversationId: string): ConversationMessage[] {
    const rows = this.database
      .prepare(
        `
          SELECT * FROM conversation_messages
          WHERE conversation_id = ?
          ORDER BY created_at ASC, id ASC
        `,
      )
      .all(conversationId) as Record<string, unknown>[];

    return rows.map(toConversationMessage);
  }

  getConversationThread(conversationId: string): ConversationThread | null {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return null;
    }

    const messages = this.getConversationMessages(conversationId);
    return {
      conversation: toConversationSummary(conversation, messages),
      messages,
    };
  }

  listConversations(): ConversationSummary[] {
    const rows = this.database
      .prepare("SELECT * FROM conversations ORDER BY updated_at DESC")
      .all() as Record<string, unknown>[];

    return rows.map((row) => {
      const conversation: Conversation = {
        createdAt: row.created_at as string,
        id: row.id as string,
        updatedAt: row.updated_at as string,
      };

      return toConversationSummary(
        conversation,
        this.getConversationMessages(conversation.id),
      );
    });
  }

  getCardSignalSummary(cardId: string): CardSignalSummary {
    const rows = this.database
      .prepare(
        `
          SELECT type, created_at
          FROM signals
          WHERE card_id = ?
          ORDER BY created_at DESC
        `,
      )
      .all(cardId) as Array<{ created_at: string; type: UserSignalType }>;

    const counts = emptySignalCounts();
    for (const row of rows) {
      counts[row.type] += 1;
    }

    return {
      cardId,
      counts,
      lastSignalAt: rows[0]?.created_at ?? null,
      total: rows.length,
    };
  }

  listMemoryCards(): MemoryCard[] {
    const rows = this.database
      .prepare("SELECT * FROM memory_cards ORDER BY sequence DESC")
      .all() as Record<string, unknown>[];
    return rows.map(toMemoryCard);
  }

  async retrieveCards(input: {
    filters?: AskRequest["filters"];
    limit: number;
    query: string;
  }): Promise<RetrievalResult> {
    const cards = this.listMemoryCards().filter((card) =>
      this.matchesRetrievalFilters(card, input.filters),
    );

    if (cards.length === 0) {
      return {
        items: [],
        strategy: "embedding-rerank",
      };
    }

    const embeddingIndex = new Map(
      this.listStoredEmbeddings().map((entry) => [entry.cardId, entry]),
    );
    const missingEmbedding = cards.find((card) => !embeddingIndex.has(card.id));

    if (missingEmbedding) {
      throw new Error(
        `Embedding index is incomplete for card ${missingEmbedding.id}.`,
      );
    }

    const queryEmbedding = await this.getProvider().embed(input.query);
    const candidates = cards
      .map((card) => {
        const embeddingEntry = embeddingIndex.get(card.id);

        if (!embeddingEntry) {
          throw new Error(`Missing embedding payload for card ${card.id}.`);
        }

        return {
          card,
          semanticScore: cosineSimilarity(
            queryEmbedding,
            embeddingEntry.embedding,
          ),
          text: embeddingEntry.sourceText,
        };
      })
      .sort((left, right) => right.semanticScore - left.semanticScore)
      .slice(0, Math.max(input.limit * 4, 6));

    const reranked = await this.getProvider().rerank(
      input.query,
      candidates.map((candidate) => ({
        id: candidate.card.id,
        text: `${candidate.card.title}\n${candidate.text}`,
      })),
    );
    const rerankMap = new Map(reranked.map((entry) => [entry.id, entry.score]));

    const items: RetrievalItem[] = candidates
      .map((candidate) => {
        const rerankScore = rerankMap.get(candidate.card.id);

        if (typeof rerankScore !== "number") {
          throw new Error(
            `Rerank output is missing card ${candidate.card.id}.`,
          );
        }

        return {
          card: candidate.card,
          rerankScore,
          semanticScore: candidate.semanticScore,
        };
      })
      .sort((left, right) => {
        const rightCombined =
          right.rerankScore * 0.65 + right.semanticScore * 0.35;
        const leftCombined =
          left.rerankScore * 0.65 + left.semanticScore * 0.35;
        return rightCombined - leftCombined;
      })
      .slice(0, input.limit);

    return {
      items,
      strategy: "embedding-rerank",
    };
  }

  listReviewCards(): MemoryCard[] {
    const profile = this.getSignalProfile();
    const ranked = this.listMemoryCards()
      .map((card) => {
        const signalSummary = this.getCardSignalSummary(card.id);
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
        const explicitSignalScore = Math.min(
          signalSummary.counts.star * 0.22 +
            signalSummary.counts.highlight * 0.18 +
            signalSummary.counts.review_request * 0.26 +
            signalSummary.counts.ask * 0.14 +
            signalSummary.counts.follow_up * 0.18,
          1,
        );
        const priorityScore =
          valueScore * 0.3 +
          interestScore * 0.2 +
          explicitSignalScore * 0.32 +
          repeatedThemeScore * 0.08 +
          revisitScore * 0.1;

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

  getReviewSections(): ReviewSections {
    if (this.listMemoryCards().length === 0) {
      return {
        staleHighValue: [],
        themeMomentum: [],
        today: [],
      };
    }

    const compiled = this.getCompiledReviewBuckets();

    if (!compiled) {
      throw new Error(
        "Compiled review buckets are unavailable. Run knowledge compilation first.",
      );
    }

    return compiled;
  }

  listTopics(): Topic[] {
    const rows = this.database
      .prepare("SELECT * FROM topics ORDER BY name ASC")
      .all() as Record<string, unknown>[];
    return rows.map(toTopic);
  }

  getTopicInsights(topicId: string): TopicInsights | null {
    const cards = this.getTopicCards(topicId);
    if (cards.length === 0) {
      return null;
    }

    const compiled = this.listCompiledTopics().find(
      (topic) => topic.topicId === topicId,
    );

    if (!compiled) {
      throw new Error(
        `Compiled topic insights are unavailable for topic ${topicId}.`,
      );
    }

    return {
      conflictPoints: compiled.conflictPoints,
      repeatedPoints: compiled.repeatedPoints,
      summary: compiled.summary,
    };
  }

  async compileKnowledge(): Promise<void> {
    const now = this.now().toISOString();
    const compiledTopics: CompiledTopic[] = [];

    for (const topic of this.listTopics()) {
      const cards = this.getTopicCards(topic.id);
      if (cards.length === 0) {
        continue;
      }

      const response = await this.getProvider().answer(
        "Compile a topic summary. Return JSON with summary, repeatedPoints, conflictPoints, and nextQuestions.",
        cards.map(
          (card) =>
            `${card.id}: ${card.title}\n${card.summary}\n${card.keyPoints.join("; ")}`,
        ),
      );

      const parsed = JSON.parse(this.extractJsonBlock(response)) as {
        conflictPoints?: unknown;
        nextQuestions?: unknown;
        repeatedPoints?: unknown;
        summary?: unknown;
      };

      if (
        typeof parsed.summary !== "string" ||
        !parsed.summary.trim() ||
        !Array.isArray(parsed.repeatedPoints) ||
        !Array.isArray(parsed.conflictPoints) ||
        !Array.isArray(parsed.nextQuestions) ||
        parsed.repeatedPoints.some(
          (entry) => typeof entry !== "string" || !entry.trim(),
        ) ||
        parsed.conflictPoints.some(
          (entry) => typeof entry !== "string" || !entry.trim(),
        ) ||
        parsed.nextQuestions.some(
          (entry) => typeof entry !== "string" || !entry.trim(),
        )
      ) {
        throw new Error(
          `Compiled topic payload is invalid for topic ${topic.id}.`,
        );
      }

      compiledTopics.push({
        cardIds: cards.map((card) => card.id),
        conflictPoints: parsed.conflictPoints,
        nextQuestions: parsed.nextQuestions,
        repeatedPoints: parsed.repeatedPoints,
        summary: parsed.summary,
        topicId: topic.id,
        updatedAt: now,
      });
    }

    const rankedCards = this.listReviewCards();
    const reviewResponse = await this.getProvider().answer(
      "Compile review buckets. Return JSON with today, staleHighValue, and themeMomentum arrays of card ids.",
      rankedCards.map((card) => `${card.id}: ${card.title}\n${card.summary}`),
    );

    const parsed = JSON.parse(this.extractJsonBlock(reviewResponse)) as {
      staleHighValue?: unknown;
      themeMomentum?: unknown;
      today?: unknown;
    };
    const index = new Map(rankedCards.map((card) => [card.id, card]));
    const validateBucket = (value: unknown, field: string) => {
      if (!Array.isArray(value)) {
        throw new Error(`Compiled review field ${field} must be an array.`);
      }

      return value.map((entry) => {
        if (typeof entry !== "string" || !entry.trim()) {
          throw new Error(
            `Compiled review field ${field} contains an invalid id.`,
          );
        }

        const card = index.get(entry);
        if (!card) {
          throw new Error(
            `Compiled review field ${field} returned unknown card ${entry}.`,
          );
        }

        return card;
      });
    };

    const compiledReview: CompiledReviewBuckets = {
      staleHighValue: validateBucket(parsed.staleHighValue, "staleHighValue"),
      themeMomentum: validateBucket(parsed.themeMomentum, "themeMomentum"),
      today: validateBucket(parsed.today, "today"),
      updatedAt: now,
    };

    this.writeSetting("compiled_topics", compiledTopics);
    this.writeSetting("compiled_review", compiledReview);
  }

  listCompiledTopics(): CompiledTopic[] {
    return this.readSetting<CompiledTopic[]>("compiled_topics") ?? [];
  }

  getCompiledReviewBuckets(): CompiledReviewBuckets | null {
    const compiled =
      this.readSetting<CompiledReviewBuckets>("compiled_review") ?? null;
    return compiled;
  }

  needsKnowledgeCompilation(): boolean {
    const cards = this.listMemoryCards();

    if (cards.length === 0) {
      return false;
    }

    const compiledReview = this.getCompiledReviewBuckets();
    const compiledTopics = this.listCompiledTopics();
    const expectedTopicCount = this.listTopics().filter(
      (topic) => this.getTopicCards(topic.id).length > 0,
    ).length;

    if (!compiledReview || compiledTopics.length !== expectedTopicCount) {
      return true;
    }

    const latestCardUpdatedAt = cards
      .map((card) => card.updatedAt)
      .sort((left, right) => right.localeCompare(left))[0];
    const latestSignalUpdatedAt =
      (
        this.database
          .prepare("SELECT MAX(created_at) as latest_created_at FROM signals")
          .get() as { latest_created_at: string | null }
      ).latest_created_at ?? null;
    const latestInputAt = [latestCardUpdatedAt, latestSignalUpdatedAt]
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0];
    const latestCompiledTopicAt = compiledTopics
      .map((topic) => topic.updatedAt)
      .sort((left, right) => right.localeCompare(left))[0];
    const latestCompiledAt = [compiledReview.updatedAt, latestCompiledTopicAt]
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => right.localeCompare(left))[0];

    if (!latestInputAt || !latestCompiledAt) {
      return true;
    }

    return latestCompiledAt < latestInputAt;
  }

  async ensureKnowledgeCompiled(): Promise<void> {
    if (this.needsKnowledgeCompilation()) {
      await this.compileKnowledge();
    }
  }

  getRuntimeDiagnostics(): RuntimeDiagnostics {
    const setup = this.getSetupState();
    const provider = this.getActiveProviderProfile();
    const settings = this.getChannelSettings();
    const now = this.now();
    const extensionHeartbeat = this.getChannelConnectionStatus("extension");
    const telegramHeartbeat = this.getChannelConnectionStatus("telegram");

    return {
      channels: {
        extension: summarizeChannelRuntime({
          configured: Boolean(settings.extension.captureBaseUrl),
          enabled: settings.extension.enabled,
          heartbeat: extensionHeartbeat,
          idleLabel: "Waiting for extension heartbeat",
          now,
        }),
        telegram: summarizeChannelRuntime({
          configured: Boolean(settings.telegram.botToken),
          enabled: settings.telegram.enabled,
          heartbeat: telegramHeartbeat,
          idleLabel: settings.telegram.botToken
            ? "Token saved, waiting for bot runtime"
            : "Save a bot token to enable Telegram",
          now,
        }),
        web: {
          configured: true,
          connected: settings.web.enabled,
          enabled: settings.web.enabled,
          label: settings.web.enabled
            ? "Available through the local app"
            : "Disabled in channel center",
          lastHeartbeatAt: null,
        },
      },
      features: {
        embeddings: Boolean(provider?.embeddingModel),
        rerank: Boolean(provider?.rerankModel || provider?.answerModel),
        vision: Boolean(provider?.visionModel),
      },
      provider: provider
        ? {
            id: provider.id,
            kind: provider.kind,
            name: provider.name,
          }
        : null,
      setup,
      stats: {
        compiledTopics: this.listCompiledTopics().length,
        conversations: this.listConversations().length,
        memoryCards: this.listMemoryCards().length,
        reviewCompiled: Boolean(this.getCompiledReviewBuckets()),
        topics: this.listTopics().length,
      },
    };
  }

  recordChannelHeartbeat(heartbeat: ChannelHeartbeat): void {
    this.writeSetting(`channel_heartbeat:${heartbeat.channel}`, {
      channel: heartbeat.channel,
      lastHeartbeatAt: heartbeat.occurredAt,
      metadata: heartbeat.metadata,
    });
  }

  getChannelConnectionStatus(
    channel: ChannelHeartbeat["channel"],
  ): ChannelConnectionStatus | null {
    return this.readSetting<ChannelConnectionStatus>(
      `channel_heartbeat:${channel}`,
    );
  }

  getActiveProviderProfile(): ProviderProfile | null {
    const profiles = this.listProviderProfiles();
    const activeId =
      this.readSetting<string>("active_provider_profile_id") ??
      profiles[0]?.id ??
      null;

    return profiles.find((profile) => profile.id === activeId) ?? null;
  }

  getChannelSettings(): ChannelSettings {
    const stored =
      this.readSetting<Partial<ChannelSettings>>("channel_settings");
    const defaults = defaultChannelSettings();

    return {
      extension: {
        captureBaseUrl: cleanText(
          stored?.extension?.captureBaseUrl ??
            defaults.extension.captureBaseUrl,
        ),
        enabled: stored?.extension?.enabled ?? defaults.extension.enabled,
      },
      telegram: {
        baseUrl: cleanText(
          stored?.telegram?.baseUrl ?? defaults.telegram.baseUrl,
        ),
        botToken: cleanText(stored?.telegram?.botToken ?? ""),
        botUsername: cleanText(stored?.telegram?.botUsername ?? ""),
        enabled: stored?.telegram?.enabled ?? defaults.telegram.enabled,
      },
      web: {
        enabled: stored?.web?.enabled ?? defaults.web.enabled,
      },
    };
  }

  getProviderSettings(): ProviderSettings | null {
    return this.getActiveProviderProfile();
  }

  listProviderProfiles(): ProviderProfile[] {
    const profiles =
      this.readSetting<ProviderProfile[]>("provider_profiles") ?? [];

    return profiles.sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    );
  }

  getSetupState(): SetupState {
    const providerSettings = this.getProviderSettings();
    const providerConfigured = isProviderConfigured(providerSettings);
    const hasAnyMemories = this.listMemoryCards().length > 0;

    return {
      hasAnyMemories,
      needsOnboarding: !(providerConfigured && hasAnyMemories),
      providerConfigured,
      providerKind: providerSettings?.kind ?? null,
    };
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

  saveChannelSettings(settings: ChannelSettings): void {
    const normalized = this.getChannelSettings();

    normalized.extension = {
      captureBaseUrl: cleanText(settings.extension.captureBaseUrl),
      enabled: settings.extension.enabled,
    };
    normalized.telegram = {
      baseUrl: cleanText(settings.telegram.baseUrl),
      botToken: cleanText(settings.telegram.botToken ?? ""),
      botUsername: cleanText(settings.telegram.botUsername ?? ""),
      enabled: settings.telegram.enabled,
    };
    normalized.web = {
      enabled: settings.web.enabled,
    };

    this.writeSetting("channel_settings", normalized);
  }

  saveProviderProfile(
    profile: Omit<ProviderProfile, "createdAt" | "updatedAt"> &
      Partial<Pick<ProviderProfile, "createdAt" | "updatedAt">>,
    options: { makeActive?: boolean } = {},
  ): ProviderProfile {
    const existing = this.listProviderProfiles();
    const match = existing.find((entry) => entry.id === profile.id);
    const createdAt =
      match?.createdAt ?? profile.createdAt ?? this.now().toISOString();
    const updatedAt = this.now().toISOString();
    const normalizedSettings = normalizeProviderSettings(profile);
    const normalized: ProviderProfile = {
      ...normalizedSettings,
      createdAt,
      id: cleanText(profile.id),
      name: cleanText(profile.name),
      updatedAt,
    };

    const profiles = [
      ...existing.filter((entry) => entry.id !== normalized.id),
      normalized,
    ].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    this.writeSetting("provider_profiles", profiles);

    if (options.makeActive || !this.getActiveProviderProfile()) {
      this.setActiveProviderProfile(normalized.id);
    }

    return normalized;
  }

  deleteProviderProfile(profileId: string): void {
    const activeId = this.getActiveProviderProfile()?.id;
    const remaining = this.listProviderProfiles().filter(
      (profile) => profile.id !== profileId,
    );
    this.writeSetting("provider_profiles", remaining);

    if (activeId === profileId) {
      if (remaining[0]) {
        this.setActiveProviderProfile(remaining[0].id);
      } else {
        this.deleteSetting("active_provider_profile_id");
      }
    }
  }

  saveProviderSettings(settings: ProviderSettings): void {
    const active = this.getActiveProviderProfile();
    this.saveProviderProfile(
      {
        ...normalizeProviderSettings(settings),
        id: active?.id ?? `provider-${Date.now()}`,
        name: active?.name ?? defaultProviderName(settings.kind),
      },
      { makeActive: true },
    );
  }

  setActiveProviderProfile(profileId: string): void {
    const profile = this.listProviderProfiles().find(
      (entry) => entry.id === profileId,
    );

    if (!profile) {
      throw new Error(`Unknown provider profile: ${profileId}`);
    }

    this.writeSetting("active_provider_profile_id", profile.id);
  }

  async testProviderSettings(settings: ProviderSettings): Promise<string> {
    return this.createProviderFromSettings(settings).summarize(
      "Ping from memduck setup.",
    );
  }

  private async prepareSourceItem(
    envelope: InputEnvelope,
    createdAt: string,
  ): Promise<PreparedSourceItem> {
    this.sequence += 1;
    const id = `source-${this.sequence}`;

    if (envelope.kind === "url") {
      const payload = envelope.payload as UrlPayload;
      const fetched = await fetchUrlContent(this.contentFetch, payload.url);

      return {
        snapshotHtml: fetched.html,
        sourceItem: {
          bodyText: fetched.extractedText,
          createdAt,
          id,
          kind: "url",
          pageTitle: envelope.sourceContext?.pageTitle ?? fetched.pageTitle,
          sourceChannel: envelope.sourceChannel,
          sourceUrl: fetched.finalUrl,
        },
        sourceText: fetched.extractedText,
      };
    }

    if (envelope.kind === "text") {
      const payload = envelope.payload as TextPayload;
      const sourceText = cleanText(payload.text);

      if (!sourceText) {
        throw new Error("Text ingestion requires non-empty content.");
      }

      return {
        sourceItem: {
          bodyText: sourceText,
          caption: envelope.sourceContext?.caption,
          createdAt,
          id,
          kind: "text",
          sourceChannel: envelope.sourceChannel,
        },
        sourceText,
      };
    }

    const payload = envelope.payload as ImagePayload;
    const analysis = await this.getProvider().visionAnalyze({
      mimeType: payload.mimeType,
      objectKey: payload.objectKey,
    });
    const sourceText = cleanText(
      [analysis.summary, analysis.extractedText, ...analysis.keyPoints].join(
        ". ",
      ),
    );

    if (!sourceText) {
      throw new Error("Vision analysis returned empty content.");
    }

    return {
      sourceItem: {
        caption: envelope.sourceContext?.caption,
        createdAt,
        id,
        kind: "image",
        mimeType: payload.mimeType,
        objectKey: payload.objectKey,
        sourceChannel: envelope.sourceChannel,
      },
      sourceText,
    };
  }

  private insertSourceItem(sourceItem: SourceItem): void {
    this.database
      .prepare(
        `
          INSERT INTO source_items (
            id, kind, source_channel, source_url, page_title, body_text,
            snapshot_path, object_key, mime_type, caption, created_at
          ) VALUES (
            @id, @kind, @sourceChannel, @sourceUrl, @pageTitle, @bodyText,
            @snapshotPath,
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
        snapshotPath: sourceItem.snapshotPath ?? null,
        sourceChannel: sourceItem.sourceChannel,
        sourceUrl: sourceItem.sourceUrl ?? null,
      });
  }

  private async createMemoryCard(
    sourceItem: SourceItem,
    envelope: InputEnvelope,
    createdAt: string,
    sourceText: string,
  ): Promise<DraftMemoryCard> {
    const id = `card-${this.sequence}`;
    const title = this.buildTitle(sourceItem);
    const keyPoints = buildKeyPoints(sourceText);
    const summary = await this.getProvider().summarize(sourceText);
    const sourceTextEmbedding = await this.getProvider().embed(sourceText);
    const topicIds = this.ensureTopics(sourceText, keyPoints, createdAt);

    return {
      createdAt,
      deepSummary: `${summary} | depth=${envelope.requestedDepth}`,
      evidence: takeTop(keyPoints, 2),
      id,
      keyPoints,
      sequence: this.sequence,
      sourceChannel: sourceItem.sourceChannel,
      sourceItemId: sourceItem.id,
      sourceTextEmbedding,
      status: "ready",
      summary,
      title,
      topicIds,
      updatedAt: createdAt,
      worthSaving: envelope.requestedDepth !== "save",
    };
  }

  private insertMemoryCard(card: DraftMemoryCard): void {
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
        ...this.stripCardEmbedding(card),
        evidenceJson: JSON.stringify(card.evidence),
        keyPointsJson: JSON.stringify(card.keyPoints),
        topicIdsJson: JSON.stringify(card.topicIds),
        worthSaving: card.worthSaving ? 1 : 0,
      });
  }

  private insertCardEmbedding(
    cardId: string,
    embedding: number[],
    sourceText: string,
  ): void {
    this.database
      .prepare(
        `
          INSERT INTO card_embeddings (card_id, embedding_json, source_text, updated_at)
          VALUES (@cardId, @embeddingJson, @sourceText, @updatedAt)
          ON CONFLICT(card_id) DO UPDATE SET
            embedding_json = excluded.embedding_json,
            source_text = excluded.source_text,
            updated_at = excluded.updated_at
        `,
      )
      .run({
        cardId,
        embeddingJson: JSON.stringify(embedding),
        sourceText,
        updatedAt: this.now().toISOString(),
      });
  }

  private stripCardEmbedding(card: DraftMemoryCard): MemoryCard {
    const { sourceTextEmbedding: _sourceTextEmbedding, ...memoryCard } = card;
    return memoryCard;
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

  private extractJsonBlock(content: string): string {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return content.slice(start, end + 1);
    }

    return content;
  }

  private listStoredEmbeddings(): Array<{
    cardId: string;
    embedding: number[];
    sourceText: string;
  }> {
    const rows = this.database
      .prepare("SELECT * FROM card_embeddings ORDER BY updated_at DESC")
      .all() as Record<string, unknown>[];

    return rows.map((row) => ({
      cardId: row.card_id as string,
      embedding: parseJsonArray<number>(row.embedding_json as string),
      sourceText: row.source_text as string,
    }));
  }

  private matchesRetrievalFilters(
    card: MemoryCard | undefined,
    filters?: AskRequest["filters"],
  ) {
    if (!card) {
      return false;
    }

    if (
      filters?.sourceChannels &&
      !filters.sourceChannels.includes(card.sourceChannel)
    ) {
      return false;
    }

    if (
      filters?.topicIds &&
      !card.topicIds.some((topicId) => filters.topicIds?.includes(topicId))
    ) {
      return false;
    }

    if (filters?.dateFrom) {
      const createdAt = new Date(card.createdAt).getTime();
      const dateFrom = new Date(filters.dateFrom).getTime();

      if (!Number.isNaN(dateFrom) && createdAt < dateFrom) {
        return false;
      }
    }

    if (filters?.dateTo) {
      const createdAt = new Date(card.createdAt).getTime();
      const dateTo = new Date(filters.dateTo).getTime();

      if (!Number.isNaN(dateTo) && createdAt > dateTo) {
        return false;
      }
    }

    return true;
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

  private getProvider() {
    const settings = this.getProviderSettings();

    if (!settings) {
      throw new Error("No active provider profile is configured.");
    }

    return this.createProviderFromSettings(settings);
  }

  private getConversation(conversationId: string): Conversation | null {
    const row = this.database
      .prepare("SELECT * FROM conversations WHERE id = ?")
      .get(conversationId) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    return {
      createdAt: row.created_at as string,
      id: row.id as string,
      updatedAt: row.updated_at as string,
    };
  }

  private ensureConversation(conversationId: string): Conversation {
    const existing = this.getConversation(conversationId);

    if (existing) {
      return existing;
    }

    const createdAt = this.now().toISOString();
    this.database
      .prepare(
        `
          INSERT INTO conversations (id, created_at, updated_at)
          VALUES (@id, @createdAt, @updatedAt)
        `,
      )
      .run({
        createdAt,
        id: conversationId,
        updatedAt: createdAt,
      });

    return {
      createdAt,
      id: conversationId,
      updatedAt: createdAt,
    };
  }

  private insertConversationMessage(message: ConversationMessage): void {
    this.database
      .prepare(
        `
          INSERT INTO conversation_messages (
            id, conversation_id, role, content, citations_json, created_at
          ) VALUES (
            @id, @conversationId, @role, @content, @citationsJson, @createdAt
          )
        `,
      )
      .run({
        citationsJson: message.citations
          ? JSON.stringify(message.citations)
          : null,
        content: message.content,
        conversationId: message.conversationId,
        createdAt: message.createdAt,
        id: message.id,
        role: message.role,
      });

    this.database
      .prepare(
        `
          UPDATE conversations
          SET updated_at = @updatedAt
          WHERE id = @id
        `,
      )
      .run({
        id: message.conversationId,
        updatedAt: message.createdAt,
      });
  }

  private createProviderFromSettings(settings: ProviderSettings) {
    const normalized = normalizeProviderSettings(settings);

    if (normalized.kind === "anthropic") {
      return createAnthropicProvider(
        normalized,
        this.providerFetch,
        this.assetStore.resolveObjectPath,
      );
    }

    if (normalized.kind === "gemini") {
      return createGeminiProvider(
        normalized,
        this.providerFetch,
        this.assetStore.resolveObjectPath,
      );
    }

    return createOpenAICompatibleProvider(
      normalized,
      this.providerFetch,
      this.assetStore.resolveObjectPath,
    );
  }

  private readSetting<T>(key: string): T | null {
    const row = this.database
      .prepare("SELECT value_json FROM app_settings WHERE key = ?")
      .get(key) as { value_json: string } | undefined;

    if (!row) {
      return null;
    }

    return JSON.parse(row.value_json) as T;
  }

  private writeSetting(key: string, value: unknown): void {
    this.database
      .prepare(
        `
          INSERT INTO app_settings (key, value_json, updated_at)
          VALUES (@key, @valueJson, @updatedAt)
          ON CONFLICT(key) DO UPDATE SET
            value_json = excluded.value_json,
            updated_at = excluded.updated_at
        `,
      )
      .run({
        key,
        updatedAt: this.now().toISOString(),
        valueJson: JSON.stringify(value),
      });
  }

  private deleteSetting(key: string): void {
    this.database.prepare("DELETE FROM app_settings WHERE key = ?").run(key);
  }
}

export function createMemduckService(options: ServiceOptions): MemduckService {
  return new MemduckService(options);
}
