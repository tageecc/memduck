import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MemoryAnalysisActions } from "@/components/memory-analysis-actions";
import { MemorySignalActions } from "@/components/memory-signal-actions";
import { SiteShell } from "@/components/site-shell";
import { buildAskHref } from "@/lib/memduck/ask-link";
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
  const signalSummary = service.getCardSignalSummary(card.id);
  const topicsById = new Map(
    service.listTopics().map((topic) => [topic.id, topic]),
  );
  const topics = card.topicIds
    .map((topicId) => topicsById.get(topicId))
    .filter((topic) => Boolean(topic));
  const topicLinks = service
    .listTopicLinksForCard(card.id)
    .map((topicLink) => ({
      link: topicLink,
      topic: topicsById.get(topicLink.topicId),
    }))
    .filter((entry) => Boolean(entry.topic));
  const sourceChunks = service.listSourceChunks(card.sourceItemId);

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Memory Card</p>
          <h2>{card.title}</h2>
          <p className="muted-copy">
            {card.summary ||
              "This capture is stored in the inbox but has not been digested yet."}
          </p>
          <div className="pill-row">
            <span className="topic-pill">{card.sourceChannel}</span>
            {card.status !== "saved" ? (
              <span className="topic-pill">
                {card.worthSaving ? "worth saving" : "reference only"}
              </span>
            ) : null}
            <span className="topic-pill">
              {source?.kind ?? "unknown source"}
            </span>
            <span className="topic-pill">{card.status}</span>
          </div>
        </section>
      }
    >
      <section className="detail-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">
                {card.status === "saved" ? "Analyze" : "Continue In Ask"}
              </p>
              <h2>
                {card.status === "saved"
                  ? "Turn this saved source into a real memory card"
                  : "Use this card as the center of a tighter question"}
              </h2>
            </div>
          </div>
          {card.status === "saved" ? (
            <div className="topic-list">
              <div className="topic-card">
                <strong>Saved only</strong>
                <span>
                  This source is preserved, but it is not retrievable yet. Run
                  quick analysis for a first digest or deep analysis for topic
                  links and compiled views.
                </span>
              </div>
            </div>
          ) : (
            <div className="topic-list">
              <Link
                className="topic-card"
                href={buildAskHref({
                  cardId: card.id,
                  question: `What should I remember from "${card.title}"?`,
                })}
              >
                <strong>What should I remember?</strong>
                <span>Ask only against this memory card.</span>
              </Link>
              <Link
                className="topic-card"
                href={buildAskHref({
                  cardId: card.id,
                  question: `What evidence inside "${card.title}" is strongest?`,
                })}
              >
                <strong>Pull the strongest evidence</strong>
                <span>Use the source-grounded chunks behind this card.</span>
              </Link>
              {topics[0] ? (
                <Link
                  className="topic-card"
                  href={buildAskHref({
                    cardId: card.id,
                    question: `How does "${card.title}" fit into ${topics[0].name}?`,
                    topicId: topics[0].id,
                  })}
                >
                  <strong>Place it inside the topic</strong>
                  <span>Ask how this card fits into {topics[0].name}.</span>
                </Link>
              ) : null}
            </div>
          )}
          <MemoryAnalysisActions cardId={card.id} status={card.status} />
        </section>

        <section className="panel">
          <p className="eyebrow">Digest</p>
          <div className="topic-list">
            <div className="topic-card">
              <strong>Summary</strong>
              <span>{card.summary || "Not analyzed yet"}</span>
            </div>
            <div className="topic-card">
              <strong>Deep summary</strong>
              <span>
                {card.deepSummary || "Run deep analysis to fill this in"}
              </span>
            </div>
            <div className="topic-card">
              <strong>Status</strong>
              <span>
                {card.status} · created{" "}
                {new Date(card.createdAt).toLocaleString()}
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Memory Signals</p>
          <p className="muted-copy">
            Tell memduck that this card matters, should be revisited, or keeps
            resurfacing in your work.
          </p>
          <MemorySignalActions
            cardId={card.id}
            initialSummary={signalSummary}
            recordViewOnMount
            topicId={card.topicIds[0]}
          />
        </section>
      </section>

      <section className="detail-grid">
        <section className="panel">
          <p className="eyebrow">Distilled Points</p>
          {card.keyPoints.length > 0 || card.evidence.length > 0 ? (
            <div className="topic-list">
              {card.keyPoints.map((point) => (
                <div className="topic-card" key={point}>
                  <strong>Key point</strong>
                  <span>{point}</span>
                </div>
              ))}
              {card.evidence.map((evidence) => (
                <div className="topic-card" key={evidence}>
                  <strong>Evidence surfaced in digest</strong>
                  <span>{evidence}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-copy">
              No distilled points yet. Analyze this card to generate them.
            </p>
          )}
        </section>

        <section className="panel">
          <p className="eyebrow">Topic Links</p>
          {topicLinks.length > 0 ? (
            <div className="topic-list">
              {topicLinks.map(({ link, topic }) =>
                topic ? (
                  <div className="topic-card" key={link.topicId}>
                    <strong>{topic.name}</strong>
                    <span>
                      {Math.round(link.confidence * 100)}% confidence ·{" "}
                      {link.reason}
                    </span>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <p className="muted-copy">
              No topic links are stored for this card yet.
            </p>
          )}
        </section>
      </section>

      <section className="detail-grid">
        <section className="panel">
          <p className="eyebrow">Traceability</p>
          <div className="topic-list">
            <div className="topic-card">
              <strong>Source kind</strong>
              <span>{source?.kind ?? "Unknown"}</span>
            </div>
            <div className="topic-card">
              <strong>Source channel</strong>
              <span>{card.sourceChannel}</span>
            </div>
            {source?.sourceUrl ? (
              <div className="topic-card">
                <strong>Original source</strong>
                <a
                  className="inline-link"
                  href={source.sourceUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {source.sourceUrl}
                </a>
              </div>
            ) : null}
            {source?.pageTitle ? (
              <div className="topic-card">
                <strong>Page title</strong>
                <span>{source.pageTitle}</span>
              </div>
            ) : null}
            {source?.caption ? (
              <div className="topic-card">
                <strong>Caption</strong>
                <span>{source.caption}</span>
              </div>
            ) : null}
            {source?.objectKey ? (
              <div className="topic-card">
                <strong>Stored asset</strong>
                <span>{source.objectKey}</span>
              </div>
            ) : null}
            {source?.snapshotPath ? (
              <div className="topic-card">
                <strong>HTML snapshot</strong>
                <span>{source.snapshotPath}</span>
              </div>
            ) : null}
            {topics.length > 0 ? (
              <div className="topic-card">
                <strong>Topics</strong>
                <span>{topics.map((topic) => topic?.name).join(" · ")}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">Source Body</p>
          {source?.bodyText ? (
            <div className="topic-card">
              <strong>Normalized source text</strong>
              <span>{source.bodyText}</span>
            </div>
          ) : (
            <p className="muted-copy">
              This source does not currently expose normalized body text.
            </p>
          )}
        </section>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Grounding Chunks</p>
            <h2>These are the source spans Ask can cite directly</h2>
          </div>
          <p className="panel-copy">
            Chunk-level grounding keeps answers traceable back to the original
            saved material instead of stopping at the card summary.
          </p>
        </div>
        {sourceChunks.length > 0 ? (
          <div className="topic-list">
            {sourceChunks.map((chunk) => (
              <div
                className="topic-card"
                id={`chunk-${chunk.id}`}
                key={chunk.id}
              >
                <strong>
                  Chunk {chunk.sequence} · {chunk.startOffset}-{chunk.endOffset}
                </strong>
                <span>{chunk.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-copy">
            Grounding chunks are only available after analysis generates a
            retrievable source representation.
          </p>
        )}
      </section>
    </SiteShell>
  );
}
