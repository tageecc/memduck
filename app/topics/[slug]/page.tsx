import { notFound } from "next/navigation";
import { MemoryCardPreview } from "@/components/memory-card-preview";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await getMemduckService();
  const topic = service.getTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  const cards = service.getTopicCards(topic.id);
  const topics = service.listTopics();

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Topic</p>
          <h2>{topic.name}</h2>
          <p className="muted-copy">
            memduck groups related cards here so repeated views, new saves, and
            follow-up questions can make the topic feel more alive over time.
          </p>
          <div className="pill-row">
            {topic.keywords.map((keyword) => (
              <span className="topic-pill" key={keyword}>
                {keyword}
              </span>
            ))}
          </div>
        </section>
      }
    >
      <section className="panel">
        <div className="card-grid">
          {cards.map((card) => (
            <MemoryCardPreview key={card.id} card={card} topics={topics} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
