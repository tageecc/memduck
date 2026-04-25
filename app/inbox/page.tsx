import { redirect } from "next/navigation";
import { MemoryCardPreview } from "@/components/memory-card-preview";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function InboxPage() {
  const service = await getMemduckService();
  if (service.getSetupState().needsOnboarding) {
    redirect("/setup");
  }
  const cards = service.listMemoryCards();
  const topics = service.listTopics();
  const sections = [
    {
      description:
        "Raw captures that are stored but not digested yet. This is the real save-first queue.",
      key: "saved" as const,
      title: "Saved First",
    },
    {
      description:
        "Cards with a first digest and retrieval grounding, ready to be upgraded into deeper topic memory.",
      key: "quick_ready" as const,
      title: "Quick Ready",
    },
    {
      description:
        "Cards that already carry topic links and can fully participate in compiled memory views.",
      key: "deep_ready" as const,
      title: "Deep Ready",
    },
  ];

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
      {sections.map((section) => {
        const sectionCards = cards.filter(
          (card) => card.status === section.key,
        );

        return (
          <section className="panel" key={section.key}>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Inbox Stage</p>
                <h2>{section.title}</h2>
              </div>
              <p className="panel-copy">
                {sectionCards.length} cards · {section.description}
              </p>
            </div>
            {sectionCards.length > 0 ? (
              <div className="card-grid">
                {sectionCards.map((card) => (
                  <MemoryCardPreview
                    key={card.id}
                    card={card}
                    topics={topics}
                  />
                ))}
              </div>
            ) : (
              <p className="muted-copy">Nothing is in this stage right now.</p>
            )}
          </section>
        );
      })}
    </SiteShell>
  );
}
