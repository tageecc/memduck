import { redirect } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { CompiledTopic } from "@/lib/memduck/service";

import { TopicsContent } from "./topics-content";

export default async function TopicsPage() {
  const service = await getMemduckService();
  if (service.getSetupState().needsOnboarding) {
    redirect("/models");
  }

  const topics = service.listTopics();
  const cards = service.listMemoryCards();
  const compiled = service.listCompiledTopics();

  const compiledById = new Map<string, CompiledTopic>(
    compiled.map((c) => [c.topicId, c]),
  );

  const topicsWithCount = topics.map((topic) => ({
    ...topic,
    cardCount: cards.filter((c) => c.topicIds.includes(topic.id)).length,
    compiled: compiledById.get(topic.id) ?? null,
  }));

  return (
    <SiteShell>
      <TopicsContent topics={topicsWithCount} />
    </SiteShell>
  );
}
