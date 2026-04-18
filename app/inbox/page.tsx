import { MemoryCardPreview } from "@/components/memory-card-preview";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function InboxPage() {
  const service = await getMemduckService();
  const cards = service.listMemoryCards();
  const topics = service.listTopics();

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Inbox</p>
          <h2>Everything new lands here before it becomes durable memory.</h2>
          <p className="muted-copy">
            New inputs retain their source, status, and topic hints. This is
            where quick saving turns into real digestion.
          </p>
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
