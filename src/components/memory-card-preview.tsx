import Link from "next/link";
import { buildAskHref } from "@/lib/memduck/ask-link";
import type { MemoryCard, Topic } from "@/lib/memduck/service";

import { MemorySignalActions } from "./memory-signal-actions";

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
        <span className="status-pill status-ready">{card.status}</span>
      </div>
      <h3>{card.title}</h3>
      <p>{card.summary}</p>
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
      <div className="pill-row">
        <Link className="inline-link" href={`/memory/${card.id}`}>
          Open card
        </Link>
        <Link
          className="inline-link"
          href={buildAskHref({
            cardId: card.id,
            question: `What should I remember from "${card.title}"?`,
          })}
        >
          Ask from card
        </Link>
      </div>
    </article>
  );
}
