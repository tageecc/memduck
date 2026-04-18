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
  sourceChannel: SourceChannel;
  sourceUrl?: string;
}

export interface MemoryCard {
  createdAt: string;
  deepSummary: string;
  evidence: string[];
  id: string;
  keyPoints: string[];
  sequence: number;
  sourceChannel: SourceChannel;
  sourceItemId: string;
  status: "degraded" | "ready";
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

export interface Citation {
  cardId: string;
  quote: string;
  sourceItemId: string;
  title: string;
}

export interface AskRequest {
  filters?: {
    sourceChannels?: SourceChannel[];
    topicIds?: string[];
  };
  question: string;
}

export interface AskResponse {
  answer: string;
  citations: Citation[];
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

export interface ReviewCandidate {
  cardId: string;
  interestScore: number;
  priorityScore: number;
  repeatedThemeScore: number;
  revisitGapDays: number;
  topicId?: string;
  valueScore: number;
}

export interface ProviderFailures {
  answer?: string;
  summarize?: string;
  visionAnalyze?: string;
}

export interface ServiceOptions {
  now?: () => Date;
  providerFailures?: ProviderFailures;
  runtimeDir: string;
}
