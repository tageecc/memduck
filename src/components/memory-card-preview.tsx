import Link from "next/link";
import type { MemoryCard, Topic } from "@/lib/memduck/service";

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
        <span
          className={
            card.status === "ready"
              ? "status-pill status-ready"
              : "status-pill status-degraded"
          }
        >
          {card.status}
        </span>
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
      <Link className="inline-link" href={`/memory/${card.id}`}>
        Open card
      </Link>
    </article>
  );
}
