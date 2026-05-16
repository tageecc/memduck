"use client";

import type { FileUIPart } from "ai";
import { HistoryIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import {
  startTransition,
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
} from "react";

import { Attachment, Attachments } from "@/components/ai-elements/attachments";
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
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
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
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type {
  Citation,
  ConversationSummary,
  ConversationThread,
  MemoryCard,
} from "@/lib/memduck/service";

type IngestDepth = "deep" | "quick";

type AgentMessage = {
  attachments?: Array<FileUIPart & { id: string }>;
  citations?: Citation[];
  content: string;
  id: string;
  memoryCard?: MemoryCard;
  role: "assistant" | "system" | "user";
};

function extractFirstUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s<>"']+/u);
  if (!match) return null;
  return new URL(match[0]).toString();
}

function shouldDigestText(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length > 280 ||
    /^(保存|记住|解析|总结|消化)/u.test(trimmed) ||
    /^(digest|save|remember|summarize)\b/i.test(trimmed)
  );
}

function stripUrl(value: string, url: string) {
  return value.replace(url, "").trim();
}

function buildDigestAnswer(card: MemoryCard, depth: IngestDepth) {
  const points =
    card.keyPoints.length > 0
      ? `\n\n${card.keyPoints.map((point) => `- ${point}`).join("\n")}`
      : "";
  const depthLabel = depth === "deep" ? "（深度消化）" : "";
  return `已保存为记忆${depthLabel}：${card.title}\n\n${card.summary}${points}`;
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

function threadToMessages(thread: ConversationThread): AgentMessage[] {
  return thread.messages.map((msg) => ({
    citations: msg.citations ?? [],
    content: msg.content,
    id: msg.id,
    role: msg.role,
  }));
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
          />
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
            href={`/memory/${citation.cardId}#chunk-${citation.chunkId}`}
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

  useEffect(() => {
    if (!open) return;
    void fetch("/api/conversations")
      .then(
        (r) => r.json() as Promise<{ conversations: ConversationSummary[] }>,
      )
      .then((data) => setConversations(data.conversations));
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
          {conversations.map((conv) => (
            <Button
              className="h-auto justify-start"
              key={conv.id}
              onClick={() => {
                onSelect(conv.id);
                setOpen(false);
              }}
              type="button"
              variant={conv.id === currentId ? "secondary" : "ghost"}
            >
              <span className="flex flex-col items-start gap-1 text-left">
                <span className="line-clamp-2">
                  {conv.lastMessagePreview || "空对话"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(conv.updatedAt).toLocaleString()} ·{" "}
                  {conv.messageCount} 条消息
                </span>
              </span>
            </Button>
          ))}
          {conversations.length === 0 ? (
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
  initialQuestion,
  initialTopicId,
}: {
  initialCardIds?: string[];
  initialQuestion?: string;
  initialTopicId?: string;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState(initialCardIds ?? []);
  const [selectedTopic, setSelectedTopic] = useState(initialTopicId ?? "");
  const [ingestDepth, setIngestDepth] = useState<IngestDepth>("quick");

  const submitInitialQuestion = useEffectEvent(async (question: string) => {
    await submitPrompt({ files: [], text: question });
  });

  const loadConversation = useCallback((id: string) => {
    void fetch(`/api/conversations/${id}`)
      .then((r) => r.json() as Promise<ConversationThread>)
      .then((thread) => {
        setConversationId(id);
        setMessages(threadToMessages(thread));
      });
  }, []);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setStatusMessage(null);
  }, []);

  useEffect(() => {
    setSelectedTopic(initialTopicId ?? "");
  }, [initialTopicId]);

  useEffect(() => {
    setSelectedCardIds(initialCardIds ?? []);
  }, [initialCardIds]);

  useEffect(() => {
    if (initialQuestion?.trim()) {
      void submitInitialQuestion(initialQuestion);
    }
  }, [initialQuestion]);

  async function ingestImage(content: string, file: File) {
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
    });
    if (!response.ok) throw new Error("图片消化失败。");
    return response.json() as Promise<{ memoryCard: MemoryCard }>;
  }

  async function ingestTextOrUrl(content: string) {
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
    });
    if (!response.ok) throw new Error("内容消化失败。");
    return response.json() as Promise<{ memoryCard: MemoryCard }>;
  }

  async function askAgentStream(content: string): Promise<{
    answer: string;
    citations: Citation[];
    conversationId: string;
  }> {
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
    });
    if (!response.ok) throw new Error("Agent 暂时无法回答。");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("Stream unavailable.");

    const decoder = new TextDecoder();
    let buffer = "";
    let streamingId: string | null = null;
    let citations: Citation[] = [];
    let streamConvId = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data) continue;

        const chunk = JSON.parse(data) as {
          citations?: Citation[];
          conversationId?: string;
          done?: boolean;
          token?: string;
        };

        if (chunk.citations) citations = chunk.citations;
        if (chunk.conversationId) streamConvId = chunk.conversationId;

        if (chunk.token) {
          fullText += chunk.token;
          const msgId: string = streamingId ?? `assistant-stream-${Date.now()}`;
          if (!streamingId) {
            streamingId = msgId;
            setMessages((current) => [
              ...current,
              {
                citations,
                content: chunk.token ?? "",
                id: msgId,
                role: "assistant" as const,
              },
            ]);
          } else {
            setMessages((current) =>
              current.map((m) =>
                m.id === msgId ? { ...m, content: fullText, citations } : m,
              ),
            );
          }
        }
      }
    }

    return { answer: fullText, citations, conversationId: streamConvId };
  }

  async function submitPrompt(message: PromptInputMessage) {
    const content = message.text.trim();
    const image = message.files.find((file) =>
      file.mediaType?.startsWith("image/"),
    );
    if (!content && !image) return;

    const userMessage: AgentMessage = {
      attachments: image ? [{ ...image, id: `file-${Date.now()}` }] : undefined,
      content,
      id: `user-${Date.now()}`,
      role: "user",
    };
    setMessages((current) => [...current, userMessage]);
    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void (async () => {
        const url = extractFirstUrl(content);
        if (image) {
          const payload = await ingestImage(
            content,
            await filePartToFile(image),
          );
          setMessages((current) => [
            ...current,
            {
              content: buildDigestAnswer(payload.memoryCard, ingestDepth),
              id: `assistant-${payload.memoryCard.id}`,
              memoryCard: payload.memoryCard,
              role: "assistant",
            },
          ]);
          return;
        }
        if (url || shouldDigestText(content)) {
          const payload = await ingestTextOrUrl(content);
          setMessages((current) => [
            ...current,
            {
              content: buildDigestAnswer(payload.memoryCard, ingestDepth),
              id: `assistant-${payload.memoryCard.id}`,
              memoryCard: payload.memoryCard,
              role: "assistant",
            },
          ]);
          return;
        }
        const payload = await askAgentStream(content);
        setConversationId(payload.conversationId);
      })()
        .catch((error: Error) => {
          setMessages((current) => [
            ...current,
            {
              content: error.message,
              id: `system-${Date.now()}`,
              role: "system" as const,
            },
          ]);
          setStatusMessage(error.message);
        })
        .finally(() => setPending(false));
    });
  }

  const isEmpty = messages.length === 0 && !pending;

  const inputBar = (
    <div className="w-full">
      <Card>
        <PromptInput
          accept="image/*"
          className="w-full border-0"
          maxFiles={1}
          onError={(error) => setStatusMessage(error.message)}
          onSubmit={submitPrompt}
        >
          <PromptAttachmentsPreview />
          <PromptInputTextarea placeholder="问问题，贴链接，粘贴文本…" />
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger tooltip="添加图片" />
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
                disabled={pending}
                status={pending ? "submitted" : "ready"}
              />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </Card>
      {statusMessage ? (
        <Alert className="mt-3" variant="destructive">
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );

  if (isEmpty) {
    return (
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
    );
  }

  return (
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
              <MessageContent
                className={
                  message.role === "user"
                    ? "bg-primary text-primary-foreground group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                    : message.role === "system"
                      ? "border border-destructive text-destructive"
                      : "border bg-card"
                }
              >
                {message.attachments?.length ? (
                  <Attachments variant="grid">
                    {message.attachments.map((attachment) => (
                      <Attachment data={attachment} key={attachment.id} />
                    ))}
                  </Attachments>
                ) : null}
                {message.content ? (
                  <MessageResponse>{message.content}</MessageResponse>
                ) : null}
                {message.memoryCard ? (
                  <MemoryResult card={message.memoryCard} />
                ) : null}
                {message.citations ? (
                  <MessageCitations
                    citations={message.citations}
                    messageId={message.id}
                  />
                ) : null}
              </MessageContent>
            </Message>
          ))}
          {pending ? (
            <Message from="assistant">
              <MessageContent className="border bg-card">
                <span className="inline-flex items-center gap-1" role="status">
                  {[0, 1, 2].map((i) => (
                    <span
                      className="inline-block size-1.5 animate-bounce rounded-full bg-muted-foreground/50"
                      key={i}
                    />
                  ))}
                </span>
              </MessageContent>
            </Message>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t p-4">{inputBar}</div>
    </section>
  );
}
