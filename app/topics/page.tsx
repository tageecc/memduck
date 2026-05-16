import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { buildAskHref } from "@/lib/memduck/ask-link";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { CompiledTopic, Topic } from "@/lib/memduck/service";

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
      <div className="workspace-page">
        <header className="workspace-header flex-col items-start sm:flex-row sm:items-end">
          <div>
            <h1 className="workspace-title">主题</h1>
            <p className="workspace-description">
              自动归纳的主题与已编译摘要。
            </p>
          </div>
          <Badge
            className="h-7 w-fit rounded-md px-2.5 font-mono text-xs tabular-nums"
            variant="secondary"
          >
            {topics.length}
          </Badge>
        </header>

        {topics.length > 0 ? (
          <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topicsWithCount.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        ) : (
          <Empty className="flat-panel border-dashed py-16">
            <EmptyHeader>
              <EmptyTitle>还没有主题</EmptyTitle>
              <EmptyDescription>
                对记忆进行深度消化后会自动归纳出主题。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </SiteShell>
  );
}

function TopicCard({
  topic,
}: {
  topic: Topic & {
    cardCount: number;
    compiled: CompiledTopic | null;
  };
}) {
  const keywords = topic.keywords.slice(0, 6);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-3 pb-2">
        <CardTitle className="line-clamp-2 text-lg leading-snug">
          {topic.name}
        </CardTitle>
        <div className="flex flex-wrap gap-1.5">
          <Badge className="font-mono text-[0.65rem]" variant="secondary">
            {topic.cardCount} 条记忆
          </Badge>
          {topic.compiled ? (
            <Badge className="text-[0.65rem]" variant="outline">
              已编译
            </Badge>
          ) : null}
        </div>
        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {keywords.map((kw) => (
              <span
                className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[0.62rem] text-muted-foreground"
                key={kw}
              >
                {kw}
              </span>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        {topic.compiled?.summary ? (
          <p className="line-clamp-4 flex-1 text-muted-foreground text-sm leading-relaxed">
            {topic.compiled.summary}
          </p>
        ) : (
          <p className="flex-1 text-muted-foreground text-xs">暂无编译摘要</p>
        )}
      </CardContent>
      <CardFooter className="mt-auto flex flex-wrap gap-2 border-border/50 border-t bg-muted/10">
        <Button asChild size="sm" variant="outline">
          <Link href={`/inbox?topicId=${topic.id}`}>查看记忆</Link>
        </Button>
        <Button asChild size="sm" variant="default">
          <Link
            href={buildAskHref({
              question: `关于"${topic.name}"，我应该了解什么？`,
              topicId: topic.id,
            })}
          >
            问 Agent
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
