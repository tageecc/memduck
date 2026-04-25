import Link from "next/link";
import { redirect } from "next/navigation";
import { IngestComposer } from "@/components/ingest-composer";
import { MemoryCardPreview } from "@/components/memory-card-preview";
import { SiteShell } from "@/components/site-shell";
import { buildAskHref } from "@/lib/memduck/ask-link";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function HomePage() {
  const service = await getMemduckService();
  const setupState = service.getSetupState();

  if (setupState.needsOnboarding) {
    redirect("/setup");
  }

  const cards = service.listMemoryCards();
  const topics = service.listTopics();
  const reviewCards =
    service.getCompiledReviewBuckets()?.today.slice(0, 4) ?? [];
  const activeTopics = topics
    .map((topic) => ({
      ...topic,
      cardCount: service.getTopicCards(topic.id).length,
      compiled: service
        .listCompiledTopics()
        .find((entry) => entry.topicId === topic.id),
      insights: service.getTopicInsights(topic.id),
    }))
    .sort((left, right) => right.cardCount - left.cardCount)
    .slice(0, 4);

  return (
    <SiteShell
      intro={
        <section className="hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">Memory Engine</p>
            <h2>
              Digest the outside world before it turns into forgotten clutter.
            </h2>
            <p className="brand-copy">
              memduck is built for people who save faster than they synthesize.
              The system keeps the raw source, compresses the signal, and turns
              it into cards you can revisit, ask, and deepen over time.
            </p>
            <div className="action-row">
              <Link
                className="primary-button"
                href={buildAskHref({
                  question:
                    "What is most worth revisiting across my saved memory?",
                })}
              >
                Start asking
              </Link>
              <Link className="secondary-button" href="/review">
                Open review
              </Link>
            </div>
          </div>

          <div className="hero-stats">
            <p className="eyebrow" style={{ color: "rgba(255,255,255,0.76)" }}>
              Today&apos;s Memory Surface
            </p>
            <div className="hero-stat-grid">
              <div className="stat-card">
                <strong>{cards.length}</strong>
                <span>memory cards saved</span>
              </div>
              <div className="stat-card">
                <strong>{topics.length}</strong>
                <span>active topics</span>
              </div>
              <div className="stat-card">
                <strong>{reviewCards.length}</strong>
                <span>review candidates</span>
              </div>
              <div className="stat-card">
                <strong>3</strong>
                <span>entry surfaces online</span>
              </div>
            </div>
          </div>
        </section>
      }
    >
      <IngestComposer />

      <section className="overview-grid">
        <div className="panel">
          <p className="eyebrow">Recent inputs</p>
          <strong>{cards.length}</strong>
          <p className="muted-copy">
            Fresh captures regardless of entry channel.
          </p>
        </div>
        <div className="panel">
          <p className="eyebrow">Worth revisiting</p>
          <strong>{reviewCards.length}</strong>
          <p className="muted-copy">
            Review candidates weighted by value, time gap, and interaction.
          </p>
        </div>
        <div className="panel">
          <p className="eyebrow">Growing topics</p>
          <strong>{activeTopics.length}</strong>
          <p className="muted-copy">
            Themes memduck already sees forming across your saved material.
          </p>
        </div>
      </section>

      <section className="panel-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Recently Digested</p>
              <h2>Cards you would actually reopen</h2>
            </div>
          </div>
          {cards.length > 0 ? (
            <div className="card-grid">
              {cards.slice(0, 4).map((card) => (
                <MemoryCardPreview key={card.id} card={card} topics={topics} />
              ))}
            </div>
          ) : (
            <p className="muted-copy">
              No memories yet. Finish setup, then save the first link or note to
              see memduck come alive.
            </p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Growing Topics</p>
              <h2>Where memory is getting deeper</h2>
            </div>
          </div>
          <div className="topic-list">
            {activeTopics.map((topic) => (
              <article className="topic-card" key={topic.id}>
                <strong>{topic.name}</strong>
                <span>{topic.cardCount} cards linked</span>
                <span>{topic.insights?.summary ?? "Fresh topic"}</span>
                <span>
                  {topic.compiled?.nextQuestions[0] ??
                    "No compiled next question yet"}
                </span>
                <div className="pill-row">
                  <Link className="inline-link" href={`/topics/${topic.slug}`}>
                    Open topic
                  </Link>
                  <Link
                    className="inline-link"
                    href={buildAskHref({
                      question:
                        topic.compiled?.nextQuestions[0] ??
                        `What should I understand about ${topic.name}?`,
                      topicId: topic.id,
                    })}
                  >
                    Ask this topic
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </SiteShell>
  );
}
