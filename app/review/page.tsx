import { MemoryCardPreview } from "@/components/memory-card-preview";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function ReviewPage() {
  const service = await getMemduckService();
  const cards = service.listReviewCards();
  const topics = service.listTopics();

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Review</p>
          <h2>
            Pull the memories most likely to sharpen your thinking right now.
          </h2>
          <p className="muted-copy">
            The ranking mixes value, revisit gap, repeated themes, and recent
            signals so review feels useful instead of random.
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
