import Link from "next/link";
import { buildAskHref } from "@/lib/memduck/ask-link";
import type { MemoryCard, Topic } from "@/lib/memduck/service";

import { MemoryAnalysisActions } from "./memory-analysis-actions";
import { MemorySignalActions } from "./memory-signal-actions";

function statusClassName(status: MemoryCard["status"]) {
  return status === "deep_ready"
    ? "status-pill status-ready"
    : "status-pill status-waiting";
}

function previewCopy(card: MemoryCard) {
  if (card.status === "saved") {
    return "Saved to inbox. Run quick or deep analysis to turn this source into reusable memory.";
  }

  if (card.status === "quick_ready" && !card.topicIds.length) {
    return `${card.summary} Deep analysis will add topic links and richer compilation.`;
  }

  return card.summary;
}

export function MemoryCardPreview({
  card,
  topics,
}: {
  card: MemoryCard;
  topics: Topic[];
}) {
  const linkedTopics = topics.filter((topic) =>
    card.topicIds.includes(topic.id),
  );

  return (
    <article className="memory-card">
      <div className="memory-card-header">
        <p className="eyebrow">{card.sourceChannel}</p>
        <span className={statusClassName(card.status)}>{card.status}</span>
      </div>
      <h3>{card.title}</h3>
      <p>{previewCopy(card)}</p>
      <div className="pill-row">
        {linkedTopics.map((topic) => (
          <Link
            className="topic-pill"
            href={`/topics/${topic.slug}`}
            key={topic.id}
          >
            {topic.name}
          </Link>
        ))}
      </div>
      <MemorySignalActions
        cardId={card.id}
        compact
        topicId={card.topicIds[0]}
      />
      <MemoryAnalysisActions cardId={card.id} status={card.status} />
      <div className="pill-row">
        <Link className="inline-link" href={`/memory/${card.id}`}>
          Open card
        </Link>
        {card.status !== "saved" ? (
          <Link
            className="inline-link"
            href={buildAskHref({
              cardId: card.id,
              question: `What should I remember from "${card.title}"?`,
            })}
          >
            Ask from card
          </Link>
        ) : null}
      </div>
    </article>
  );
}
