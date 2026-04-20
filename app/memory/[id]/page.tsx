import { notFound, redirect } from "next/navigation";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function MemoryCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getMemduckService();
  if (service.getSetupState().needsOnboarding) {
    redirect("/setup");
  }
  const card = service.getMemoryCard(id);

  if (!card) {
    notFound();
  }

  const source = service.getSourceItem(card.sourceItemId);
  const topics = service
    .listTopics()
    .filter((topic) => card.topicIds.includes(topic.id));

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Memory Card</p>
          <h2>{card.title}</h2>
          <p className="muted-copy">{card.summary}</p>
        </section>
      }
    >
      <section className="detail-grid">
        <section className="panel">
          <p className="eyebrow">Digest</p>
          <p>{card.deepSummary}</p>
          <div className="topic-list">
            {card.keyPoints.map((point) => (
              <div className="topic-card" key={point}>
                <strong>{point}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Traceability</p>
          <div className="topic-list">
            <div className="topic-card">
              <strong>Source channel</strong>
              <span>{card.sourceChannel}</span>
            </div>
            <div className="topic-card">
              <strong>Status</strong>
              <span>{card.status}</span>
            </div>
            {source?.sourceUrl ? (
              <div className="topic-card">
                <strong>Original source</strong>
                <span>{source.sourceUrl}</span>
              </div>
            ) : null}
            {source?.objectKey ? (
              <div className="topic-card">
                <strong>Stored asset</strong>
                <span>{source.objectKey}</span>
              </div>
            ) : null}
            <div className="topic-card">
              <strong>Topics</strong>
              <span>{topics.map((topic) => topic.name).join(" · ")}</span>
            </div>
          </div>
        </section>
      </section>
    </SiteShell>
  );
}
