import { notFound, redirect } from "next/navigation";
import { AskStudio } from "@/components/ask-studio";
import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";

function firstSearchParam(
  value: string | string[] | undefined,
): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  return value?.[0];
}

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const service = await getMemduckService();
  if (service.getSetupState().needsOnboarding) {
    redirect("/setup");
  }

  const topics = service.listTopics();
  const cards = service.listMemoryCards();
  const initialTopicId = firstSearchParam(resolvedSearchParams.topicId);
  const initialCardId = firstSearchParam(resolvedSearchParams.cardId);
  const initialQuestion = firstSearchParam(resolvedSearchParams.q);

  if (initialTopicId && !topics.some((topic) => topic.id === initialTopicId)) {
    notFound();
  }

  if (initialCardId && !cards.some((card) => card.id === initialCardId)) {
    notFound();
  }

  return (
    <SiteShell
      intro={
        <section className="page-intro">
          <p className="eyebrow">Ask</p>
          <h2>
            Interrogate your own content graph instead of the whole internet.
          </h2>
          <p className="muted-copy">
            Answers are grounded in what you actually saved, with source-linked
            citations and topic-aware filters.
          </p>
        </section>
      }
    >
      <AskStudio
        cards={cards}
        initialCardId={initialCardId}
        initialQuestion={initialQuestion}
        initialTopicId={initialTopicId}
        topics={topics}
      />
    </SiteShell>
  );
}
