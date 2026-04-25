import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MemoryCardPreview } from "@/components/memory-card-preview";
import { SiteShell } from "@/components/site-shell";
import {
  TopicManagementActions,
  TopicUnlinkAction,
} from "@/components/topic-management-actions";
import { buildAskHref } from "@/lib/memduck/ask-link";
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
  const linkReasons = cards
    .map((card) => ({
      card,
      topicLink: service
        .listTopicLinksForCard(card.id)
        .find((topicLink) => topicLink.topicId === topic.id),
    }))
    .filter((entry) => Boolean(entry.topicLink));

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
      <section className="overview-grid">
        <div className="panel">
          <p className="eyebrow">Linked Cards</p>
          <strong>{cards.length}</strong>
          <p className="muted-copy">
            Cards that currently compile into this topic view.
          </p>
        </div>
        <div className="panel">
          <p className="eyebrow">Repeated Points</p>
          <strong>{insights?.repeatedPoints.length ?? 0}</strong>
          <p className="muted-copy">
            Ideas memduck sees resurfacing across this topic.
          </p>
        </div>
        <div className="panel">
          <p className="eyebrow">Conflict Points</p>
          <strong>{insights?.conflictPoints.length ?? 0}</strong>
          <p className="muted-copy">
            Tensions or disagreements detected inside the topic.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Manage Topic</p>
            <h2>Keep this theme tidy as your memory grows</h2>
          </div>
        </div>
        <TopicManagementActions topic={topic} topics={topics} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Continue In Ask</p>
            <h2>Turn this topic into a focused research thread</h2>
          </div>
          <p className="panel-copy">
            Open Ask with the topic filter already applied so follow-up
            questions stay grounded in this theme.
          </p>
        </div>
        <div className="topic-list">
          <Link
            className="topic-card"
            href={buildAskHref({
              question: `What are the strongest recurring ideas in ${topic.name}?`,
              topicId: topic.id,
            })}
          >
            <strong>Ask this topic now</strong>
            <span>Open a focused thread grounded in this topic only.</span>
          </Link>
          {(compiledTopic?.nextQuestions ?? []).map((question) => (
            <Link
              className="topic-card"
              href={buildAskHref({ question, topicId: topic.id })}
              key={question}
            >
              <strong>Compiled next question</strong>
              <span>{question}</span>
            </Link>
          ))}
        </div>
      </section>

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
        {linkReasons.length > 0 ? (
          <div className="topic-list" style={{ marginBottom: "1rem" }}>
            {linkReasons.map(({ card, topicLink }) =>
              topicLink ? (
                <div className="topic-card" key={card.id}>
                  <strong>{card.title}</strong>
                  <span>
                    {Math.round(topicLink.confidence * 100)}% confidence ·{" "}
                    {topicLink.reason}
                  </span>
                  <TopicUnlinkAction cardId={card.id} topicId={topic.id} />
                </div>
              ) : null,
            )}
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
