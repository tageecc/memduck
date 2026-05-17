import { mkdirSync } from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3";

import {
  type ChannelCatalogId,
  channelCatalog,
  getChannelCatalogEntry,
  getChannelFieldDefaults,
} from "../channels/catalog";
import { fetchUrlContent } from "../fetching/url-content";
import { createAnthropicProvider } from "../providers/anthropic-provider";
import { createGeminiProvider } from "../providers/gemini-provider";
import { createOpenAICompatibleProvider } from "../providers/openai-compatible-provider";
import { isProviderCatalogId } from "../providers/provider-presets";
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
  ChannelSettingsEntry,
  Citation,
  CompiledReviewBuckets,
  CompiledTopic,
  Conversation,
  ConversationMessage,
  ConversationSummary,
  ConversationThread,
  ConversationTurnInput,
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
  SourceChunk,
  SourceContext,
  SourceItem,
  TelegramChatState,
  TextPayload,
  Topic,
  TopicInsights,
  TopicLink,
  UrlPayload,
  UserSignal,
  UserSignalType,
} from "./types";
import {
  chunkText,
  cleanText,
  slugify,
  takeTop,
  titleCase,
  tokenize,
} from "./utils";

export const MEMDUCK_SERVICE_RUNTIME_VERSION = 7;
const DEFAULT_RETRIEVAL_PROVIDER_DEADLINE_MS = 5_000;
const EMPTY_ASK_ANSWER =
  "暂时没有找到与这个问题相关的已保存记忆。你可以换个问法，或先在 Ask 里保存相关内容。";

export type {
  AskRequest,
  AskResponse,
  CardSignalSummary,
  ChannelConnectionStatus,
  ChannelHeartbeat,
  ChannelRuntimeDiagnostic,
  ChannelSettings,
  ChannelSettingsEntry,
  Citation,
  CompiledReviewBuckets,
  CompiledTopic,
  Conversation,
  ConversationAttachment,
  ConversationMessage,
  ConversationSummary,
  ConversationThread,
  ConversationTurnInput,
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
  SearchRequest,
  ServiceOptions,
  SetupState,
  SourceChannel,
  SourceChunk,
  SourceItem,
  TelegramChatState,
  TextPayload,
  Topic,
  TopicInsights,
  TopicLink,
  UrlPayload,
  UserSignal,
  UserSignalType,
} from "./types";

function parseJsonArray<T>(value: string): T[] {
  return JSON.parse(value) as T[];
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0) {
    throw new Error("Embedding vectors must be non-empty.");
  }

  if (left.length !== right.length) {
    throw new Error(
      `Embedding vector dimensions differ: ${left.length} !== ${right.length}.`,
    );
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
    throw new Error("Embedding vectors must not have zero magnitude.");
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:3000";
const CHANNEL_HEARTBEAT_STALE_MINUTES = 5;

function defaultChannelSettings(): ChannelSettings {
  const channels = Object.fromEntries(
    channelCatalog.map((channel) => [
      channel.id,
      {
        enabled: channel.id === "web" || channel.id === "extension",
        values: getChannelFieldDefaults(channel.id),
      },
    ]),
  ) as ChannelSettings["channels"];

  return {
    channels,
    extension: {
      captureBaseUrl: DEFAULT_LOCAL_BASE_URL,
      enabled: true,
    },
    telegram: {
      baseUrl: DEFAULT_LOCAL_BASE_URL,
      botToken: "",
      enabled: false,
    },
    web: {
      enabled: true,
    },
  };
}

function normalizeChannelEntry(
  channelId: ChannelCatalogId,
  entry?: Partial<{ enabled: boolean; values: Record<string, string> }>,
) {
  const defaults = getChannelFieldDefaults(channelId);

  return {
    enabled: Boolean(entry?.enabled),
    values: {
      ...defaults,
      ...(entry?.values ?? {}),
    },
  };
}

function mergeChannelEntry(
  channelId: ChannelCatalogId,
  current: ChannelSettingsEntry | undefined,
  incoming?: Partial<{ enabled: boolean; values: Record<string, string> }>,
) {
  const merged = normalizeChannelEntry(channelId, {
    ...(current ?? {
      enabled: false,
      values: {},
    }),
    ...(incoming ?? {}),
  });
  const currentValues = current?.values ?? {};

  for (const field of getChannelCatalogEntry(channelId).fields) {
    const incomingValue = incoming?.values?.[field.key];
    const currentValue = currentValues[field.key];
    if (field.secret && incomingValue === "" && currentValue?.trim()) {
      merged.values[field.key] = currentValue;
    }
  }

  return merged;
}

function isChannelConfigured(
  channelId: ChannelCatalogId,
  entry?: { enabled: boolean; values: Record<string, string> },
) {
  const catalogEntry = getChannelCatalogEntry(channelId);

  return catalogEntry.fields
    .filter((field) => field.required)
    .every((field) => Boolean(entry?.values[field.key]?.trim()));
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

function defaultProviderName(settings: ProviderSettings): string {
  switch (settings.providerId || settings.kind) {
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
      return settings.providerId;
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
    model: cleanText(settings.model),
    providerId: cleanText(settings.providerId),
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
      settings.model &&
      settings.providerId &&
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

function readProfileText(value: unknown): string {
  return typeof value === "string" ? cleanText(value) : "";
}

function isStoredProviderProfile(value: unknown): value is ProviderProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<ProviderProfile>;
  const providerId = readProfileText(profile.providerId);

  return Boolean(
    readProfileText(profile.answerModel) &&
      readProfileText(profile.baseUrl) &&
      readProfileText(profile.createdAt) &&
      readProfileText(profile.embeddingModel) &&
      readProfileText(profile.id) &&
      readProfileText(profile.model) &&
      readProfileText(profile.name) &&
      providerId &&
      isProviderCatalogId(providerId) &&
      readProfileText(profile.rerankModel) &&
      readProfileText(profile.summarizeModel) &&
      readProfileText(profile.updatedAt) &&
      readProfileText(profile.visionModel) &&
      ["anthropic", "gemini", "ollama", "openai", "openai-compatible"].includes(
        profile.kind ?? "",
      ),
  );
}

function toConversationSummary(
  conversation: Conversation,
  messages: ConversationMessage[],
): ConversationSummary {
  const previewMessage =
    messages.findLast((message) => message.role === "user") ?? messages.at(-1);

  return {
    createdAt: conversation.createdAt,
    id: conversation.id,
    lastMessagePreview: cleanText(previewMessage?.content ?? "").slice(0, 180),
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

function ensureStringArray(
  value: unknown,
  field: string,
  options: { minLength?: number } = {},
): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array.`);
  }

  const normalized = value.map((entry) => {
    if (typeof entry !== "string" || !cleanText(entry)) {
      throw new Error(`${field} contains an invalid string value.`);
    }

    return cleanText(entry);
  });

  if ((options.minLength ?? 0) > normalized.length) {
    throw new Error(
      `${field} must contain at least ${options.minLength} items.`,
    );
  }

  return normalized;
}

function ensureBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${field} must be a boolean.`);
  }

  return value;
}

function ensureNumberInRange(
  value: unknown,
  field: string,
  options: { max: number; min: number },
): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${field} must be a number.`);
  }

  if (value < options.min || value > options.max) {
    throw new Error(
      `${field} must be between ${options.min} and ${options.max}.`,
    );
  }

  return value;
}

function toMemoryCard(row: Record<string, unknown>): MemoryCard {
  const status = row.status === "ready" ? "quick_ready" : row.status;

  return {
    createdAt: row.created_at as string,
    deepSummary: row.deep_summary as string,
    evidence: parseJsonArray<string>(row.evidence_json as string),
    id: row.id as string,
    keyPoints: parseJsonArray<string>(row.key_points_json as string),
    sequence: row.sequence as number,
    sourceChannel: row.source_channel as MemoryCard["sourceChannel"],
    sourceItemId: row.source_item_id as string,
    status: status as MemoryCard["status"],
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
    attachments:
      row.attachments_json && typeof row.attachments_json === "string"
        ? parseJsonArray<
            NonNullable<ConversationMessage["attachments"]>[number]
          >(row.attachments_json)
        : undefined,
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

function normalizeTopicKeywords(keywords: string[]): string[] {
  return [
    ...new Set(keywords.map((keyword) => cleanText(keyword)).filter(Boolean)),
  ];
}

function toSourceChunk(row: Record<string, unknown>): SourceChunk {
  return {
    createdAt: row.created_at as string,
    embedding: parseJsonArray<number>(row.embedding_json as string),
    endOffset: row.end_offset as number,
    id: row.id as string,
    sequence: row.sequence as number,
    sourceItemId: row.source_item_id as string,
    startOffset: row.start_offset as number,
    text: row.text as string,
  };
}

function toTopicLink(row: Record<string, unknown>): TopicLink {
  return {
    cardId: row.card_id as string,
    confidence: row.confidence as number,
    createdAt: row.created_at as string,
    reason: row.reason as string,
    topicId: row.topic_id as string,
  };
}

interface PreparedSourceItem {
  snapshotHtml?: string;
  sourceItem: SourceItem;
}

interface DraftMemoryCard extends MemoryCard {
  sourceTextEmbedding?: number[];
}

interface StructuredMemoryDigest {
  deepSummary: string;
  evidence: string[];
  keyPoints: string[];
  summary: string;
  worthSaving: boolean;
}

interface DraftSourceChunk extends SourceChunk {}

interface DraftTopicLink extends TopicLink {}

interface SourceMaterialization {
  sourceItem: SourceItem;
  sourceText: string;
}

interface TopicResolution {
  topicIds: string[];
  topicLinks: DraftTopicLink[];
  topicsToInsert: Topic[];
}

export class MemduckService {
  private readonly assetStore: ReturnType<typeof createAssetStore>;
  private readonly contentFetch: typeof fetch;
  private readonly database: Database.Database;
  private readonly now: () => Date;
  private readonly providerFetch: typeof fetch;
  private readonly retrievalProviderDeadlineMs: number;
  private sequence = 0;

  constructor(options: ServiceOptions) {
    this.assetStore = createAssetStore(options.runtimeDir);
    this.contentFetch = options.contentFetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.providerFetch = options.providerFetch ?? fetch;
    this.retrievalProviderDeadlineMs =
      options.retrievalProviderDeadlineMs ??
      DEFAULT_RETRIEVAL_PROVIDER_DEADLINE_MS;
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

    if (prepared.snapshotHtml) {
      prepared.sourceItem.snapshotPath = this.assetStore.saveText({
        fileName: `${prepared.sourceItem.id}.html`,
        prefix: "snapshots",
        text: prepared.snapshotHtml,
      }).objectKey;
    }

    const cardId = `card-${this.sequence}`;
    let memoryCard: DraftMemoryCard;
    let sourceChunks: DraftSourceChunk[] = [];
    let sourceText: string | null = null;
    let topicResolution: TopicResolution = {
      topicIds: [],
      topicLinks: [],
      topicsToInsert: [],
    };

    if (normalized.requestedDepth === "save") {
      memoryCard = this.createSavedMemoryCard(
        cardId,
        prepared.sourceItem,
        createdAt,
      );
    } else {
      const materialized = await this.materializeSourceItem(
        prepared.sourceItem,
      );
      prepared.sourceItem = materialized.sourceItem;
      sourceText = materialized.sourceText;
      const provider = this.getProvider();

      const [digest, sourceTextEmbedding, builtSourceChunks] =
        await Promise.all([
          this.compileMemoryDigest(
            prepared.sourceItem,
            normalized.requestedDepth,
            sourceText,
          ),
          provider.embed(sourceText),
          this.buildSourceChunks(
            prepared.sourceItem.id,
            sourceText,
            createdAt,
            provider,
          ),
        ]);

      sourceChunks = builtSourceChunks;

      if (normalized.requestedDepth === "deep") {
        topicResolution = await this.resolveTopicsWithFallback(
          cardId,
          digest,
          createdAt,
        );
      }

      memoryCard = this.createAnalyzedMemoryCard({
        createdAt,
        digest,
        id: cardId,
        sequence: this.sequence,
        sourceItem: prepared.sourceItem,
        sourceTextEmbedding,
        status:
          normalized.requestedDepth === "deep" ? "deep_ready" : "quick_ready",
        topicIds: topicResolution.topicIds,
        updatedAt: createdAt,
      });
    }

    const persistCapture = this.database.transaction(() => {
      this.insertSourceItem(prepared.sourceItem);
      this.insertTopics(topicResolution.topicsToInsert);
      this.insertMemoryCard(memoryCard);
      if (sourceText && memoryCard.sourceTextEmbedding) {
        this.insertCardEmbedding(
          memoryCard.id,
          memoryCard.sourceTextEmbedding,
          sourceText,
        );
        this.insertSourceChunks(sourceChunks);
      }
      if (topicResolution.topicLinks.length > 0) {
        this.insertTopicLinks(topicResolution.topicLinks);
      }
      this.recordSignal({
        cardId: memoryCard.id,
        createdAt,
        id: `signal-${memoryCard.id}-save`,
        topicId: memoryCard.topicIds[0],
        type: "save",
      });
    });

    persistCapture();

    return {
      memoryCard: this.stripCardEmbedding(memoryCard),
      sourceItem: prepared.sourceItem,
    };
  }

  async analyzeMemoryCard(
    cardId: string,
    requestedDepth: Exclude<InputEnvelope["requestedDepth"], "save">,
  ): Promise<MemoryCard> {
    const card = this.getMemoryCard(cardId);

    if (!card) {
      throw new Error(`Unknown memory card: ${cardId}`);
    }

    if (requestedDepth === "quick" && card.status !== "saved") {
      throw new Error(`Card ${cardId} is already beyond quick analysis.`);
    }

    if (requestedDepth === "deep" && card.status === "deep_ready") {
      throw new Error(`Card ${cardId} is already deep analyzed.`);
    }

    const sourceItem = this.getSourceItem(card.sourceItemId);

    if (!sourceItem) {
      throw new Error(`Missing source item for card ${cardId}.`);
    }

    const updatedAt = this.now().toISOString();
    const canReuseQuickAnalysis =
      requestedDepth === "deep" &&
      card.status === "quick_ready" &&
      this.hasStructuredDigest(card) &&
      this.listSourceChunks(card.sourceItemId).length > 0;

    if (canReuseQuickAnalysis) {
      const digest = this.digestFromMemoryCard(card);
      const topicResolution = this.resolveTopicsLocally(
        card.id,
        digest,
        updatedAt,
      );
      const updatedCard = this.createAnalyzedMemoryCard({
        createdAt: card.createdAt,
        digest,
        id: card.id,
        sequence: card.sequence,
        sourceItem,
        status: "deep_ready",
        topicIds: topicResolution.topicIds,
        updatedAt,
      });

      const persistTopicUpgrade = this.database.transaction(() => {
        this.insertTopics(topicResolution.topicsToInsert);
        this.updateMemoryCard(updatedCard);
        this.replaceTopicLinks(card.id, topicResolution.topicLinks);
      });

      persistTopicUpgrade();

      return this.stripCardEmbedding(updatedCard);
    }

    const materialized = await this.materializeSourceItem(sourceItem);
    const sourceText = materialized.sourceText;
    const provider = this.getProvider();
    const [digest, sourceTextEmbedding, sourceChunks] = await Promise.all([
      this.compileMemoryDigest(
        materialized.sourceItem,
        requestedDepth,
        sourceText,
      ),
      provider.embed(sourceText),
      this.buildSourceChunks(
        materialized.sourceItem.id,
        sourceText,
        updatedAt,
        provider,
      ),
    ]);

    const topicResolution =
      requestedDepth === "deep"
        ? await this.resolveTopicsWithFallback(card.id, digest, updatedAt)
        : {
            topicIds: [],
            topicLinks: [],
            topicsToInsert: [],
          };

    const updatedCard = this.createAnalyzedMemoryCard({
      createdAt: card.createdAt,
      digest,
      id: card.id,
      sequence: card.sequence,
      sourceItem: materialized.sourceItem,
      sourceTextEmbedding,
      status: requestedDepth === "deep" ? "deep_ready" : "quick_ready",
      topicIds: topicResolution.topicIds,
      updatedAt,
    });

    const persistAnalysis = this.database.transaction(() => {
      this.updateSourceItem(materialized.sourceItem);
      this.insertTopics(topicResolution.topicsToInsert);
      this.updateMemoryCard(updatedCard);
      this.insertCardEmbedding(card.id, sourceTextEmbedding, sourceText);
      this.replaceSourceChunks(materialized.sourceItem.id, sourceChunks);
      this.replaceTopicLinks(card.id, topicResolution.topicLinks);
    });

    persistAnalysis();

    return this.stripCardEmbedding(updatedCard);
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
    const citations = this.buildRetrievalCitations(
      retrievalQuestion,
      cards,
      retrieval.queryEmbedding,
    );

    const answer =
      cards.length > 0
        ? await this.answerWithProviderFallback(
            retrievalQuestion,
            this.buildAnswerContextLines(cards, citations),
            cards,
          )
        : EMPTY_ASK_ANSWER;

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

    this.insertConversationMessage({
      citations,
      content: answer,
      conversationId,
      createdAt: this.now().toISOString(),
      id: `message-${conversationId}-${history.length + 2}`,
      role: "assistant",
    });

    return {
      answer,
      citations,
      conversationId,
    };
  }

  async *askStream(request: AskRequest): AsyncIterable<{
    citations?: AskResponse["citations"];
    conversationId?: string;
    done?: boolean;
    token?: string;
  }> {
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
    const citations = this.buildRetrievalCitations(
      retrievalQuestion,
      cards,
      retrieval.queryEmbedding,
    );

    yield { citations, conversationId };

    let answerText = "";

    if (cards.length === 0) {
      answerText = EMPTY_ASK_ANSWER;
      yield { token: answerText };
    } else {
      for await (const token of this.answerStreamWithProviderFallback(
        retrievalQuestion,
        this.buildAnswerContextLines(cards, citations),
        cards,
      )) {
        yield { token };
        answerText += token;
      }
    }

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
    this.insertConversationMessage({
      citations,
      content: answerText,
      conversationId,
      createdAt: this.now().toISOString(),
      id: `message-${conversationId}-${history.length + 2}`,
      role: "assistant",
    });

    yield { done: true };
  }

  recordConversationTurn(input: ConversationTurnInput): ConversationThread {
    const conversationId = input.conversationId ?? `conversation-${Date.now()}`;
    const history = this.getConversationMessages(conversationId);
    const createdAt = this.now().toISOString();

    this.ensureConversation(conversationId);
    this.insertConversationMessage({
      attachments: input.user.attachments,
      citations: undefined,
      content: cleanText(input.user.content),
      conversationId,
      createdAt,
      id: `message-${conversationId}-${history.length + 1}`,
      role: "user",
    });
    this.insertConversationMessage({
      citations: input.assistant.citations,
      content: cleanText(input.assistant.content),
      conversationId,
      createdAt: this.now().toISOString(),
      id: `message-${conversationId}-${history.length + 2}`,
      role: "assistant",
    });

    const thread = this.getConversationThread(conversationId);
    if (!thread) {
      throw new Error(`Conversation disappeared: ${conversationId}`);
    }

    return thread;
  }

  getMemoryCard(id: string): MemoryCard | undefined {
    const row = this.database
      .prepare("SELECT * FROM memory_cards WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? toMemoryCard(row) : undefined;
  }

  deleteMemoryCard(id: string): void {
    const card = this.getMemoryCard(id);
    if (!card) {
      throw new Error(`Memory card not found: ${id}`);
    }

    this.database.transaction(() => {
      this.database
        .prepare("DELETE FROM card_embeddings WHERE card_id = ?")
        .run(id);
      this.database
        .prepare("DELETE FROM source_chunks WHERE source_item_id = ?")
        .run(card.sourceItemId);
      this.database
        .prepare("DELETE FROM topic_links WHERE card_id = ?")
        .run(id);
      this.database.prepare("DELETE FROM signals WHERE card_id = ?").run(id);
      this.database.prepare("DELETE FROM memory_cards WHERE id = ?").run(id);
      this.database
        .prepare("DELETE FROM source_items WHERE id = ?")
        .run(card.sourceItemId);
      this.invalidateKnowledgeCompilation();
    })();
  }

  getSourceItem(id: string): SourceItem | undefined {
    const row = this.database
      .prepare("SELECT * FROM source_items WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return row ? toSourceItem(row) : undefined;
  }

  listSourceChunks(sourceItemId: string): SourceChunk[] {
    const rows = this.database
      .prepare(
        `
          SELECT * FROM source_chunks
          WHERE source_item_id = ?
          ORDER BY sequence ASC
        `,
      )
      .all(sourceItemId) as Record<string, unknown>[];

    return rows.map(toSourceChunk);
  }

  listTopicLinksForCard(cardId: string): TopicLink[] {
    const rows = this.database
      .prepare(
        `
          SELECT * FROM topic_links
          WHERE card_id = ?
          ORDER BY confidence DESC, created_at ASC
        `,
      )
      .all(cardId) as Record<string, unknown>[];

    return rows.map(toTopicLink);
  }

  getTopicBySlug(slug: string): Topic | undefined {
    const row = this.database
      .prepare("SELECT * FROM topics WHERE slug = ?")
      .get(slug) as Record<string, unknown> | undefined;
    return row ? toTopic(row) : undefined;
  }

  getTopic(topicId: string): Topic | undefined {
    const row = this.database
      .prepare("SELECT * FROM topics WHERE id = ?")
      .get(topicId) as Record<string, unknown> | undefined;
    return row ? toTopic(row) : undefined;
  }

  getTopicCards(topicId: string): MemoryCard[] {
    const rows = this.database
      .prepare(
        `
          SELECT cards.*
          FROM memory_cards cards
          INNER JOIN topic_links topic_links
            ON topic_links.card_id = cards.id
          WHERE topic_links.topic_id = ?
          ORDER BY cards.sequence DESC
        `,
      )
      .all(topicId) as Record<string, unknown>[];

    return rows.map(toMemoryCard);
  }

  renameTopic(
    topicId: string,
    input: {
      keywords: string[];
      name: string;
    },
  ): Topic {
    const topic = this.getTopic(topicId);

    if (!topic) {
      throw new Error(`Unknown topic: ${topicId}`);
    }

    const name = cleanText(input.name);
    const keywords = normalizeTopicKeywords(input.keywords);

    if (!name) {
      throw new Error("Topic name is required.");
    }

    if (keywords.length === 0) {
      throw new Error("Topic keywords are required.");
    }

    const updated: Topic = {
      ...topic,
      keywords,
      name,
      slug: this.createUniqueTopicSlug(name, topic.id),
    };

    this.database
      .prepare(
        `
          UPDATE topics
          SET name = @name, slug = @slug, keywords_json = @keywordsJson
          WHERE id = @id
        `,
      )
      .run({
        id: updated.id,
        keywordsJson: JSON.stringify(updated.keywords),
        name: updated.name,
        slug: updated.slug,
      });
    this.invalidateKnowledgeCompilation();

    return updated;
  }

  mergeTopics(input: { sourceTopicId: string; targetTopicId: string }): Topic {
    if (input.sourceTopicId === input.targetTopicId) {
      throw new Error("Cannot merge a topic into itself.");
    }

    const source = this.getTopic(input.sourceTopicId);
    const target = this.getTopic(input.targetTopicId);

    if (!source) {
      throw new Error(`Unknown source topic: ${input.sourceTopicId}`);
    }

    if (!target) {
      throw new Error(`Unknown target topic: ${input.targetTopicId}`);
    }

    const mergedKeywords = normalizeTopicKeywords([
      ...target.keywords,
      ...source.keywords,
    ]);
    const mergeTopicsTransaction = this.database.transaction(() => {
      this.database
        .prepare(
          `
            UPDATE topics
            SET keywords_json = @keywordsJson
            WHERE id = @id
          `,
        )
        .run({
          id: target.id,
          keywordsJson: JSON.stringify(mergedKeywords),
        });

      const sourceLinks = this.listTopicLinks(input.sourceTopicId);
      for (const sourceLink of sourceLinks) {
        const existing = this.getTopicLink(sourceLink.cardId, target.id);
        const reason = existing
          ? `${existing.reason} | Merged from ${source.name}: ${sourceLink.reason}`
          : `Merged from ${source.name}: ${sourceLink.reason}`;
        const confidence = existing
          ? Math.max(existing.confidence, sourceLink.confidence)
          : sourceLink.confidence;

        this.upsertTopicLink({
          cardId: sourceLink.cardId,
          confidence,
          createdAt: existing?.createdAt ?? sourceLink.createdAt,
          reason,
          topicId: target.id,
        });
      }

      this.database
        .prepare("DELETE FROM topic_links WHERE topic_id = ?")
        .run(source.id);
      this.database.prepare("DELETE FROM topics WHERE id = ?").run(source.id);

      for (const card of this.listMemoryCards()) {
        const nextTopicIds = [
          ...new Set(
            card.topicIds.map((topicId) =>
              topicId === source.id ? target.id : topicId,
            ),
          ),
        ];
        if (nextTopicIds.join("\u0000") !== card.topicIds.join("\u0000")) {
          this.updateMemoryCardTopicIds(card.id, nextTopicIds);
        }
      }

      this.invalidateKnowledgeCompilation();
    });

    mergeTopicsTransaction();

    const merged = this.getTopic(target.id);

    if (!merged) {
      throw new Error(`Merged topic disappeared: ${target.id}`);
    }

    return merged;
  }

  removeTopicLink(input: { cardId: string; topicId: string }): MemoryCard {
    const card = this.getMemoryCard(input.cardId);

    if (!card) {
      throw new Error(`Unknown memory card: ${input.cardId}`);
    }

    const topic = this.getTopic(input.topicId);

    if (!topic) {
      throw new Error(`Unknown topic: ${input.topicId}`);
    }

    if (!this.getTopicLink(input.cardId, input.topicId)) {
      throw new Error(
        `Card ${input.cardId} is not linked to topic ${input.topicId}.`,
      );
    }

    const nextTopicIds = card.topicIds.filter(
      (topicId) => topicId !== input.topicId,
    );

    const unlinkTopic = this.database.transaction(() => {
      this.database
        .prepare("DELETE FROM topic_links WHERE card_id = ? AND topic_id = ?")
        .run(input.cardId, input.topicId);
      this.updateMemoryCardTopicIds(input.cardId, nextTopicIds);
      this.invalidateKnowledgeCompilation();
    });

    unlinkTopic();

    const updated = this.getMemoryCard(input.cardId);

    if (!updated) {
      throw new Error(`Memory card disappeared: ${input.cardId}`);
    }

    return updated;
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

  listRetrievableMemoryCards(): MemoryCard[] {
    return this.listMemoryCards().filter((card) => card.status !== "saved");
  }

  async retrieveCards(input: {
    filters?: AskRequest["filters"];
    limit: number;
    query: string;
    queryEmbedding?: number[];
  }): Promise<RetrievalResult> {
    const cards = this.listRetrievableMemoryCards().filter((card) =>
      this.matchesRetrievalFilters(card, input.filters),
    );

    if (cards.length === 0) {
      return {
        items: [],
        strategy: "embedding-rerank",
      };
    }

    const providerRetrieval = this.retrieveCardsWithProvider(cards, input);
    // If the provider path loses the race, it can still reject later when its
    // internal timeout aborts. Attach a handler so the local fallback does not
    // leave an unhandled rejection behind.
    providerRetrieval.catch(() => undefined);

    return Promise.race([
      providerRetrieval,
      this.retrieveCardsLocallyAfterDeadline(cards, input),
    ]);
  }

  private async retrieveCardsLocallyAfterDeadline(
    cards: MemoryCard[],
    input: {
      limit: number;
      query: string;
    },
  ): Promise<RetrievalResult> {
    await new Promise((resolve) =>
      setTimeout(resolve, this.retrievalProviderDeadlineMs),
    );

    return this.retrieveCardsLocally(cards, input);
  }

  private async retrieveCardsWithProvider(
    cards: MemoryCard[],
    input: {
      limit: number;
      query: string;
      queryEmbedding?: number[];
    },
  ): Promise<RetrievalResult> {
    const embeddingIndex = new Map(
      this.listStoredEmbeddings().map((entry) => [entry.cardId, entry]),
    );
    const missingEmbedding = cards.find((card) => !embeddingIndex.has(card.id));

    if (missingEmbedding) {
      throw new Error(
        `Embedding index is incomplete for card ${missingEmbedding.id}.`,
      );
    }

    const queryEmbedding =
      input.queryEmbedding ?? (await this.getProvider().embed(input.query));
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
      queryEmbedding,
      strategy: "embedding-rerank",
    };
  }

  private retrieveCardsLocally(
    cards: MemoryCard[],
    input: {
      limit: number;
      query: string;
    },
  ): RetrievalResult {
    const embeddingIndex = new Map(
      this.listStoredEmbeddings().map((entry) => [entry.cardId, entry]),
    );

    const items = cards
      .map((card) => {
        const embeddingText = embeddingIndex.get(card.id)?.sourceText ?? "";
        const haystack = cleanText(
          [
            card.title,
            card.summary,
            card.deepSummary,
            ...card.keyPoints,
            ...card.evidence,
            embeddingText,
          ].join(" "),
        );
        const score = this.scoreTextAgainstQuery(input.query, haystack);

        return {
          card,
          rerankScore: score,
          semanticScore: score,
        };
      })
      .filter((item) => item.rerankScore > 0)
      .sort((left, right) => right.rerankScore - left.rerankScore)
      .slice(0, input.limit);

    return {
      items,
      strategy: "local-token-rank",
    };
  }

  listReviewCards(): MemoryCard[] {
    const profile = this.getSignalProfile();
    const ranked = this.listRetrievableMemoryCards()
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
    if (this.listRetrievableMemoryCards().length === 0) {
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
      return null;
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

      const response = await this.getProvider().complete(
        "Compile a topic summary. Return JSON with summary, repeatedPoints, conflictPoints, and nextQuestions.",
        cards.map(
          (card) =>
            `${card.id}: ${card.title}\n${card.summary}\n${card.keyPoints.join("; ")}`,
        ),
        { capability: "summarize" },
      );

      const parsed = JSON.parse(this.requireJsonObjectContent(response)) as {
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
    const reviewResponse = await this.getProvider().complete(
      "Compile review buckets. Return JSON with today, staleHighValue, and themeMomentum arrays of card ids.",
      rankedCards.map((card) => `${card.id}: ${card.title}\n${card.summary}`),
      { capability: "summarize" },
    );

    const parsed = JSON.parse(
      this.requireJsonObjectContent(reviewResponse),
    ) as {
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
    const cards = this.listReviewCards();
    const linkedTopicCount = this.listTopics().filter(
      (topic) => this.getTopicCards(topic.id).length > 0,
    ).length;

    if (cards.length === 0 && linkedTopicCount === 0) {
      return false;
    }

    const compiledReview = this.getCompiledReviewBuckets();
    const compiledTopics = this.listCompiledTopics();
    const expectedTopicCount = linkedTopicCount;

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

  getRuntimeDiagnostics(): RuntimeDiagnostics {
    const setup = this.getSetupState();
    const provider = this.getActiveProviderProfile();
    const settings = this.getChannelSettings();
    const now = this.now();
    const channelDiagnostics = Object.fromEntries(
      channelCatalog.map((channel) => {
        const setting = settings.channels[channel.id];
        const heartbeat = this.getChannelConnectionStatus(channel.id);
        const enabled = Boolean(setting?.enabled);
        const configured =
          channel.id === "web"
            ? true
            : isChannelConfigured(channel.id, setting);

        return [
          channel.id,
          channel.id === "web"
            ? {
                configured: true,
                connected: enabled,
                enabled,
                label: enabled
                  ? "Available through the local app"
                  : "Disabled in channel center",
                lastHeartbeatAt: null,
              }
            : summarizeChannelRuntime({
                configured,
                enabled,
                heartbeat,
                idleLabel: configured
                  ? "Configured, waiting for channel runtime"
                  : "Missing required channel fields",
                now,
              }),
        ];
      }),
    ) as RuntimeDiagnostics["channels"];

    return {
      channels: channelDiagnostics,
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
            providerId: provider.providerId,
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

  getChannelConnectionStatus(channel: ChannelHeartbeat["channel"]) {
    return this.readSetting<ChannelConnectionStatus>(
      `channel_heartbeat:${channel}`,
    );
  }

  getTelegramChatState(chatId: string): TelegramChatState | null {
    const normalizedChatId = cleanText(chatId);

    if (!normalizedChatId) {
      throw new Error("Telegram chat id is required.");
    }

    return this.readSetting<TelegramChatState>(
      `telegram_chat_state:${normalizedChatId}`,
    );
  }

  saveTelegramChatState(
    chatId: string,
    state: Partial<
      Pick<TelegramChatState, "lastCardId" | "lastConversationId">
    >,
  ): TelegramChatState {
    const normalizedChatId = cleanText(chatId);

    if (!normalizedChatId) {
      throw new Error("Telegram chat id is required.");
    }

    const existing = this.getTelegramChatState(normalizedChatId);
    const updated: TelegramChatState = {
      chatId: normalizedChatId,
      lastCardId:
        state.lastCardId === undefined
          ? existing?.lastCardId
          : cleanText(state.lastCardId),
      lastConversationId:
        state.lastConversationId === undefined
          ? existing?.lastConversationId
          : cleanText(state.lastConversationId),
      updatedAt: this.now().toISOString(),
    };

    this.writeSetting(`telegram_chat_state:${normalizedChatId}`, updated);

    return updated;
  }

  getActiveProviderProfile(): ProviderProfile | null {
    const profiles = this.listProviderProfiles();
    const activeId = this.readSetting<string>("active_provider_profile_id");

    if (!activeId) {
      return null;
    }

    return profiles.find((profile) => profile.id === activeId) ?? null;
  }

  getChannelSettings(): ChannelSettings {
    const stored =
      this.readSetting<Partial<ChannelSettings>>("channel_settings");
    const defaults = defaultChannelSettings();
    const storedChannels = stored?.channels ?? {};
    const channels = Object.fromEntries(
      channelCatalog.map((channel) => [
        channel.id,
        normalizeChannelEntry(channel.id, {
          ...(defaults.channels[channel.id] ?? {
            enabled: false,
            values: {},
          }),
          ...(storedChannels[channel.id] ?? {}),
        }),
      ]),
    ) as ChannelSettings["channels"];

    if (stored?.extension) {
      channels.extension = normalizeChannelEntry("extension", {
        enabled: stored.extension.enabled,
        values: {
          captureBaseUrl: stored.extension.captureBaseUrl,
        },
      });
    }

    if (stored?.telegram) {
      channels.telegram = normalizeChannelEntry("telegram", {
        enabled: stored.telegram.enabled,
        values: {
          baseUrl: stored.telegram.baseUrl,
          botToken: stored.telegram.botToken,
          botUsername: stored.telegram.botUsername ?? "",
        },
      });
    }

    if (stored?.web) {
      channels.web = normalizeChannelEntry("web", {
        enabled: stored.web.enabled,
        values: {},
      });
    }

    const extension = channels.extension ?? defaults.channels.extension;
    const telegram = channels.telegram ?? defaults.channels.telegram;
    const web = channels.web ?? defaults.channels.web;

    return {
      channels,
      extension: {
        captureBaseUrl: cleanText(
          extension?.values.captureBaseUrl ?? defaults.extension.captureBaseUrl,
        ),
        enabled: extension?.enabled ?? defaults.extension.enabled,
      },
      telegram: {
        baseUrl: cleanText(
          telegram?.values.baseUrl ?? defaults.telegram.baseUrl,
        ),
        botToken: cleanText(telegram?.values.botToken ?? ""),
        botUsername: cleanText(telegram?.values.botUsername ?? ""),
        enabled: telegram?.enabled ?? defaults.telegram.enabled,
      },
      web: {
        enabled: web?.enabled ?? defaults.web.enabled,
      },
    };
  }

  getProviderSettings(): ProviderSettings | null {
    return this.getActiveProviderProfile();
  }

  listProviderProfiles(): ProviderProfile[] {
    const profiles = this.readSetting<unknown[]>("provider_profiles") ?? [];

    return profiles
      .filter(isStoredProviderProfile)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  getSetupState(): SetupState {
    const providerSettings = this.getProviderSettings();
    const providerConfigured = isProviderConfigured(providerSettings);
    const hasAnyMemories = this.listMemoryCards().length > 0;

    return {
      hasAnyMemories,
      needsOnboarding: !providerConfigured,
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

  saveChannelSettings(settings: Partial<ChannelSettings>): void {
    const normalized = this.getChannelSettings();
    const incomingChannels = settings.channels ?? {};

    normalized.channels = Object.fromEntries(
      channelCatalog.map((channel) => [
        channel.id,
        mergeChannelEntry(
          channel.id,
          normalized.channels[channel.id],
          incomingChannels[channel.id],
        ),
      ]),
    ) as ChannelSettings["channels"];

    if (settings.extension) {
      normalized.channels.extension = normalizeChannelEntry("extension", {
        enabled: settings.extension.enabled,
        values: {
          captureBaseUrl: cleanText(settings.extension.captureBaseUrl),
        },
      });
    }

    if (settings.telegram) {
      normalized.channels.telegram = normalizeChannelEntry("telegram", {
        enabled: settings.telegram.enabled,
        values: {
          baseUrl: cleanText(settings.telegram.baseUrl),
          botToken: cleanText(settings.telegram.botToken),
          botUsername: cleanText(settings.telegram.botUsername ?? ""),
        },
      });
    }

    if (settings.web) {
      normalized.channels.web = normalizeChannelEntry("web", {
        enabled: settings.web.enabled,
        values: {},
      });
    }

    const extension = normalized.channels.extension;
    const telegram = normalized.channels.telegram;
    const web = normalized.channels.web;

    normalized.extension = {
      captureBaseUrl: cleanText(extension?.values.captureBaseUrl ?? ""),
      enabled: Boolean(extension?.enabled),
    };
    normalized.telegram = {
      baseUrl: cleanText(telegram?.values.baseUrl ?? ""),
      botToken: cleanText(telegram?.values.botToken ?? ""),
      botUsername: cleanText(telegram?.values.botUsername ?? ""),
      enabled: Boolean(telegram?.enabled),
    };
    normalized.web = {
      enabled: Boolean(web?.enabled),
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

    if (options.makeActive) {
      this.setActiveProviderProfile(normalized.id);
    }

    return normalized;
  }

  deleteProviderProfile(profileId: string): void {
    const profile = this.listProviderProfiles().find(
      (entry) => entry.id === profileId,
    );

    if (!profile) {
      throw new Error(`Unknown provider profile: ${profileId}`);
    }

    const activeId = this.getActiveProviderProfile()?.id;
    const remaining = this.listProviderProfiles().filter(
      (profile) => profile.id !== profileId,
    );
    this.writeSetting("provider_profiles", remaining);

    if (activeId === profileId) {
      this.deleteSetting("active_provider_profile_id");
    }
  }

  saveProviderSettings(settings: ProviderSettings): void {
    const active = this.getActiveProviderProfile();
    this.saveProviderProfile(
      {
        ...normalizeProviderSettings(settings),
        id: active?.id ?? `provider-${Date.now()}`,
        name: active?.name ?? defaultProviderName(settings),
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
      const sourceText = cleanText(fetched.extractedText);

      if (!sourceText) {
        throw new Error("URL extraction returned empty content.");
      }

      return {
        snapshotHtml: fetched.html,
        sourceItem: {
          bodyText: sourceText,
          createdAt,
          id,
          kind: "url",
          pageTitle: envelope.sourceContext?.pageTitle ?? fetched.pageTitle,
          sourceChannel: envelope.sourceChannel,
          sourceUrl: fetched.finalUrl,
        },
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
      };
    }

    const payload = envelope.payload as ImagePayload;
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
    };
  }

  private async materializeSourceItem(
    sourceItem: SourceItem,
  ): Promise<SourceMaterialization> {
    if (sourceItem.kind === "image") {
      if (!sourceItem.objectKey || !sourceItem.mimeType) {
        throw new Error(
          `Image source ${sourceItem.id} is missing stored asset metadata.`,
        );
      }

      if (sourceItem.bodyText) {
        const sourceText = cleanText(sourceItem.bodyText);

        if (!sourceText) {
          throw new Error("Image source text is empty after normalization.");
        }

        return {
          sourceItem: {
            ...sourceItem,
            bodyText: sourceText,
          },
          sourceText,
        };
      }

      const analysis = await this.getProvider().visionAnalyze({
        mimeType: sourceItem.mimeType,
        objectKey: sourceItem.objectKey,
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
          ...sourceItem,
          bodyText: sourceText,
        },
        sourceText,
      };
    }

    const sourceText = cleanText(sourceItem.bodyText ?? "");

    if (!sourceText) {
      throw new Error(
        `Source ${sourceItem.id} does not expose normalized text for analysis.`,
      );
    }

    return {
      sourceItem: {
        ...sourceItem,
        bodyText: sourceText,
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

  private updateSourceItem(sourceItem: SourceItem): void {
    this.database
      .prepare(
        `
          UPDATE source_items
          SET kind = @kind,
              source_channel = @sourceChannel,
              source_url = @sourceUrl,
              page_title = @pageTitle,
              body_text = @bodyText,
              snapshot_path = @snapshotPath,
              object_key = @objectKey,
              mime_type = @mimeType,
              caption = @caption
          WHERE id = @id
        `,
      )
      .run({
        bodyText: sourceItem.bodyText ?? null,
        caption: sourceItem.caption ?? null,
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

  private async compileMemoryDigest(
    sourceItem: SourceItem,
    requestedDepth: Exclude<InputEnvelope["requestedDepth"], "save">,
    sourceText: string,
  ): Promise<StructuredMemoryDigest> {
    const response = await this.getProvider().complete(
      requestedDepth === "deep"
        ? "Compile a deep memory card. Return JSON with summary, deepSummary, keyPoints, evidence, and worthSaving."
        : "Compile a quick memory card. Return JSON with summary, deepSummary, keyPoints, evidence, and worthSaving.",
      [
        `Source kind: ${sourceItem.kind}`,
        `Source channel: ${sourceItem.sourceChannel}`,
        `Requested depth: ${requestedDepth}`,
        ...(sourceItem.sourceUrl
          ? [`Source URL: ${sourceItem.sourceUrl}`]
          : []),
        ...(sourceItem.pageTitle
          ? [`Page title: ${sourceItem.pageTitle}`]
          : []),
        ...(sourceItem.caption ? [`Caption: ${sourceItem.caption}`] : []),
        "Source text:",
        sourceText,
      ],
      { capability: "summarize" },
    );

    const parsed = JSON.parse(this.requireJsonObjectContent(response)) as {
      deepSummary?: unknown;
      evidence?: unknown;
      keyPoints?: unknown;
      summary?: unknown;
      worthSaving?: unknown;
    };

    if (typeof parsed.summary !== "string" || !cleanText(parsed.summary)) {
      throw new Error("Compiled memory digest is missing a valid summary.");
    }

    if (
      typeof parsed.deepSummary !== "string" ||
      !cleanText(parsed.deepSummary)
    ) {
      throw new Error("Compiled memory digest is missing a valid deepSummary.");
    }

    return {
      deepSummary: cleanText(parsed.deepSummary),
      evidence: ensureStringArray(parsed.evidence, "memoryDigest.evidence", {
        minLength: 1,
      }),
      keyPoints: ensureStringArray(parsed.keyPoints, "memoryDigest.keyPoints", {
        minLength: 1,
      }),
      summary: cleanText(parsed.summary),
      worthSaving: ensureBoolean(
        parsed.worthSaving,
        "memoryDigest.worthSaving",
      ),
    };
  }

  private createSavedMemoryCard(
    id: string,
    sourceItem: SourceItem,
    createdAt: string,
  ): DraftMemoryCard {
    return {
      createdAt,
      deepSummary: "",
      evidence: [],
      id,
      keyPoints: [],
      sequence: this.sequence,
      sourceChannel: sourceItem.sourceChannel,
      sourceItemId: sourceItem.id,
      status: "saved",
      summary: "",
      title: this.buildTitle(sourceItem),
      topicIds: [],
      updatedAt: createdAt,
      worthSaving: false,
    };
  }

  private hasStructuredDigest(card: MemoryCard): boolean {
    return Boolean(
      cleanText(card.summary) &&
        cleanText(card.deepSummary) &&
        card.keyPoints.length > 0 &&
        card.evidence.length > 0,
    );
  }

  private digestFromMemoryCard(card: MemoryCard): StructuredMemoryDigest {
    return {
      deepSummary: card.deepSummary,
      evidence: card.evidence,
      keyPoints: card.keyPoints,
      summary: card.summary,
      worthSaving: card.worthSaving,
    };
  }

  private createAnalyzedMemoryCard(input: {
    createdAt: string;
    digest: StructuredMemoryDigest;
    id: string;
    sequence: number;
    sourceItem: SourceItem;
    sourceTextEmbedding?: number[];
    status: Extract<MemoryCard["status"], "deep_ready" | "quick_ready">;
    topicIds: string[];
    updatedAt: string;
  }): DraftMemoryCard {
    return {
      createdAt: input.createdAt,
      deepSummary: input.digest.deepSummary,
      evidence: input.digest.evidence,
      id: input.id,
      keyPoints: input.digest.keyPoints,
      sequence: input.sequence,
      sourceChannel: input.sourceItem.sourceChannel,
      sourceItemId: input.sourceItem.id,
      sourceTextEmbedding: input.sourceTextEmbedding,
      status: input.status,
      summary: input.digest.summary,
      title: this.buildTitle(input.sourceItem),
      topicIds: input.topicIds,
      updatedAt: input.updatedAt,
      worthSaving: input.digest.worthSaving,
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

  private updateMemoryCard(card: DraftMemoryCard): void {
    this.database
      .prepare(
        `
          UPDATE memory_cards
          SET source_item_id = @sourceItemId,
              source_channel = @sourceChannel,
              title = @title,
              summary = @summary,
              deep_summary = @deepSummary,
              key_points_json = @keyPointsJson,
              evidence_json = @evidenceJson,
              topic_ids_json = @topicIdsJson,
              status = @status,
              worth_saving = @worthSaving,
              sequence = @sequence,
              updated_at = @updatedAt
          WHERE id = @id
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

  private async buildSourceChunks(
    sourceItemId: string,
    sourceText: string,
    createdAt: string,
    provider: ReturnType<MemduckService["getProvider"]>,
  ): Promise<DraftSourceChunk[]> {
    const rawChunks = chunkText(sourceText);

    if (rawChunks.length === 0) {
      throw new Error("Source text chunking produced no chunks.");
    }

    const embeddings = await Promise.all(
      rawChunks.map((chunk) => provider.embed(chunk.text)),
    );

    return rawChunks.map((chunk, index) => {
      const embedding = embeddings[index];

      if (!embedding) {
        throw new Error(`Missing embedding for source chunk ${index + 1}.`);
      }

      return {
        createdAt,
        embedding,
        endOffset: chunk.endOffset,
        id: `chunk-${sourceItemId}-${index + 1}`,
        sequence: index + 1,
        sourceItemId,
        startOffset: chunk.startOffset,
        text: chunk.text,
      };
    });
  }

  private insertSourceChunks(chunks: DraftSourceChunk[]): void {
    const statement = this.database.prepare(
      `
        INSERT INTO source_chunks (
          id, source_item_id, sequence, text, embedding_json,
          start_offset, end_offset, created_at
        ) VALUES (
          @id, @sourceItemId, @sequence, @text, @embeddingJson,
          @startOffset, @endOffset, @createdAt
        )
      `,
    );

    for (const chunk of chunks) {
      statement.run({
        createdAt: chunk.createdAt,
        embeddingJson: JSON.stringify(chunk.embedding),
        endOffset: chunk.endOffset,
        id: chunk.id,
        sequence: chunk.sequence,
        sourceItemId: chunk.sourceItemId,
        startOffset: chunk.startOffset,
        text: chunk.text,
      });
    }
  }

  private replaceSourceChunks(
    sourceItemId: string,
    chunks: DraftSourceChunk[],
  ): void {
    this.database
      .prepare("DELETE FROM source_chunks WHERE source_item_id = ?")
      .run(sourceItemId);
    this.insertSourceChunks(chunks);
  }

  private insertTopics(topics: Topic[]): void {
    if (topics.length === 0) {
      return;
    }

    const statement = this.database.prepare(
      `
        INSERT INTO topics (id, name, slug, keywords_json, created_at)
        VALUES (@id, @name, @slug, @keywordsJson, @createdAt)
      `,
    );

    for (const topic of topics) {
      statement.run({
        createdAt: topic.createdAt,
        id: topic.id,
        keywordsJson: JSON.stringify(topic.keywords),
        name: topic.name,
        slug: topic.slug,
      });
    }
  }

  private insertTopicLinks(topicLinks: DraftTopicLink[]): void {
    if (topicLinks.length === 0) {
      return;
    }

    const statement = this.database.prepare(
      `
        INSERT INTO topic_links (card_id, topic_id, confidence, reason, created_at)
        VALUES (@cardId, @topicId, @confidence, @reason, @createdAt)
      `,
    );

    for (const topicLink of topicLinks) {
      statement.run({
        cardId: topicLink.cardId,
        confidence: topicLink.confidence,
        createdAt: topicLink.createdAt,
        reason: topicLink.reason,
        topicId: topicLink.topicId,
      });
    }
  }

  private upsertTopicLink(topicLink: DraftTopicLink): void {
    this.database
      .prepare(
        `
          INSERT INTO topic_links (card_id, topic_id, confidence, reason, created_at)
          VALUES (@cardId, @topicId, @confidence, @reason, @createdAt)
          ON CONFLICT(card_id, topic_id) DO UPDATE SET
            confidence = excluded.confidence,
            reason = excluded.reason,
            created_at = excluded.created_at
        `,
      )
      .run({
        cardId: topicLink.cardId,
        confidence: topicLink.confidence,
        createdAt: topicLink.createdAt,
        reason: topicLink.reason,
        topicId: topicLink.topicId,
      });
  }

  private replaceTopicLinks(
    cardId: string,
    topicLinks: DraftTopicLink[],
  ): void {
    this.database
      .prepare("DELETE FROM topic_links WHERE card_id = ?")
      .run(cardId);
    this.insertTopicLinks(topicLinks);
  }

  private getTopicLink(cardId: string, topicId: string): TopicLink | null {
    const row = this.database
      .prepare(
        `
          SELECT * FROM topic_links
          WHERE card_id = ? AND topic_id = ?
        `,
      )
      .get(cardId, topicId) as Record<string, unknown> | undefined;

    return row ? toTopicLink(row) : null;
  }

  private listTopicLinks(topicId: string): TopicLink[] {
    const rows = this.database
      .prepare(
        `
          SELECT * FROM topic_links
          WHERE topic_id = ?
          ORDER BY created_at ASC
        `,
      )
      .all(topicId) as Record<string, unknown>[];

    return rows.map(toTopicLink);
  }

  private updateMemoryCardTopicIds(cardId: string, topicIds: string[]): void {
    this.database
      .prepare(
        `
          UPDATE memory_cards
          SET topic_ids_json = @topicIdsJson,
              updated_at = @updatedAt
          WHERE id = @cardId
        `,
      )
      .run({
        cardId,
        topicIdsJson: JSON.stringify([...new Set(topicIds)]),
        updatedAt: this.now().toISOString(),
      });
  }

  private createUniqueTopicSlug(name: string, excludeTopicId?: string): string {
    const baseSlug = slugify(name) || "topic";
    const reserved = new Set(
      this.listTopics()
        .filter((topic) => topic.id !== excludeTopicId)
        .map((topic) => topic.slug),
    );
    let slug = baseSlug;
    let suffix = 2;

    while (reserved.has(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private invalidateKnowledgeCompilation(): void {
    this.deleteSetting("compiled_topics");
    this.deleteSetting("compiled_review");
  }

  private stripCardEmbedding(card: DraftMemoryCard): MemoryCard {
    const { sourceTextEmbedding: _sourceTextEmbedding, ...memoryCard } = card;
    return memoryCard;
  }

  private buildTitle(sourceItem: SourceItem): string {
    if (sourceItem.pageTitle) {
      return sourceItem.pageTitle;
    }

    if (sourceItem.caption) {
      return titleCase(sourceItem.caption);
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

    return "Saved Memory";
  }

  private async resolveTopics(
    cardId: string,
    digest: StructuredMemoryDigest,
    createdAt: string,
  ): Promise<TopicResolution> {
    const existing = this.listTopics();
    const response = await this.getProvider().complete(
      "Resolve topic links. Return JSON with matches and newTopics. matches must reference existing topic ids. Ensure the total number of matches plus newTopics is between 1 and 3.",
      [
        "Existing topics:",
        ...(existing.length > 0
          ? existing.map(
              (topic) =>
                `${topic.id}: ${topic.name} [${topic.keywords.join(", ")}]`,
            )
          : ["<none>"]),
        "",
        "Memory card digest:",
        `Summary: ${digest.summary}`,
        `Deep summary: ${digest.deepSummary}`,
        `Key points: ${digest.keyPoints.join(" | ")}`,
        `Evidence: ${digest.evidence.join(" | ")}`,
      ],
      { capability: "answer" },
    );

    const parsed = JSON.parse(this.requireJsonObjectContent(response)) as {
      matches?: Array<{
        confidence?: unknown;
        reason?: unknown;
        topicId?: unknown;
      }>;
      newTopics?: Array<{
        confidence?: unknown;
        keywords?: unknown;
        name?: unknown;
        reason?: unknown;
      }>;
    };
    const matches = parsed.matches ?? [];
    const newTopics = parsed.newTopics ?? [];

    if (!Array.isArray(matches)) {
      throw new Error("Resolved topic matches must be an array.");
    }

    if (!Array.isArray(newTopics)) {
      throw new Error("Resolved newTopics must be an array.");
    }

    const existingById = new Map(existing.map((topic) => [topic.id, topic]));
    const existingByName = new Map(
      existing.map((topic) => [topic.name.toLowerCase(), topic]),
    );
    const reservedSlugs = new Set(existing.map((topic) => topic.slug));
    const topicsToInsert: Topic[] = [];
    const topicLinks: DraftTopicLink[] = [];

    for (const match of matches) {
      if (
        typeof match.topicId !== "string" ||
        !existingById.has(match.topicId)
      ) {
        throw new Error("Resolved topic match references an unknown topic id.");
      }

      if (typeof match.reason !== "string" || !cleanText(match.reason)) {
        throw new Error("Resolved topic match is missing a valid reason.");
      }

      topicLinks.push({
        cardId,
        confidence: ensureNumberInRange(
          match.confidence,
          "topicMatch.confidence",
          { max: 1, min: 0 },
        ),
        createdAt,
        reason: cleanText(match.reason),
        topicId: match.topicId,
      });
    }

    for (const entry of newTopics) {
      if (typeof entry.name !== "string" || !cleanText(entry.name)) {
        throw new Error("Resolved new topic is missing a valid name.");
      }

      if (typeof entry.reason !== "string" || !cleanText(entry.reason)) {
        throw new Error("Resolved new topic is missing a valid reason.");
      }

      const normalizedName = cleanText(entry.name);
      let topic =
        existingByName.get(normalizedName.toLowerCase()) ??
        topicsToInsert.find(
          (candidate) =>
            candidate.name.toLowerCase() === normalizedName.toLowerCase(),
        );

      if (!topic) {
        const baseSlug = slugify(normalizedName) || "topic";
        let slug = baseSlug;
        let suffix = 2;

        while (reservedSlugs.has(slug)) {
          slug = `${baseSlug}-${suffix}`;
          suffix += 1;
        }

        reservedSlugs.add(slug);
        topic = {
          createdAt,
          id: `topic-${existing.length + topicsToInsert.length + 1}`,
          keywords: ensureStringArray(entry.keywords, "newTopic.keywords", {
            minLength: 1,
          }),
          name: normalizedName,
          slug,
        };
        topicsToInsert.push(topic);
      }

      topicLinks.push({
        cardId,
        confidence: ensureNumberInRange(
          entry.confidence,
          "newTopic.confidence",
          { max: 1, min: 0 },
        ),
        createdAt,
        reason: cleanText(entry.reason),
        topicId: topic.id,
      });
    }

    if (topicLinks.length === 0 || topicLinks.length > 3) {
      throw new Error(
        "Resolved topic links must contain between 1 and 3 links.",
      );
    }

    const dedupedLinks = [
      ...new Map(
        topicLinks
          .sort((left, right) => right.confidence - left.confidence)
          .map((link) => [link.topicId, link]),
      ).values(),
    ];

    if (dedupedLinks.length === 0 || dedupedLinks.length > 3) {
      throw new Error(
        "Resolved topic links became invalid after deduplication.",
      );
    }

    return {
      topicIds: dedupedLinks.map((link) => link.topicId),
      topicLinks: dedupedLinks,
      topicsToInsert,
    };
  }

  private async resolveTopicsWithFallback(
    cardId: string,
    digest: StructuredMemoryDigest,
    createdAt: string,
  ): Promise<TopicResolution> {
    try {
      return await this.resolveTopics(cardId, digest, createdAt);
    } catch {
      return this.resolveTopicsLocally(cardId, digest, createdAt);
    }
  }

  private resolveTopicsLocally(
    cardId: string,
    digest: StructuredMemoryDigest,
    createdAt: string,
  ): TopicResolution {
    const existing = this.listTopics();
    const keywords = takeTop(
      tokenize(digest.summary, digest.deepSummary, ...digest.keyPoints),
      6,
    );
    const topicName = this.deriveLocalTopicName(digest, keywords);
    const existingTopic = existing.find(
      (topic) => topic.name.toLowerCase() === topicName.toLowerCase(),
    );
    const topic =
      existingTopic ??
      ({
        createdAt,
        id: `topic-${existing.length + 1}`,
        keywords: keywords.length > 0 ? keywords : [slugify(topicName)],
        name: topicName,
        slug: this.createUniqueTopicSlug(topicName),
      } satisfies Topic);

    return {
      topicIds: [topic.id],
      topicLinks: [
        {
          cardId,
          confidence: 0.55,
          createdAt,
          reason:
            "Local fallback topic assigned after provider topic resolution failed.",
          topicId: topic.id,
        },
      ],
      topicsToInsert: existingTopic ? [] : [topic],
    };
  }

  private deriveLocalTopicName(
    digest: StructuredMemoryDigest,
    keywords: string[],
  ): string {
    const namedEntity = cleanText(
      [digest.summary, digest.deepSummary, ...digest.keyPoints]
        .join(" ")
        .match(/\b[A-Z][A-Za-z0-9]*(?:[.-][A-Za-z0-9]+)*\b/u)?.[0] ?? "",
    );

    if (namedEntity && namedEntity.length > 1) {
      return namedEntity;
    }

    const fallback = takeTop(keywords, 2).join(" ");
    return fallback ? titleCase(fallback) : "General Memory";
  }

  private requireJsonObjectContent(content: string): string {
    const trimmed = content.trim();

    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      throw new Error("Provider returned non-JSON content.");
    }

    return trimmed;
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

  private buildChunkCitations(
    queryEmbedding: number[],
    cards: MemoryCard[],
  ): Citation[] {
    const chunkCandidates = cards
      .map((card) => {
        const chunk = this.listSourceChunks(card.sourceItemId)
          .map((sourceChunk) => ({
            card,
            chunk: sourceChunk,
            score: cosineSimilarity(queryEmbedding, sourceChunk.embedding),
          }))
          .sort((left, right) => right.score - left.score)[0];

        if (!chunk) {
          throw new Error(`Source chunks are unavailable for card ${card.id}.`);
        }

        return chunk;
      })
      .sort((left, right) => right.score - left.score);

    return takeTop(chunkCandidates, 2).map(({ card, chunk }) => ({
      cardId: card.id,
      chunkId: chunk.id,
      endOffset: chunk.endOffset,
      quote: chunk.text,
      sourceItemId: chunk.sourceItemId,
      startOffset: chunk.startOffset,
      title: card.title,
    }));
  }

  private buildRetrievalCitations(
    query: string,
    cards: MemoryCard[],
    queryEmbedding?: number[],
  ): Citation[] {
    if (cards.length === 0) {
      return [];
    }

    return queryEmbedding
      ? this.buildChunkCitations(queryEmbedding, cards)
      : this.buildLocalChunkCitations(query, cards);
  }

  private buildLocalChunkCitations(
    query: string,
    cards: MemoryCard[],
  ): Citation[] {
    const chunkCandidates = cards
      .map((card) => {
        const chunks = this.listSourceChunks(card.sourceItemId);
        const chunk =
          chunks
            .map((sourceChunk) => ({
              card,
              chunk: sourceChunk,
              score: this.scoreTextAgainstQuery(query, sourceChunk.text),
            }))
            .sort((left, right) => right.score - left.score)[0] ?? null;

        if (!chunk) {
          throw new Error(`Source chunks are unavailable for card ${card.id}.`);
        }

        return chunk;
      })
      .sort((left, right) => right.score - left.score);

    return takeTop(chunkCandidates, 2).map(({ card, chunk }) => ({
      cardId: card.id,
      chunkId: chunk.id,
      endOffset: chunk.endOffset,
      quote: chunk.text,
      sourceItemId: chunk.sourceItemId,
      startOffset: chunk.startOffset,
      title: card.title,
    }));
  }

  private scoreTextAgainstQuery(query: string, text: string): number {
    const queryTokens = new Set(tokenize(query));
    if (queryTokens.size === 0) {
      return 0;
    }

    const textTokens = new Set(tokenize(text));
    const overlap = [...queryTokens].filter((token) =>
      textTokens.has(token),
    ).length;
    const phraseScore = text
      .toLowerCase()
      .includes(cleanText(query).toLowerCase())
      ? 1
      : 0;

    return Math.min(
      1,
      (overlap / queryTokens.size) * 0.75 + phraseScore * 0.25,
    );
  }

  private buildAnswerContextLines(
    cards: MemoryCard[],
    citations: Citation[],
  ): string[] {
    return takeTop(cards, 3).map((card) => {
      const cardCitations = citations
        .filter((citation) => citation.cardId === card.id)
        .map((citation) => citation.quote);

      return [
        `Title: ${card.title}`,
        `Summary: ${card.summary}`,
        `Deep summary: ${card.deepSummary}`,
        ...(cardCitations.length > 0
          ? [`Grounding: ${cardCitations.join(" | ")}`]
          : []),
      ].join("\n");
    });
  }

  private buildLocalMemoryAnswer(cards: MemoryCard[]): string {
    return takeTop(cards, 3)
      .map((card) => {
        const points =
          card.keyPoints.length > 0
            ? ` Key points: ${takeTop(card.keyPoints, 3).join("; ")}.`
            : "";

        return `${card.title}: ${card.summary}${points}`;
      })
      .join("\n\n");
  }

  private async answerWithProviderFallback(
    question: string,
    contextLines: string[],
    cards: MemoryCard[],
  ): Promise<string> {
    const providerAnswer = this.getProvider().answer(question, contextLines);
    providerAnswer.catch(() => undefined);

    return Promise.race([providerAnswer, this.localAnswerAfterDeadline(cards)]);
  }

  private async *answerStreamWithProviderFallback(
    question: string,
    contextLines: string[],
    cards: MemoryCard[],
  ): AsyncIterable<string> {
    const iterator = this.getProvider()
      .answerStream(question, contextLines)
      [Symbol.asyncIterator]();
    const firstToken = iterator.next();
    firstToken.catch(() => undefined);
    const firstResult = await Promise.race([
      firstToken,
      this.localAnswerAfterDeadline(cards).then((answer) => ({
        fallbackAnswer: answer,
      })),
    ]);

    if ("fallbackAnswer" in firstResult) {
      yield firstResult.fallbackAnswer;
      return;
    }

    if (firstResult.done) {
      yield this.buildLocalMemoryAnswer(cards);
      return;
    }

    yield firstResult.value;

    while (true) {
      const next = await iterator.next();
      if (next.done) {
        return;
      }
      yield next.value;
    }
  }

  private async localAnswerAfterDeadline(cards: MemoryCard[]): Promise<string> {
    await new Promise((resolve) =>
      setTimeout(resolve, this.retrievalProviderDeadlineMs),
    );

    return this.buildLocalMemoryAnswer(cards);
  }

  private matchesRetrievalFilters(
    card: MemoryCard | undefined,
    filters?: AskRequest["filters"],
  ) {
    if (!card) {
      return false;
    }

    if (filters?.cardIds && !filters.cardIds.includes(card.id)) {
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
            id, conversation_id, role, content, citations_json, attachments_json, created_at
          ) VALUES (
            @id, @conversationId, @role, @content, @citationsJson, @attachmentsJson, @createdAt
          )
        `,
      )
      .run({
        attachmentsJson: message.attachments?.length
          ? JSON.stringify(message.attachments)
          : null,
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
