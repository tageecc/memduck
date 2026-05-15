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

function allSearchParams(value: string | string[] | undefined): string[] {
  const values = typeof value === "string" ? [value] : (value ?? []);
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))];
}

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const service = await getMemduckService();
  if (service.getSetupState().needsOnboarding) {
    redirect("/models");
  }

  const topics = service.listTopics();
  const cards = service.listRetrievableMemoryCards();
  const initialTopicId = firstSearchParam(resolvedSearchParams.topicId);
  const initialCardIds = allSearchParams(resolvedSearchParams.cardId);
  const initialQuestion = firstSearchParam(resolvedSearchParams.q);

  if (initialTopicId && !topics.some((topic) => topic.id === initialTopicId)) {
    notFound();
  }

  if (
    initialCardIds.some((cardId) => !cards.some((card) => card.id === cardId))
  ) {
    notFound();
  }

  return (
    <SiteShell>
      <AskStudio
        initialCardIds={initialCardIds}
        initialQuestion={initialQuestion}
        initialTopicId={initialTopicId}
      />
    </SiteShell>
  );
}
