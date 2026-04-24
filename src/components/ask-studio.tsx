"use client";

import Link from "next/link";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import type {
  Citation,
  ConversationMessage,
  ConversationSummary,
  MemoryCard,
  Topic,
} from "@/lib/memduck/service";

type TranscriptMessage = {
  citations?: Citation[];
  content: string;
  id: string;
  role: "assistant" | "user";
};

const DEFAULT_QUESTION = "What have I saved about memory and retrieval?";

function buildQuestionSuggestions(input: {
  cards: MemoryCard[];
  topic: Topic | undefined;
}): string[] {
  if (input.cards.length > 1) {
    return [
      "What is most worth revisiting in this scoped set?",
      "Which patterns repeat across these selected memory cards?",
      "What should I read first if I only have five minutes?",
    ];
  }

  if (input.cards[0]) {
    return [
      `What should I remember from "${input.cards[0].title}"?`,
      `What evidence inside "${input.cards[0].title}" matters most?`,
      `What is easiest to miss if I only skim "${input.cards[0].title}"?`,
    ];
  }

  if (input.topic) {
    return [
      `What are the strongest recurring ideas in ${input.topic.name}?`,
      `Where do my saved sources disagree on ${input.topic.name}?`,
      `What should I dig deeper on next inside ${input.topic.name}?`,
    ];
  }

  return [
    DEFAULT_QUESTION,
    "What patterns keep repeating across my recent saves?",
    "Which saved ideas are worth reviewing again this week?",
  ];
}

export function AskStudio({
  cards,
  initialCardIds,
  initialQuestion,
  initialTopicId,
  topics,
}: {
  cards: MemoryCard[];
  initialCardIds?: string[];
  initialQuestion?: string;
  initialTopicId?: string;
  topics: Topic[];
}) {
  const [question, setQuestion] = useState(initialQuestion ?? DEFAULT_QUESTION);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedCardIds, setSelectedCardIds] = useState(initialCardIds ?? []);
  const [selectedTopic, setSelectedTopic] = useState(initialTopicId ?? "");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    "web",
    "extension",
    "telegram",
  ]);
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const deferredQuestion = useDeferredValue(question);

  const suggestedTopics = useMemo(() => {
    const needle = deferredQuestion.toLowerCase();
    if (!needle) return topics.slice(0, 4);
    return topics
      .filter(
        (topic) =>
          topic.name.toLowerCase().includes(needle) ||
          topic.keywords.some((keyword) => keyword.includes(needle)),
      )
      .slice(0, 4);
  }, [deferredQuestion, topics]);
  const selectedCards = useMemo(
    () =>
      cards.filter((card) =>
        selectedCardIds.some((selectedCardId) => selectedCardId === card.id),
      ),
    [cards, selectedCardIds],
  );
  const selectedCardEntry = useMemo(
    () => (selectedCards.length === 1 ? selectedCards[0] : undefined),
    [selectedCards],
  );
  const selectedTopicEntry = useMemo(
    () => topics.find((topic) => topic.id === selectedTopic),
    [selectedTopic, topics],
  );
  const questionSuggestions = useMemo(
    () =>
      buildQuestionSuggestions({
        cards: selectedCards,
        topic: selectedTopicEntry,
      }),
    [selectedCards, selectedTopicEntry],
  );

  const refreshConversations = useEffectEvent(async () => {
    const response = await fetch("/api/conversations");
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      conversations: ConversationSummary[];
    };

    setConversations(payload.conversations);
  });

  async function loadConversation(targetConversationId: string) {
    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void fetch(`/api/conversations/${targetConversationId}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Unable to load that conversation.");
          }

          return response.json() as Promise<{
            messages: ConversationMessage[];
          }>;
        })
        .then((payload) => {
          setConversationId(targetConversationId);
          setTranscript(
            payload.messages.map((message) => ({
              citations: message.citations,
              content: message.content,
              id: message.id,
              role: message.role,
            })),
          );
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => setPending(false));
    });
  }

  useEffect(() => {
    void refreshConversations();
  }, []);

  useEffect(() => {
    setQuestion(initialQuestion ?? DEFAULT_QUESTION);
  }, [initialQuestion]);

  useEffect(() => {
    setSelectedTopic(initialTopicId ?? "");
  }, [initialTopicId]);

  useEffect(() => {
    setSelectedCardIds(initialCardIds ?? []);
  }, [initialCardIds]);

  function toggleChannel(channel: string) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  async function submit() {
    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void fetch("/api/ask", {
        body: JSON.stringify({
          filters: {
            dateFrom: dateFrom
              ? new Date(`${dateFrom}T00:00:00`).toISOString()
              : undefined,
            dateTo: dateTo
              ? new Date(`${dateTo}T23:59:59`).toISOString()
              : undefined,
            cardIds: selectedCardIds.length > 0 ? selectedCardIds : undefined,
            sourceChannels: selectedChannels,
            topicIds: selectedTopic ? [selectedTopic] : undefined,
          },
          conversationId: conversationId ?? undefined,
          question,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Unable to answer this question right now.");
          }
          return response.json() as Promise<{
            answer: string;
            citations: Citation[];
            conversationId: string;
          }>;
        })
        .then(async (payload) => {
          const timestamp = Date.now();
          setConversationId(payload.conversationId);
          setTranscript((current) => [
            ...current,
            {
              content: question,
              id: `user-${payload.conversationId}-${timestamp}`,
              role: "user",
            },
            {
              citations: payload.citations,
              content: payload.answer,
              id: `assistant-${payload.conversationId}-${timestamp}`,
              role: "assistant",
            },
          ]);
          setQuestion("");
          await refreshConversations();
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => setPending(false));
    });
  }

  return (
    <div className="ask-layout">
      <section className="panel panel-emphasis">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Personal QA</p>
            <h2>Ask like you are talking to your own research memory</h2>
          </div>
          <p className="panel-copy">
            Answers stay grounded in your saved cards, support follow-ups, and
            keep the thread around for later.
          </p>
        </div>

        <label className="field">
          <span>Question</span>
          <textarea
            onChange={(event) => setQuestion(event.target.value)}
            rows={5}
            value={question}
          />
        </label>

        <label className="field">
          <span>Limit to topic</span>
          <select
            onChange={(event) => setSelectedTopic(event.target.value)}
            value={selectedTopic}
          >
            <option value="">All topics</option>
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Limit to memory card</span>
          <select
            onChange={(event) =>
              setSelectedCardIds(event.target.value ? [event.target.value] : [])
            }
            value={selectedCardEntry?.id ?? ""}
          >
            <option value="">All memory cards</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.title}
              </option>
            ))}
          </select>
        </label>

        <div className="detail-grid">
          <label className="field">
            <span>From date</span>
            <input
              onChange={(event) => setDateFrom(event.target.value)}
              type="date"
              value={dateFrom}
            />
          </label>
          <label className="field">
            <span>To date</span>
            <input
              onChange={(event) => setDateTo(event.target.value)}
              type="date"
              value={dateTo}
            />
          </label>
        </div>

        <div className="choice-row">
          {["web", "extension", "telegram"].map((channel) => (
            <button
              key={channel}
              className={
                selectedChannels.includes(channel) ? "chip chip-active" : "chip"
              }
              onClick={() => toggleChannel(channel)}
              type="button"
            >
              {channel}
            </button>
          ))}
        </div>

        <div className="action-row">
          <button
            className="primary-button"
            disabled={pending || !question.trim()}
            onClick={submit}
            type="button"
          >
            {pending ? "Thinking..." : "Ask memduck"}
          </button>
        </div>
        {statusMessage ? (
          <p className="action-result">{statusMessage}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Active context</p>
            <h2>Ask wide or narrow it down on purpose</h2>
          </div>
        </div>
        {selectedTopicEntry || selectedCardEntry ? (
          <div className="topic-list">
            {selectedTopicEntry ? (
              <div className="topic-card">
                <strong>Topic focus</strong>
                <span>{selectedTopicEntry.name}</span>
                <button
                  className="secondary-button"
                  onClick={() => setSelectedTopic("")}
                  type="button"
                >
                  Clear topic
                </button>
              </div>
            ) : null}
            {selectedCards.length > 1 ? (
              <div className="topic-card">
                <strong>Scoped memory set</strong>
                <span>
                  {selectedCards.length} cards ·{" "}
                  {selectedCards
                    .slice(0, 3)
                    .map((card) => card.title)
                    .join(" · ")}
                </span>
                <button
                  className="secondary-button"
                  onClick={() => setSelectedCardIds([])}
                  type="button"
                >
                  Clear set
                </button>
              </div>
            ) : null}
            {selectedCardEntry ? (
              <div className="topic-card">
                <strong>Card focus</strong>
                <span>{selectedCardEntry.title}</span>
                <button
                  className="secondary-button"
                  onClick={() => setSelectedCardIds([])}
                  type="button"
                >
                  Clear card
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted-copy">
            Ask across the whole memory graph, or narrow retrieval to one topic
            or one memory card when you want a stricter answer.
          </p>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Prompt starters</p>
        <div className="topic-list">
          {questionSuggestions.map((prompt) => (
            <button
              className="topic-card"
              key={prompt}
              onClick={() => setQuestion(prompt)}
              type="button"
            >
              <strong>Use this question</strong>
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Suggested topics</p>
        <div className="topic-list">
          {suggestedTopics.map((topic) => (
            <button
              className="topic-card"
              key={topic.id}
              onClick={() => setSelectedTopic(topic.id)}
              type="button"
            >
              <strong>{topic.name}</strong>
              <span>{topic.keywords.slice(0, 3).join(" · ")}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Saved threads</p>
            <h2>Continue where you left off</h2>
          </div>
        </div>
        {conversations.length > 0 ? (
          <div className="topic-list">
            {conversations.map((conversation) => (
              <button
                className="topic-card"
                key={conversation.id}
                onClick={() => loadConversation(conversation.id)}
                type="button"
              >
                <strong>
                  {conversation.id === conversationId
                    ? "Current thread"
                    : "Saved thread"}
                </strong>
                <span>
                  {conversation.lastMessagePreview || "No preview yet"}
                </span>
                <span>{conversation.messageCount} messages</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted-copy">
            No persisted threads yet. Ask one grounded question and the thread
            will be reusable here.
          </p>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Transcript</p>
        {transcript.length > 0 ? (
          <div className="answer-stack">
            {transcript.map((message) => (
              <div className="citation-list" key={message.id}>
                <div className="citation-card">
                  <strong>{message.role === "user" ? "You" : "memduck"}</strong>
                  <span>{message.content}</span>
                </div>
                {message.citations?.map((citation) => (
                  <div
                    className="citation-card"
                    key={`${message.id}-${citation.cardId}-${citation.quote}`}
                  >
                    <strong>{citation.title}</strong>
                    <span>{citation.quote}</span>
                    <Link
                      className="inline-link"
                      href={`/memory/${citation.cardId}#chunk-${citation.chunkId}`}
                    >
                      Open cited chunk
                    </Link>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-copy">
            No answer yet. Ask a question and memduck will synthesize your saved
            material into a reusable thread.
          </p>
        )}
      </section>
    </div>
  );
}
