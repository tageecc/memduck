import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { buildAskHref } from "@/lib/memduck/ask-link";
import { getMemduckService } from "@/lib/memduck/runtime";

export default async function TopicsPage() {
  const service = await getMemduckService();
  if (service.getSetupState().needsOnboarding) {
    redirect("/setup");
  }

  await service.ensureKnowledgeCompiled();

  const topics = service.listTopics().map((topic) => ({
    ...topic,
    cards: service.getTopicCards(topic.id),
    compiled: service
      .listCompiledTopics()
      .find((entry) => entry.topicId === topic.id),
    insights: service.getTopicInsights(topic.id),
  }));

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Topics</p>
          <h2>See what memduck thinks is becoming a lasting theme.</h2>
          <p className="muted-copy">
            Topics are where repeated cards, conflicting viewpoints, and future
            questions start to feel like a real memory layer.
          </p>
        </section>
      }
    >
      <section className="panel">
        {topics.length > 0 ? (
          <div className="topic-list">
            {topics.map((topic) => (
              <article className="topic-card" key={topic.id}>
                <strong>{topic.name}</strong>
                <span>{topic.cards.length} linked cards</span>
                <span>{topic.insights?.summary ?? "Fresh topic"}</span>
                <span>
                  {topic.insights
                    ? `${topic.insights.repeatedPoints.length} repeated · ${topic.insights.conflictPoints.length} conflict`
                    : "Fresh topic"}
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
        ) : (
          <p className="muted-copy">
            No topics yet. Save a few real inputs and memduck will start to
            surface the strongest themes here.
          </p>
        )}
      </section>
    </SiteShell>
  );
}
