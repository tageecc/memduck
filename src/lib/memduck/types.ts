export type InputKind = "image" | "text" | "url";
export type SourceChannel = "extension" | "telegram" | "web";
export type RequestedDepth = "deep" | "quick" | "save";

export interface UrlPayload {
  url: string;
}

export interface TextPayload {
  text: string;
}

export interface ImagePayload {
  fileName: string;
  mimeType: string;
  objectKey: string;
}

export type InputPayload = ImagePayload | TextPayload | UrlPayload;

export interface SourceContext {
  caption?: string;
  pageTitle?: string;
  tags?: string[];
}

export interface InputEnvelope {
  kind: InputKind;
  payload: InputPayload;
  requestedDepth: RequestedDepth;
  sourceChannel: SourceChannel;
  sourceContext?: SourceContext;
}

export interface SourceItem {
  bodyText?: string;
  caption?: string;
  createdAt: string;
  id: string;
  kind: InputKind;
  mimeType?: string;
  objectKey?: string;
  pageTitle?: string;
  snapshotPath?: string;
  sourceChannel: SourceChannel;
  sourceUrl?: string;
}

export interface SourceChunk {
  createdAt: string;
  embedding: number[];
  endOffset: number;
  id: string;
  sequence: number;
  sourceItemId: string;
  startOffset: number;
  text: string;
}

export type MemoryCardStatus = "deep_ready" | "quick_ready" | "saved";

export interface MemoryCard {
  createdAt: string;
  deepSummary: string;
  evidence: string[];
  id: string;
  keyPoints: string[];
  sequence: number;
  sourceChannel: SourceChannel;
  sourceItemId: string;
  status: MemoryCardStatus;
  summary: string;
  title: string;
  topicIds: string[];
  updatedAt: string;
  worthSaving: boolean;
}

export interface Topic {
  createdAt: string;
  id: string;
  keywords: string[];
  name: string;
  slug: string;
}

export interface TelegramChatState {
  chatId: string;
  lastCardId?: string;
  lastConversationId?: string;
  updatedAt: string;
}

export interface Citation {
  cardId: string;
  chunkId: string;
  endOffset: number;
  quote: string;
  sourceItemId: string;
  startOffset: number;
  title: string;
}

export interface TopicLink {
  cardId: string;
  confidence: number;
  createdAt: string;
  reason: string;
  topicId: string;
}

export interface AskRequest {
  conversationId?: string;
  filters?: {
    cardIds?: string[];
    dateFrom?: string;
    dateTo?: string;
    sourceChannels?: SourceChannel[];
    topicIds?: string[];
  };
  question: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
  conversationId: string;
}

export interface SearchRequest {
  filters?: AskRequest["filters"];
  limit?: number;
  query: string;
}

export interface Conversation {
  createdAt: string;
  id: string;
  updatedAt: string;
}

export interface ConversationMessage {
  citations?: Citation[];
  content: string;
  conversationId: string;
  createdAt: string;
  id: string;
  role: "assistant" | "user";
}

export interface ConversationSummary {
  createdAt: string;
  id: string;
  lastMessagePreview: string;
  messageCount: number;
  updatedAt: string;
}

export interface ConversationThread {
  conversation: ConversationSummary;
  messages: ConversationMessage[];
}

export interface TopicInsights {
  conflictPoints: string[];
  repeatedPoints: string[];
  summary: string;
}

export interface ReviewSections {
  staleHighValue: MemoryCard[];
  themeMomentum: MemoryCard[];
  today: MemoryCard[];
}

export interface RetrievalItem {
  card: MemoryCard;
  rerankScore: number;
  semanticScore: number;
}

export interface RetrievalResult {
  items: RetrievalItem[];
  strategy: "embedding-rerank";
}

export interface CompiledTopic {
  cardIds: string[];
  conflictPoints: string[];
  nextQuestions: string[];
  repeatedPoints: string[];
  summary: string;
  topicId: string;
  updatedAt: string;
}

export interface CompiledReviewBuckets {
  staleHighValue: MemoryCard[];
  themeMomentum: MemoryCard[];
  today: MemoryCard[];
  updatedAt: string;
}

export interface ChannelHeartbeat {
  channel: SourceChannel;
  metadata: Record<string, string>;
  occurredAt: string;
}

export interface ChannelConnectionStatus {
  channel: SourceChannel;
  lastHeartbeatAt: string;
  metadata: Record<string, string>;
}

export interface IngestResult {
  memoryCard: MemoryCard;
  sourceItem: SourceItem;
}

export interface UserSignal {
  cardId?: string;
  createdAt: Date | string;
  id: string;
  topicId?: string;
  type:
    | "ask"
    | "follow_up"
    | "highlight"
    | "review_request"
    | "save"
    | "star"
    | "view";
}

export type UserSignalType = UserSignal["type"];

export interface CardSignalSummary {
  cardId: string;
  counts: Record<UserSignalType, number>;
  lastSignalAt: string | null;
  total: number;
}

export interface ReviewCandidate {
  cardId: string;
  interestScore: number;
  priorityScore: number;
  repeatedThemeScore: number;
  revisitGapDays: number;
  topicId?: string;
  valueScore: number;
}

export type ProviderKind =
  | "anthropic"
  | "gemini"
  | "ollama"
  | "openai"
  | "openai-compatible";

export interface ProviderSettings {
  answerModel: string;
  apiKey?: string;
  baseUrl: string;
  embeddingModel: string;
  kind: ProviderKind;
  rerankModel: string;
  summarizeModel: string;
  visionModel: string;
}

export interface ProviderProfile extends ProviderSettings {
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
}

export interface ChannelSettings {
  extension: {
    captureBaseUrl: string;
    enabled: boolean;
  };
  telegram: {
    baseUrl: string;
    botToken?: string;
    botUsername?: string;
    enabled: boolean;
  };
  web: {
    enabled: boolean;
  };
}

export interface SetupState {
  hasAnyMemories: boolean;
  needsOnboarding: boolean;
  providerConfigured: boolean;
  providerKind: ProviderKind | null;
}

export interface ChannelRuntimeDiagnostic {
  configured: boolean;
  connected: boolean;
  enabled: boolean;
  label: string;
  lastHeartbeatAt: string | null;
}

export interface RuntimeDiagnostics {
  channels: {
    extension: ChannelRuntimeDiagnostic;
    telegram: ChannelRuntimeDiagnostic;
    web: ChannelRuntimeDiagnostic;
  };
  features: {
    embeddings: boolean;
    rerank: boolean;
    vision: boolean;
  };
  provider: {
    id: string;
    kind: ProviderKind;
    name: string;
  } | null;
  setup: SetupState;
  stats: {
    compiledTopics: number;
    conversations: number;
    memoryCards: number;
    reviewCompiled: boolean;
    topics: number;
  };
}

export interface ServiceOptions {
  contentFetch?: typeof fetch;
  now?: () => Date;
  providerFetch?: typeof fetch;
  runtimeDir: string;
}
