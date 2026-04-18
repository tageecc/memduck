"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import type { Topic } from "@/lib/memduck/service";

export function AskStudio({ topics }: { topics: Topic[] }) {
  const [question, setQuestion] = useState(
    "What have I saved about memory and retrieval?",
  );
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    "web",
    "extension",
    "telegram",
  ]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    answer: string;
    citations: Array<{ cardId: string; title: string }>;
  } | null>(null);
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

  function toggleChannel(channel: string) {
    setSelectedChannels((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  }

  async function submit() {
    setPending(true);

    startTransition(() => {
      void fetch("/api/ask", {
        body: JSON.stringify({
          filters: {
            sourceChannels: selectedChannels,
            topicIds: selectedTopic ? [selectedTopic] : undefined,
          },
          question,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Unable to answer this question right now.");
          }
          return response.json();
        })
        .then((payload) => setResult(payload))
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
            Answers stay grounded in your saved cards and come back with
            citations.
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
        <p className="eyebrow">Answer</p>
        {result ? (
          <div className="answer-stack">
            <p>{result.answer}</p>
            <div className="citation-list">
              {result.citations.map((citation) => (
                <div className="citation-card" key={citation.cardId}>
                  <strong>{citation.title}</strong>
                  <span>{citation.cardId}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted-copy">
            No answer yet. Ask a question and memduck will synthesize your saved
            material.
          </p>
        )}
      </section>
    </div>
  );
}
