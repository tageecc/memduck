import { redirect } from "next/navigation";
import { MemoryCardPreview } from "@/components/memory-card-preview";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function ReviewPage() {
  const service = await getMemduckService();
  if (service.getSetupState().needsOnboarding) {
    redirect("/setup");
  }

  await service.ensureKnowledgeCompiled();
  const sections = service.getReviewSections();
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
      <section className="panel-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Today</p>
              <h2>Best cards to revisit now</h2>
            </div>
          </div>
          <div className="card-grid">
            {sections.today.map((card) => (
              <MemoryCardPreview key={card.id} card={card} topics={topics} />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">High Value</p>
              <h2>Worth keeping fresh</h2>
            </div>
          </div>
          <div className="card-grid">
            {sections.staleHighValue.map((card) => (
              <MemoryCardPreview key={card.id} card={card} topics={topics} />
            ))}
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Theme Momentum</p>
            <h2>Topics that are currently growing</h2>
          </div>
        </div>
        <div className="card-grid">
          {sections.themeMomentum.map((card) => (
            <MemoryCardPreview key={card.id} card={card} topics={topics} />
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
