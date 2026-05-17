"use client";

import type { FileUIPart } from "ai";
import { HistoryIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionAddScreenshot,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@/components/ai-elements/tool";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { shouldDigestText } from "@/lib/ask-routing";
import { readAskStreamEvents } from "@/lib/ask-stream-events";
import { readErrorMessage, readJsonObject } from "@/lib/http/response";
import { buildCitationHref } from "@/lib/memduck/citation-link";
import type {
  Citation,
  ConversationAttachment,
  ConversationSummary,
  ConversationThread,
  MemoryCard,
  SourceItem,
} from "@/lib/memduck/service";

type IngestDepth = "deep" | "quick";

type AgentTool = {
  errorText?: string;
  input?: unknown;
  output?: unknown;
  state: ToolPart["state"];
  title?: string;
  type: `tool-${string}`;
};

type AgentMessage = {
  attachments?: Array<FileUIPart & { id: string }>;
  citations?: Citation[];
  content: string;
  id: string;
  isStreaming?: boolean;
  memoryCard?: MemoryCard;
  reasoning?: string;
  role: "assistant" | "system" | "user";
  tools?: AgentTool[];
};

type StatusNotice = {
  message: string;
  tone: "error" | "info";
};

const ASK_REQUEST_TIMEOUT_MS = 45_000;
const INITIAL_ASK_REPLAY_TTL_MS = 60_000;
const RETRIEVE_MEMORY_TOOL_TITLE = "检索记忆";

type InitialAskReplay =
  | { conversationId: string; status: "complete" }
  | { startedAt: number; status: "pending" };

function extractFirstUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s<>"']+/u);
  if (!match) return null;
  return new URL(match[0]).toString();
}

function stripUrl(value: string, url: string) {
  return value.replace(url, "").trim();
}

function buildDigestAnswer(
  card: MemoryCard,
  depth: IngestDepth,
  warning?: string,
) {
  if (card.status === "saved") {
    return `已先保存为记忆：${card.title}\n\n${
      warning ?? "内容已保留，可稍后在记忆页继续分析。"
    }`;
  }

  const points =
    card.keyPoints.length > 0
      ? `\n\n${card.keyPoints.map((point) => `- ${point}`).join("\n")}`
      : "";
  const depthLabel = depth === "deep" ? "（深度消化）" : "";
  return `已保存为记忆${depthLabel}：${card.title}\n\n${card.summary}${points}`;
}

function buildDigestConversationAnswer(
  card: MemoryCard,
  depth: IngestDepth,
  warning?: string,
) {
  return `${buildDigestAnswer(card, depth, warning)}\n\n[打开记忆](/memory/${
    card.id
  })`;
}

function splitReasoning(content: string) {
  const closedMatch = content.match(/<think>([\s\S]*?)<\/think>/u);
  if (closedMatch) {
    return {
      reasoning: closedMatch[1]?.trim(),
      text: content.replace(closedMatch[0], "").trim(),
    };
  }

  const openIndex = content.indexOf("<think>");
  if (openIndex >= 0) {
    return {
      reasoning: content.slice(openIndex + "<think>".length).trim(),
      text: content.slice(0, openIndex).trim(),
    };
  }

  return { reasoning: undefined, text: content };
}

function extractMemoryLink(content: string) {
  const match = content.match(/\s*\[打开记忆\]\((\/memory\/[^)\s]+)\)\s*$/u);
  if (!match?.[1]) {
    return { href: null, text: content };
  }

  return {
    href: match[1],
    text: content.slice(0, match.index).trim(),
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isTimeoutError(error: unknown) {
  return error instanceof DOMException && error.name === "TimeoutError";
}

function buildInitialAskReplayKey(input: {
  cardIds: string[];
  question: string;
  topicId: string;
}) {
  const key = JSON.stringify({
    cardIds: input.cardIds,
    question: input.question,
    topicId: input.topicId,
  });
  return `memduck.ask.initial.${encodeURIComponent(key)}`;
}

function readInitialAskReplay(key: string): InitialAskReplay | null {
  try {
    const value = window.sessionStorage.getItem(key);
    if (!value) return null;
    const parsed = JSON.parse(value) as InitialAskReplay;
    if (
      parsed.status === "complete" &&
      typeof parsed.conversationId === "string"
    ) {
      return parsed;
    }
    if (parsed.status === "pending" && typeof parsed.startedAt === "number") {
      return parsed;
    }
  } catch {
    window.sessionStorage.removeItem(key);
  }

  return null;
}

function writeInitialAskReplay(key: string, value: InitialAskReplay) {
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

async function filePartToFile(file: FileUIPart) {
  if (!file.mediaType?.startsWith("image/")) {
    throw new Error("只支持图片输入。");
  }
  const response = await fetch(file.url);
  if (!response.ok) throw new Error("图片读取失败。");
  const blob = await response.blob();
  return new File([blob], file.filename ?? "image.png", {
    type: file.mediaType,
  });
}

function buildHistoryTool(
  msg: ConversationThread["messages"][number],
  previousUserContent?: string,
): AgentTool[] | undefined {
  if (msg.role !== "assistant" || !msg.citations) {
    return undefined;
  }

  return [
    {
      input: {
        query: previousUserContent ?? "",
      },
      output: {
        citations: msg.citations.length,
      },
      state: "output-available",
      title: RETRIEVE_MEMORY_TOOL_TITLE,
      type: "tool-retrieve_memory",
    },
  ];
}

function threadToMessages(thread: ConversationThread): AgentMessage[] {
  let previousUserContent = "";

  return thread.messages.map((msg) => {
    const tools = buildHistoryTool(msg, previousUserContent);

    if (msg.role === "user") {
      previousUserContent = msg.content;
    }

    return {
      attachments: msg.attachments,
      citations: msg.citations ?? [],
      content: msg.content,
      id: msg.id,
      role: msg.role,
      tools,
    };
  });
}

function PromptAttachmentsPreview() {
  const attachments = usePromptInputAttachments();
  if (attachments.files.length === 0) return null;
  return (
    <PromptInputHeader>
      <Attachments variant="inline">
        {attachments.files.map((file) => (
          <Attachment
            data={file}
            key={file.id}
            onRemove={() => attachments.remove(file.id)}
          >
            <AttachmentPreview />
            <AttachmentInfo />
            <AttachmentRemove />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}

function MemoryResult({ card }: { card: MemoryCard }) {
  return (
    <Card className="mt-3 max-w-xl" size="sm">
      <CardHeader>
        <CardTitle>{card.title}</CardTitle>
        <CardDescription>{card.summary}</CardDescription>
      </CardHeader>
      <CardFooter className="pt-0">
        <Button asChild size="sm" variant="outline">
          <Link href={`/memory/${card.id}`}>打开记忆</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function MessageCitations({
  citations,
  messageId,
}: {
  citations: Citation[];
  messageId: string;
}) {
  if (citations.length === 0) return null;
  return (
    <Sources className="mt-3">
      <SourcesTrigger count={citations.length}>
        <span>引用 {citations.length}</span>
      </SourcesTrigger>
      <SourcesContent>
        {citations.map((citation) => (
          <Source
            href={buildCitationHref(citation)}
            key={`${messageId}-${citation.cardId}-${citation.quote}`}
            title={citation.title}
          >
            <span className="max-w-md truncate">{citation.title}</span>
          </Source>
        ))}
      </SourcesContent>
    </Sources>
  );
}

function MessageTools({ tools }: { tools?: AgentTool[] }) {
  if (!tools?.length) return null;

  return (
    <>
      {tools.map((tool) => (
        <Tool
          defaultOpen={tool.state !== "output-available"}
          key={`${tool.type}-${tool.state}`}
        >
          <ToolHeader state={tool.state} title={tool.title} type={tool.type} />
          <ToolContent>
            <ToolInput input={tool.input as ToolPart["input"]} />
            <ToolOutput
              errorText={tool.errorText as ToolPart["errorText"]}
              output={tool.output as ToolPart["output"]}
            />
          </ToolContent>
        </Tool>
      ))}
    </>
  );
}

async function readConversationSummaries(response: Response) {
  const data = (await readJsonObject(response)) as {
    conversations?: ConversationSummary[];
  } | null;

  if (!Array.isArray(data?.conversations)) {
    throw new Error("历史对话加载失败。");
  }

  return data.conversations;
}

async function readConversationThread(response: Response) {
  const thread = (await readJsonObject(response)) as
    | (ConversationThread & {
        messages?: unknown;
      })
    | null;

  if (!thread || !Array.isArray(thread.messages)) {
    throw new Error("历史对话加载失败。");
  }

  return thread;
}

async function readMemoryCardPayload(response: Response, fallback: string) {
  const payload = (await readJsonObject(response)) as {
    memoryCard?: MemoryCard;
    sourceItem?: SourceItem;
    warning?: string;
  } | null;

  if (
    !payload?.memoryCard ||
    typeof payload.memoryCard !== "object" ||
    !payload.sourceItem ||
    typeof payload.sourceItem !== "object"
  ) {
    throw new Error(fallback);
  }

  return {
    memoryCard: payload.memoryCard,
    sourceItem: payload.sourceItem,
    warning: payload.warning,
  };
}

function assetUrlForObjectKey(objectKey: string) {
  return `/api/assets/${objectKey
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}

function conversationAttachmentFromSource(
  sourceItem: SourceItem,
): ConversationAttachment | undefined {
  if (!sourceItem.objectKey || !sourceItem.mimeType?.startsWith("image/")) {
    return undefined;
  }

  return {
    filename: sourceItem.objectKey.split("/").at(-1) ?? "image.png",
    id: `attachment-${sourceItem.id}`,
    mediaType: sourceItem.mimeType,
    type: "file",
    url: assetUrlForObjectKey(sourceItem.objectKey),
  };
}

function MessageParts({ message }: { message: AgentMessage }) {
  const { reasoning, text } = splitReasoning(message.content);
  const memoryLink = extractMemoryLink(text);
  const reasoningText = [message.reasoning, reasoning]
    .filter(Boolean)
    .join("\n\n");

  return (
    <>
      {message.attachments?.length ? (
        <Attachments variant="grid">
          {message.attachments.map((attachment) => (
            <Attachment data={attachment} key={attachment.id}>
              <AttachmentPreview />
            </Attachment>
          ))}
        </Attachments>
      ) : null}
      {reasoningText ? (
        <Reasoning className="w-full" isStreaming={message.isStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{reasoningText}</ReasoningContent>
        </Reasoning>
      ) : null}
      <MessageTools tools={message.tools} />
      {memoryLink.text ? (
        <MessageResponse>{memoryLink.text}</MessageResponse>
      ) : null}
      {message.memoryCard ? <MemoryResult card={message.memoryCard} /> : null}
      {!message.memoryCard && memoryLink.href ? (
        <div className="mt-3">
          <Button asChild size="sm" variant="outline">
            <Link href={memoryLink.href}>打开记忆</Link>
          </Button>
        </div>
      ) : null}
      {message.citations ? (
        <MessageCitations
          citations={message.citations}
          messageId={message.id}
        />
      ) : null}
    </>
  );
}

function ConversationHistorySheet({
  currentId,
  onSelect,
  onNew,
}: {
  currentId: string | null;
  onNew: () => void;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    void fetch("/api/conversations", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await readErrorMessage(response, "历史对话加载失败。"),
          );
        }

        return readConversationSummaries(response);
      })
      .then((nextConversations) => setConversations(nextConversations))
      .catch((fetchError: Error) => {
        if (fetchError.name !== "AbortError") {
          setError("历史对话加载失败。");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [open]);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost">
          <HistoryIcon data-icon="inline-start" />
          历史
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>对话历史</SheetTitle>
          <SheetDescription>切换或新建 Ask 对话。</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-2 overflow-y-auto">
          <Button
            className="justify-start"
            onClick={() => {
              onNew();
              setOpen(false);
            }}
            size="sm"
            variant="outline"
          >
            <PlusIcon data-icon="inline-start" />
            新对话
          </Button>
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : null}
          {error ? (
            <p className="py-8 text-center text-destructive text-sm">{error}</p>
          ) : null}
          {conversations.map((conv) => (
            <Button
              className="h-auto w-full min-w-0 justify-start overflow-hidden whitespace-normal"
              key={conv.id}
              onClick={() => {
                onSelect(conv.id);
                setOpen(false);
              }}
              type="button"
              variant={conv.id === currentId ? "secondary" : "ghost"}
            >
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left">
                <span className="line-clamp-2 w-full break-words">
                  {conv.lastMessagePreview || "空对话"}
                </span>
                <span className="w-full truncate text-muted-foreground text-xs">
                  {new Date(conv.updatedAt).toLocaleString()} ·{" "}
                  {conv.messageCount} 条消息
                </span>
              </span>
            </Button>
          ))}
          {!loading && !error && conversations.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              暂无历史对话
            </p>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AskStudio({
  initialCardIds,
  initialConversationId,
  initialQuestion,
  initialTopicId,
}: {
  initialCardIds?: string[];
  initialConversationId?: string;
  initialQuestion?: string;
  initialTopicId?: string;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState(initialCardIds ?? []);
  const [selectedTopic, setSelectedTopic] = useState(initialTopicId ?? "");
  const [ingestDepth, setIngestDepth] = useState<IngestDepth>("quick");
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyLoadControllerRef = useRef<AbortController | null>(null);
  const loadedInitialConversationRef = useRef<string | null>(null);
  const submittedInitialQuestionRef = useRef<string | null>(null);

  const submitInitialQuestion = useEffectEvent(
    async (question: string, replayKey: string) => {
      writeInitialAskReplay(replayKey, {
        startedAt: Date.now(),
        status: "pending",
      });

      const nextConversationId = await submitPrompt({
        files: [],
        text: question,
      });
      if (nextConversationId) {
        writeInitialAskReplay(replayKey, {
          conversationId: nextConversationId,
          status: "complete",
        });
        router.replace(
          `/ask?conversationId=${encodeURIComponent(nextConversationId)}`,
          { scroll: false },
        );
        return;
      }

      window.sessionStorage.removeItem(replayKey);
    },
  );

  const loadConversation = useCallback((id: string) => {
    abortControllerRef.current?.abort();
    historyLoadControllerRef.current?.abort();
    const controller = new AbortController();
    historyLoadControllerRef.current = controller;
    setPending(false);
    setStatusNotice({ message: "正在加载历史对话...", tone: "info" });
    setMessages([]);

    void fetch(`/api/conversations/${id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await readErrorMessage(response, "历史对话加载失败。"),
          );
        }

        return readConversationThread(response);
      })
      .then((thread) => {
        if (controller.signal.aborted) {
          return;
        }
        setConversationId(id);
        setMessages(threadToMessages(thread));
        setStatusNotice(null);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setStatusNotice({
            message: error.message || "历史对话加载失败。",
            tone: "error",
          });
        }
      })
      .finally(() => {
        if (historyLoadControllerRef.current === controller) {
          historyLoadControllerRef.current = null;
        }
      });
  }, []);

  const startNewConversation = useCallback(() => {
    historyLoadControllerRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setStatusNotice(null);
  }, []);

  useEffect(() => {
    setSelectedTopic(initialTopicId ?? "");
  }, [initialTopicId]);

  useEffect(() => {
    setSelectedCardIds(initialCardIds ?? []);
  }, [initialCardIds]);

  useEffect(() => {
    const id = initialConversationId?.trim();
    if (
      !id ||
      id === conversationId ||
      loadedInitialConversationRef.current === id
    ) {
      return;
    }

    loadedInitialConversationRef.current = id;
    loadConversation(id);
  }, [conversationId, initialConversationId, loadConversation]);

  useEffect(() => {
    const question = initialQuestion?.trim();
    const replayKey = question
      ? buildInitialAskReplayKey({
          cardIds: initialCardIds ?? [],
          question,
          topicId: initialTopicId ?? "",
        })
      : "";
    const replay = replayKey ? readInitialAskReplay(replayKey) : null;
    if (replay?.status === "complete") {
      loadedInitialConversationRef.current = replay.conversationId;
      loadConversation(replay.conversationId);
      router.replace(
        `/ask?conversationId=${encodeURIComponent(replay.conversationId)}`,
        { scroll: false },
      );
      return;
    }

    if (
      replay?.status === "pending" &&
      Date.now() - replay.startedAt < INITIAL_ASK_REPLAY_TTL_MS
    ) {
      return;
    }

    if (
      question &&
      !initialConversationId &&
      submittedInitialQuestionRef.current !== replayKey
    ) {
      submittedInitialQuestionRef.current = replayKey;
      void submitInitialQuestion(question, replayKey);
    }
  }, [
    initialCardIds,
    initialConversationId,
    initialQuestion,
    initialTopicId,
    loadConversation,
    router,
  ]);

  function stopCurrentRequest() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setPending(false);
    setStatusNotice({ message: "已取消当前请求。", tone: "info" });
    setMessages((current) => current.filter((message) => !message.isStreaming));
  }

  async function ingestImage(content: string, file: File, signal: AbortSignal) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("requestedDepth", ingestDepth);
    formData.append("sourceChannel", "web");
    if (content.trim()) {
      formData.append("caption", content.trim());
    }
    const response = await fetch("/api/ingest", {
      body: formData,
      method: "POST",
      signal,
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "图片消化失败。"));
    }
    return readMemoryCardPayload(response, "图片消化失败。");
  }

  async function ingestTextOrUrl(content: string, signal: AbortSignal) {
    const url = extractFirstUrl(content);
    const envelope = url
      ? {
          kind: "url",
          payload: { url },
          requestedDepth: ingestDepth,
          sourceChannel: "web",
          sourceContext: stripUrl(content, url)
            ? { caption: stripUrl(content, url) }
            : undefined,
        }
      : {
          kind: "text",
          payload: { text: content },
          requestedDepth: ingestDepth,
          sourceChannel: "web",
        };
    const response = await fetch("/api/ingest", {
      body: JSON.stringify(envelope),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal,
    });
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "内容消化失败。"));
    }
    return readMemoryCardPayload(response, "内容消化失败。");
  }

  async function askAgentStream(
    content: string,
    signal: AbortSignal,
  ): Promise<{
    answer: string;
    citations: Citation[];
    conversationId: string;
  }> {
    const streamingId = `assistant-stream-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        content: "",
        id: streamingId,
        isStreaming: true,
        role: "assistant" as const,
        tools: [
          {
            input: {
              filters: {
                cardIds:
                  selectedCardIds.length > 0 ? selectedCardIds : undefined,
                topicIds: selectedTopic ? [selectedTopic] : undefined,
              },
              query: content,
            },
            state: "input-available",
            title: RETRIEVE_MEMORY_TOOL_TITLE,
            type: "tool-retrieve_memory",
          },
        ],
      },
    ]);

    let citations: Citation[] = [];
    let streamConvId = "";
    let fullText = "";

    try {
      const response = await fetch("/api/ask/stream", {
        body: JSON.stringify({
          conversationId: conversationId ?? undefined,
          filters: {
            cardIds: selectedCardIds.length > 0 ? selectedCardIds : undefined,
            topicIds: selectedTopic ? [selectedTopic] : undefined,
          },
          question: content,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal,
      });
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Agent 暂时无法回答。"),
        );
      }

      for await (const chunk of readAskStreamEvents(response.body, {
        idleTimeoutMs: 30_000,
      })) {
        if (chunk.error) {
          throw new Error(chunk.error);
        }

        if (chunk.citations) citations = chunk.citations;
        if (chunk.conversationId) streamConvId = chunk.conversationId;

        if (chunk.citations || chunk.conversationId) {
          setMessages((current) =>
            current.map((message) =>
              message.id === streamingId
                ? {
                    ...message,
                    citations,
                    tools: [
                      {
                        input: {
                          filters: {
                            cardIds:
                              selectedCardIds.length > 0
                                ? selectedCardIds
                                : undefined,
                            topicIds: selectedTopic
                              ? [selectedTopic]
                              : undefined,
                          },
                          query: content,
                        },
                        output: {
                          citations: citations.length,
                          conversationId: streamConvId,
                        },
                        state: "output-available",
                        title: RETRIEVE_MEMORY_TOOL_TITLE,
                        type: "tool-retrieve_memory",
                      },
                    ],
                  }
                : message,
            ),
          );
        }

        if (chunk.token) {
          fullText += chunk.token;
          setMessages((current) =>
            current.map((message) =>
              message.id === streamingId
                ? { ...message, citations, content: fullText }
                : message,
            ),
          );
        }
      }
    } catch (error) {
      setMessages((current) =>
        current.filter((message) => message.id !== streamingId),
      );
      throw error;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === streamingId
          ? { ...message, citations, content: fullText, isStreaming: false }
          : message,
      ),
    );

    return { answer: fullText, citations, conversationId: streamConvId };
  }

  async function persistDigestTurn(input: {
    assistantContent: string;
    signal: AbortSignal;
    userAttachments?: ConversationAttachment[];
    userContent: string;
  }): Promise<string> {
    const response = await fetch("/api/conversations", {
      body: JSON.stringify({
        assistant: {
          content: input.assistantContent,
        },
        conversationId: conversationId ?? undefined,
        user: {
          attachments: input.userAttachments,
          content: input.userContent,
        },
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: input.signal,
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "历史对话保存失败。"));
    }

    const thread = await readConversationThread(response);
    setConversationId(thread.conversation.id);
    return thread.conversation.id;
  }

  async function submitPrompt(
    message: PromptInputMessage,
  ): Promise<string | null> {
    const content = message.text.trim();
    const image = message.files.find((file) =>
      file.mediaType?.startsWith("image/"),
    );
    if (!content && !image) return null;

    const userMessage: AgentMessage = {
      attachments: image ? [{ ...image, id: `file-${Date.now()}` }] : undefined,
      content,
      id: `user-${Date.now()}`,
      role: "user",
    };
    setMessages((current) => [...current, userMessage]);
    setPending(true);
    setStatusNotice(null);
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let requestTimedOut = false;
    const timeout = window.setTimeout(() => {
      requestTimedOut = true;
      abortController.abort();
    }, ASK_REQUEST_TIMEOUT_MS);

    try {
      const url = extractFirstUrl(content);
      if (image) {
        const payload = await ingestImage(
          content,
          await filePartToFile(image),
          abortController.signal,
        );
        const assistantContent = buildDigestAnswer(
          payload.memoryCard,
          ingestDepth,
          payload.warning,
        );
        const persistedAttachment = conversationAttachmentFromSource(
          payload.sourceItem,
        );
        setMessages((current) => [
          ...current,
          {
            content: assistantContent,
            id: `assistant-${payload.memoryCard.id}`,
            memoryCard: payload.memoryCard,
            role: "assistant",
          },
        ]);
        return await persistDigestTurn({
          assistantContent: buildDigestConversationAnswer(
            payload.memoryCard,
            ingestDepth,
            payload.warning,
          ),
          signal: abortController.signal,
          userAttachments: persistedAttachment
            ? [persistedAttachment]
            : undefined,
          userContent: content || `图片：${image.filename ?? "image.png"}`,
        });
      }
      if (url || shouldDigestText(content)) {
        const payload = await ingestTextOrUrl(content, abortController.signal);
        const assistantContent = buildDigestAnswer(
          payload.memoryCard,
          ingestDepth,
          payload.warning,
        );
        setMessages((current) => [
          ...current,
          {
            content: assistantContent,
            id: `assistant-${payload.memoryCard.id}`,
            memoryCard: payload.memoryCard,
            role: "assistant",
          },
        ]);
        return await persistDigestTurn({
          assistantContent: buildDigestConversationAnswer(
            payload.memoryCard,
            ingestDepth,
            payload.warning,
          ),
          signal: abortController.signal,
          userContent: content,
        });
      }
      const payload = await askAgentStream(content, abortController.signal);
      setConversationId(payload.conversationId);
      return payload.conversationId;
    } catch (error) {
      if (isTimeoutError(error)) {
        const message = "回答生成超时，请检查模型配置后重试。";
        setMessages((current) => [
          ...current.filter((item) => !item.isStreaming),
          {
            content: message,
            id: `system-${Date.now()}`,
            role: "system" as const,
          },
        ]);
        setStatusNotice({ message, tone: "error" });
        return null;
      }
      if (isAbortError(error)) {
        const message = requestTimedOut
          ? "请求超时，请稍后重试或检查模型配置。"
          : "已取消当前请求。";
        setMessages((current) => {
          const nextMessages = current.filter((item) => !item.isStreaming);
          return requestTimedOut
            ? [
                ...nextMessages,
                {
                  content: message,
                  id: `system-${Date.now()}`,
                  role: "system" as const,
                },
              ]
            : nextMessages;
        });
        setStatusNotice({
          message,
          tone: requestTimedOut ? "error" : "info",
        });
        return null;
      }
      const message =
        error instanceof Error ? error.message : "请求失败，请稍后重试。";
      setMessages((current) => [
        ...current,
        {
          content: message,
          id: `system-${Date.now()}`,
          role: "system" as const,
        },
      ]);
      setStatusNotice({ message, tone: "error" });
      return null;
    } finally {
      window.clearTimeout(timeout);
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setPending(false);
    }
  }

  const isEmpty = messages.length === 0 && !pending;
  const hasStreamingAssistant = messages.some(
    (message) => message.role === "assistant" && message.isStreaming,
  );

  const inputBar = (
    <div className="w-full">
      <PromptInput
        accept="image/*"
        clearOnSubmit="submit"
        className="w-full"
        maxFiles={1}
        onError={(error) =>
          setStatusNotice({ message: error.message, tone: "error" })
        }
        onSubmit={(message) => {
          void submitPrompt(message);
        }}
      >
        <PromptAttachmentsPreview />
        <PromptInputTextarea placeholder="问问题，贴链接，粘贴文本…" />
        <PromptInputFooter>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger
                aria-label="添加图片或截图"
                tooltip="添加图片"
              />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label="图片" />
                <PromptInputActionAddScreenshot label="截图" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
          </PromptInputTools>
          <div className="flex items-center gap-2">
            <Select
              onValueChange={(v) => setIngestDepth(v as IngestDepth)}
              value={ingestDepth}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="quick">快速</SelectItem>
                  <SelectItem value="deep">深度</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <PromptInputSubmit
              aria-label={pending ? "停止生成" : "发送"}
              onStop={stopCurrentRequest}
              status={pending ? "streaming" : "ready"}
            />
          </div>
        </PromptInputFooter>
      </PromptInput>
      {statusNotice ? (
        <Alert
          className="mt-3"
          variant={statusNotice.tone === "error" ? "destructive" : "default"}
        >
          <AlertDescription>{statusNotice.message}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );

  const content = isEmpty ? (
    <section className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex h-12 shrink-0 items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">Ask memduck</h1>
          <p className="text-muted-foreground text-sm">
            搜索、保存、整理你的长期记忆
          </p>
        </div>
        <ConversationHistorySheet
          currentId={conversationId}
          onNew={startNewConversation}
          onSelect={loadConversation}
        />
      </header>
      <div className="grid flex-1 gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-2xl md:text-3xl">
              问记忆库，不再翻资料。
            </CardTitle>
            <CardDescription>
              输入问题、链接、截图或长文本。memduck
              会判断是直接回答，还是先消化成可复用的记忆卡。
            </CardDescription>
          </CardHeader>
          <CardContent>{inputBar}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>快捷开始</CardTitle>
            <CardDescription>选择一个常用问题</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[
              { label: "最近内容", suggestion: "总结一下最近保存的内容" },
              { label: "AI 记忆", suggestion: "有哪些关于 AI 的记忆？" },
              { label: "周回顾", suggestion: "帮我回顾上周学到的东西" },
            ].map(({ label, suggestion }) => (
              <Button
                className="justify-start"
                key={suggestion}
                onClick={() =>
                  void submitPrompt({ files: [], text: suggestion })
                }
                type="button"
                variant="outline"
              >
                {label}
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  ) : (
    <section className="flex flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <ConversationHistorySheet
          currentId={conversationId}
          onNew={startNewConversation}
          onSelect={loadConversation}
        />
        <div className="flex items-center gap-2">
          {conversationId ? <Badge variant="outline">对话中</Badge> : null}
        </div>
      </div>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-4 p-4">
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                <MessageParts message={message} />
              </MessageContent>
            </Message>
          ))}
          {pending && !hasStreamingAssistant ? (
            <Message from="assistant">
              <MessageContent>
                <Spinner />
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t p-4">{inputBar}</div>
    </section>
  );

  return <PromptInputProvider>{content}</PromptInputProvider>;
}
