import { notFound, redirect } from "next/navigation";
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
  if (service.getSetupState().needsOnboarding) {
    redirect("/setup");
  }
  const topic = service.getTopicBySlug(slug);

  if (!topic) {
    notFound();
  }

  const cards = service.getTopicCards(topic.id);
  const compiledTopic = service
    .listCompiledTopics()
    .find((entry) => entry.topicId === topic.id);
  const insights = service.getTopicInsights(topic.id);
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
        {insights ? (
          <div className="detail-grid" style={{ marginBottom: "1rem" }}>
            <div className="topic-list">
              <div className="topic-card">
                <strong>Topic summary</strong>
                <span>{insights.summary}</span>
              </div>
              <div className="topic-card">
                <strong>Repeated points</strong>
                <span>
                  {insights.repeatedPoints.length > 0
                    ? insights.repeatedPoints.join(" · ")
                    : "No repeated points yet"}
                </span>
              </div>
            </div>
            <div className="topic-list">
              <div className="topic-card">
                <strong>Conflict points</strong>
                <span>
                  {insights.conflictPoints.length > 0
                    ? insights.conflictPoints.join(" · ")
                    : "No conflicts detected yet"}
                </span>
              </div>
              <div className="topic-card">
                <strong>Next questions</strong>
                <span>
                  {compiledTopic?.nextQuestions.length
                    ? compiledTopic.nextQuestions.join(" · ")
                    : "No compiled next questions yet"}
                </span>
              </div>
            </div>
          </div>
        ) : null}
        <div className="card-grid">
          {cards.map((card) => (
            <MemoryCardPreview key={card.id} card={card} topics={topics} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
