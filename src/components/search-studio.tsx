"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { buildAskHref } from "@/lib/memduck/ask-link";
import type { RetrievalItem, Topic } from "@/lib/memduck/service";

const DEFAULT_QUERY = "retrieval practice";

export function SearchStudio({ topics }: { topics: Topic[] }) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([
    "web",
    "extension",
    "telegram",
  ]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [results, setResults] = useState<RetrievalItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const suggestedTopics = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();

    if (!needle) {
      return topics.slice(0, 6);
    }

    return topics
      .filter(
        (topic) =>
          topic.name.toLowerCase().includes(needle) ||
          topic.keywords.some((keyword) =>
            keyword.toLowerCase().includes(needle),
          ),
      )
      .slice(0, 6);
  }, [deferredQuery, topics]);

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
      void fetch("/api/search", {
        body: JSON.stringify({
          filters: {
            dateFrom: dateFrom
              ? new Date(`${dateFrom}T00:00:00`).toISOString()
              : undefined,
            dateTo: dateTo
              ? new Date(`${dateTo}T23:59:59`).toISOString()
              : undefined,
            sourceChannels: selectedChannels,
            topicIds: selectedTopic ? [selectedTopic] : undefined,
          },
          limit: 6,
          query,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Unable to search your memory right now.");
          }

          return response.json() as Promise<{
            items: RetrievalItem[];
            strategy: string;
          }>;
        })
        .then((payload) => {
          setHasSearched(true);
          setResults(payload.items);
          setStatusMessage(
            payload.items.length > 0
              ? `Retrieved ${payload.items.length} matches via ${payload.strategy}.`
              : "No matching memory cards were found.",
          );
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  return (
    <div className="ask-layout">
      <section className="panel panel-emphasis">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Search</p>
            <h2>Find the strongest saved memory before you start asking</h2>
          </div>
          <p className="panel-copy">
            Search uses the same embedding and rerank pipeline as Ask, but keeps
            the result set visible so you can inspect, open, and scope from it.
          </p>
        </div>

        <label className="field">
          <span>Query</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            value={query}
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
            disabled={pending || !query.trim()}
            onClick={submit}
            type="button"
          >
            {pending ? "Searching..." : "Search memory"}
          </button>
        </div>
        {statusMessage ? (
          <p className="action-result">{statusMessage}</p>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Suggested topics</p>
            <h2>Narrow the search when you already know the theme</h2>
          </div>
        </div>
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
            <p className="eyebrow">Results</p>
            <h2>Inspect the retrieval set before opening Ask</h2>
          </div>
        </div>

        {results.length > 0 ? (
          <div className="topic-list">
            {results.map((result) => (
              <article className="topic-card" key={result.card.id}>
                <strong>{result.card.title}</strong>
                <span>{result.card.summary}</span>
                <span>
                  rerank {result.rerankScore.toFixed(2)} · semantic{" "}
                  {result.semanticScore.toFixed(2)}
                </span>
                <div className="pill-row">
                  <Link
                    className="inline-link"
                    href={`/memory/${result.card.id}`}
                  >
                    Open card
                  </Link>
                  <Link
                    className="inline-link"
                    href={buildAskHref({
                      cardId: result.card.id,
                      question: `What matters most in "${result.card.title}"?`,
                    })}
                  >
                    Ask from result
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : hasSearched ? (
          <p className="muted-copy">
            No cards matched this search. Try widening the channel or topic
            filters, or search for a more literal phrase from the source text.
          </p>
        ) : (
          <p className="muted-copy">
            Search a term, idea, or phrase and memduck will surface the
            strongest saved matches here.
          </p>
        )}
      </section>
    </div>
  );
}
