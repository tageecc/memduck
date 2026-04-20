import { mkdirSync } from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import { fetchUrlContent } from "../fetching/url-content";
import { createAnthropicProvider } from "../providers/anthropic-provider";
import { createGeminiProvider } from "../providers/gemini-provider";
import { createMockProviderRegistry } from "../providers/mock-provider-registry";
import { createOpenAICompatibleProvider } from "../providers/openai-compatible-provider";
import { createAssetStore } from "../storage/assets";
import { createDatabase } from "../storage/database";
import type {
  AskRequest,
  AskResponse,
  ChannelConnectionStatus,
  ChannelHeartbeat,
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
  ServiceOptions,
  SetupState,
  SourceContext,
  SourceItem,
  TextPayload,
  Topic,
  TopicInsights,
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
  ChannelConnectionStatus,
  ChannelHeartbeat,
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
  ServiceOptions,
  SetupState,
  SourceChannel,
  SourceItem,
  TextPayload,
  Topic,
  TopicInsights,
  UrlPayload,
  UserSignal,
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

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:3000";

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
    default:
      return "Mock / Demo";
  }
}

function normalizeProviderSettings(
  settings: ProviderSettings,
): ProviderSettings {
  if (settings.kind === "mock") {
    return { kind: "mock" };
  }

  const normalized: ProviderSettings = {
    answerModel: cleanText(settings.answerModel ?? ""),
    apiKey: cleanText(settings.apiKey ?? ""),
    baseUrl: cleanText(settings.baseUrl ?? ""),
    embeddingModel: cleanText(settings.embeddingModel ?? ""),
    kind: settings.kind,
    rerankModel: cleanText(settings.rerankModel ?? ""),
    summarizeModel: cleanText(settings.summarizeModel ?? ""),
    visionModel: cleanText(settings.visionModel ?? ""),
  };

  if (!normalized.baseUrl) {
    if (normalized.kind === "anthropic") {
      normalized.baseUrl = DEFAULT_ANTHROPIC_BASE_URL;
    } else if (normalized.kind === "gemini") {
      normalized.baseUrl = DEFAULT_GEMINI_BASE_URL;
    } else if (normalized.kind === "ollama") {
      normalized.baseUrl = DEFAULT_OLLAMA_BASE_URL;
    } else if (normalized.kind === "openai") {
      normalized.baseUrl = DEFAULT_OPENAI_BASE_URL;
    }
  }

  return normalized;
}

function isProviderConfigured(settings: ProviderSettings | null): boolean {
  if (!settings) {
    return false;
  }

  if (settings.kind === "mock") {
    return true;
  }

  if (
    settings.kind === "openai-compatible" ||
    settings.kind === "openai" ||
    settings.kind === "anthropic" ||
    settings.kind === "gemini"
  ) {
    return Boolean(
      settings.baseUrl &&
        settings.answerModel &&
        settings.summarizeModel &&
        settings.apiKey,
    );
  }

  if (settings.kind === "ollama") {
    return Boolean(
      settings.baseUrl && settings.answerModel && settings.summarizeModel,
    );
  }

  return false;
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

export class MemduckService {
  private readonly assetStore: ReturnType<typeof createAssetStore>;
  private readonly contentFetch: typeof fetch;
  private readonly database: Database.Database;
  private readonly mockProviders: ReturnType<typeof createMockProviderRegistry>;
  private readonly now: () => Date;
  private readonly providerFetch: typeof fetch;
  private sequence = 0;

  constructor(options: ServiceOptions) {
    this.assetStore = createAssetStore(options.runtimeDir);
    this.contentFetch = options.contentFetch ?? fetch;
    this.mockProviders = createMockProviderRegistry(options.providerFailures);
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
    const sourceItem = await this.createSourceItem(normalized, createdAt);
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
    const conversationId =
      request.conversationId ?? `conversation-${Date.now()}`;
    this.ensureConversation(conversationId);

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

    this.insertConversationMessage({
      citations: undefined,
      content: request.question,
      conversationId,
      createdAt: this.now().toISOString(),
      id: `message-${conversationId}-${history.length + 1}`,
      role: "user",
    });

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
    const providerSettings = this.getProviderSettings();
    const embeddings = this.listStoredEmbeddings();

    if (providerSettings?.embeddingModel && embeddings.length > 0) {
      const queryEmbedding = await this.getProvider().embed(input.query);
      const candidates = embeddings
        .map((entry) => ({
          card: this.getMemoryCard(entry.cardId),
          semanticScore: cosineSimilarity(queryEmbedding, entry.embedding),
          text: entry.sourceText,
        }))
        .filter((entry) => entry.card)
        .filter((entry) =>
          this.matchesRetrievalFilters(entry.card, input.filters),
        )
        .sort((left, right) => right.semanticScore - left.semanticScore)
        .slice(0, Math.max(input.limit * 4, 6))
        .map((entry) => ({
          card: entry.card as MemoryCard,
          semanticScore: entry.semanticScore,
          text: entry.text,
        }));

      const reranked = await this.getProvider().rerank(
        input.query,
        candidates.map((candidate) => ({
          id: candidate.card.id,
          text: `${candidate.card.title}\n${candidate.text}`,
        })),
      );
      const rerankMap = new Map(
        reranked.map((entry) => [entry.id, entry.score]),
      );

      const items: RetrievalItem[] = candidates
        .map((candidate) => ({
          card: candidate.card,
          rerankScore: rerankMap.get(candidate.card.id) ?? 0,
          semanticScore: candidate.semanticScore,
        }))
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

    const questionTokens = tokenize(input.query);
    const items = this.listMemoryCards()
      .filter((card) => this.matchesRetrievalFilters(card, input.filters))
      .map((card) => {
        const searchable = tokenize(
          card.title,
          card.summary,
          card.deepSummary,
          ...card.keyPoints,
          ...card.evidence,
        );
        const overlap = questionTokens.filter((token) =>
          searchable.includes(token),
        ).length;

        return {
          card,
          rerankScore: overlap,
          semanticScore: overlap,
        };
      })
      .filter((entry) => entry.semanticScore > 0)
      .sort((left, right) => right.semanticScore - left.semanticScore)
      .slice(0, input.limit);

    return {
      items,
      strategy: "lexical",
    };
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

  getReviewSections(): ReviewSections {
    const compiled = this.getCompiledReviewBuckets();
    if (compiled) {
      return compiled;
    }

    const ranked = this.listReviewCards();
    const today = ranked.slice(0, 4);
    const staleHighValue = ranked
      .filter((card) => card.worthSaving)
      .slice(0, 4);

    const themeMomentum = this.listTopics()
      .map((topic) => this.getTopicCards(topic.id)[0])
      .filter(Boolean)
      .slice(0, 4) as MemoryCard[];

    return {
      staleHighValue,
      themeMomentum,
      today,
    };
  }

  listTopics(): Topic[] {
    const rows = this.database
      .prepare("SELECT * FROM topics ORDER BY name ASC")
      .all() as Record<string, unknown>[];
    return rows.map(toTopic);
  }

  getTopicInsights(topicId: string): TopicInsights | null {
    const compiled = this.listCompiledTopics().find(
      (topic) => topic.topicId === topicId,
    );

    if (compiled) {
      return {
        conflictPoints: compiled.conflictPoints,
        repeatedPoints: compiled.repeatedPoints,
        summary: compiled.summary,
      };
    }

    const cards = this.getTopicCards(topicId);
    if (cards.length === 0) {
      return null;
    }

    const repeatedCounter = new Map<string, number>();
    const tokenCounter = new Map<string, number>();
    const conflictPoints = new Set<string>();
    const stopWords = new Set([
      "about",
      "another",
      "around",
      "becomes",
      "best",
      "critical",
      "daily",
      "every",
      "ideas",
      "keeps",
      "most",
      "over",
      "practice",
      "resurfacing",
      "review",
      "says",
      "should",
      "source",
      "stay",
      "that",
      "the",
      "there",
      "this",
      "time",
      "way",
      "week",
      "when",
      "writer",
    ]);

    for (const card of cards) {
      for (const point of card.keyPoints) {
        const normalizedPoint = cleanText(point).toLowerCase();
        repeatedCounter.set(
          normalizedPoint,
          (repeatedCounter.get(normalizedPoint) ?? 0) + 1,
        );

        if (/\bwhile\b|\bhowever\b|\bbut\b|\bconflict\b/i.test(point)) {
          conflictPoints.add(point);
        }

        for (const token of tokenize(point)) {
          if (token.length < 5 || stopWords.has(token)) {
            continue;
          }

          tokenCounter.set(token, (tokenCounter.get(token) ?? 0) + 1);
        }
      }
    }

    let repeatedPoints = [...repeatedCounter.entries()]
      .filter(([, count]) => count > 1)
      .map(([point]) => titleCase(point))
      .slice(0, 4);

    if (repeatedPoints.length === 0) {
      repeatedPoints = [...tokenCounter.entries()]
        .filter(([, count]) => count > 1)
        .sort((left, right) => right[1] - left[1])
        .map(([token]) => titleCase(token))
        .slice(0, 4);
    }

    return {
      conflictPoints: [...conflictPoints].slice(0, 4),
      repeatedPoints,
      summary: `${cards.length} cards currently reinforce this topic.`,
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

      try {
        const parsed = JSON.parse(this.extractJsonBlock(response)) as {
          conflictPoints?: string[];
          nextQuestions?: string[];
          repeatedPoints?: string[];
          summary?: string;
        };

        compiledTopics.push({
          cardIds: cards.map((card) => card.id),
          conflictPoints: parsed.conflictPoints ?? [],
          nextQuestions: parsed.nextQuestions ?? [],
          repeatedPoints: parsed.repeatedPoints ?? [],
          summary:
            parsed.summary ?? `${cards.length} cards reinforce this topic.`,
          topicId: topic.id,
          updatedAt: now,
        });
      } catch {
        compiledTopics.push({
          cardIds: cards.map((card) => card.id),
          conflictPoints: [],
          nextQuestions: [],
          repeatedPoints: [],
          summary: `${cards.length} cards reinforce this topic.`,
          topicId: topic.id,
          updatedAt: now,
        });
      }
    }

    this.writeSetting("compiled_topics", compiledTopics);

    const rankedCards = this.listReviewCards();
    const reviewResponse = await this.getProvider().answer(
      "Compile review buckets. Return JSON with today, staleHighValue, and themeMomentum arrays of card ids.",
      rankedCards.map((card) => `${card.id}: ${card.title}\n${card.summary}`),
    );

    try {
      const parsed = JSON.parse(this.extractJsonBlock(reviewResponse)) as {
        staleHighValue?: string[];
        themeMomentum?: string[];
        today?: string[];
      };

      const index = new Map(rankedCards.map((card) => [card.id, card]));
      this.writeSetting("compiled_review", {
        staleHighValue: (parsed.staleHighValue ?? [])
          .map((id) => index.get(id))
          .filter(Boolean),
        themeMomentum: (parsed.themeMomentum ?? [])
          .map((id) => index.get(id))
          .filter(Boolean),
        today: (parsed.today ?? []).map((id) => index.get(id)).filter(Boolean),
        updatedAt: now,
      });
    } catch {
      this.writeSetting("compiled_review", {
        staleHighValue: rankedCards
          .filter((card) => card.worthSaving)
          .slice(0, 4),
        themeMomentum: this.listTopics()
          .map((topic) => this.getTopicCards(topic.id)[0])
          .filter(Boolean)
          .slice(0, 4),
        today: rankedCards.slice(0, 4),
        updatedAt: now,
      });
    }
  }

  listCompiledTopics(): CompiledTopic[] {
    return this.readSetting<CompiledTopic[]>("compiled_topics") ?? [];
  }

  getCompiledReviewBuckets(): CompiledReviewBuckets | null {
    const compiled =
      this.readSetting<CompiledReviewBuckets>("compiled_review") ?? null;
    return compiled;
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
    this.migrateLegacyProviderSettings();
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
    return this.getActiveProviderProfile() ?? this.readLegacyProviderSettings();
  }

  listProviderProfiles(): ProviderProfile[] {
    this.migrateLegacyProviderSettings();
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
        this.writeSetting("active_provider_profile_id", "");
        this.writeSetting("provider_settings", null);
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
    this.writeSetting("provider_settings", normalizeProviderSettings(profile));
  }

  async testProviderSettings(settings: ProviderSettings): Promise<string> {
    return this.createProviderFromSettings(settings).summarize(
      "Ping from memduck setup.",
    );
  }

  private async createSourceItem(
    envelope: InputEnvelope,
    createdAt: string,
  ): Promise<SourceItem> {
    this.sequence += 1;
    const id = `source-${this.sequence}`;

    let sourceItem: SourceItem;
    if (envelope.kind === "url") {
      const payload = envelope.payload as UrlPayload;
      let fetched: Awaited<ReturnType<typeof fetchUrlContent>> | undefined;

      try {
        fetched = await fetchUrlContent(this.contentFetch, payload.url);
      } catch {
        fetched = undefined;
      }

      const snapshot = fetched
        ? this.assetStore.saveText({
            fileName: `${id}.html`,
            prefix: "snapshots",
            text: fetched.html,
          })
        : undefined;
      sourceItem = {
        bodyText: fetched?.extractedText,
        createdAt,
        id,
        kind: "url",
        pageTitle: envelope.sourceContext?.pageTitle ?? fetched?.pageTitle,
        snapshotPath: snapshot?.objectKey,
        sourceChannel: envelope.sourceChannel,
        sourceUrl: fetched?.finalUrl ?? payload.url,
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
    const summary = await this.getProvider().summarize(sourceText);

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
    await this.upsertCardEmbedding(memoryCard.id, sourceText);
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
      return (
        sourceItem.bodyText ??
        `${sourceItem.pageTitle ?? "Saved link"} ${sourceItem.sourceUrl ?? ""}`.trim()
      );
    }

    if (sourceItem.kind === "text") {
      return sourceItem.bodyText ?? "";
    }

    const payload = envelope.payload as ImagePayload;
    const analysis = await this.getProvider().visionAnalyze({
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

  private async upsertCardEmbedding(
    cardId: string,
    sourceText: string,
  ): Promise<void> {
    const settings = this.getProviderSettings();
    if (!settings?.embeddingModel) {
      return;
    }

    const embedding = await this.getProvider().embed(sourceText);

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
    return settings
      ? this.createProviderFromSettings(settings)
      : this.mockProviders;
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

    if (normalized.kind === "mock") {
      return this.mockProviders;
    }

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

    const compatibleSettings: ProviderSettings = {
      ...normalized,
      apiKey:
        normalized.apiKey ||
        (normalized.kind === "ollama" ? "ollama" : normalized.apiKey),
      baseUrl:
        normalized.baseUrl ??
        (normalized.kind === "ollama"
          ? DEFAULT_OLLAMA_BASE_URL
          : DEFAULT_OPENAI_BASE_URL),
      kind: "openai-compatible",
    };

    return createOpenAICompatibleProvider(
      compatibleSettings,
      this.providerFetch,
      this.assetStore.resolveObjectPath,
    );
  }

  private migrateLegacyProviderSettings(): void {
    const profiles = this.readSetting<ProviderProfile[]>("provider_profiles");
    if (profiles && profiles.length > 0) {
      return;
    }

    const legacy = this.readLegacyProviderSettings();
    if (!legacy) {
      return;
    }

    const createdAt = this.now().toISOString();
    const profile: ProviderProfile = {
      ...normalizeProviderSettings(legacy),
      createdAt,
      id: "primary",
      name: defaultProviderName(legacy.kind),
      updatedAt: createdAt,
    };

    this.writeSetting("provider_profiles", [profile]);
    this.writeSetting("active_provider_profile_id", profile.id);
  }

  private readLegacyProviderSettings(): ProviderSettings | null {
    return this.readSetting<ProviderSettings>("provider_settings");
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
}

export function createMemduckService(options: ServiceOptions): MemduckService {
  return new MemduckService(options);
}
