import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { DeleteMemoryDialog } from "@/components/delete-memory-dialog";
import { MemoryAnalysisActions } from "@/components/memory-analysis-actions";
import { MemorySignalActions } from "@/components/memory-signal-actions";
import { SiteShell } from "@/components/site-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { buildAskHref } from "@/lib/memduck/ask-link";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { MemoryCard } from "@/lib/memduck/service";

function statusLabel(status: MemoryCard["status"]) {
  switch (status) {
    case "deep_ready":
      return "深度";
    case "quick_ready":
      return "已消化";
    case "saved":
      return "已保存";
  }
}

function ProseBlock({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-medium text-foreground text-xs uppercase tracking-wider">
        {title}
      </h3>
      <div className="max-w-none break-words text-muted-foreground text-sm leading-relaxed [&_p]:my-1">
        {children}
      </div>
    </div>
  );
}

export default async function MemoryCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getMemduckService();
  if (service.getSetupState().needsOnboarding) {
    redirect("/models");
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
  const topicLinkConfidence = new Map(
    service
      .listTopicLinksForCard(card.id)
      .map((topicLink) => [topicLink.topicId, topicLink.confidence]),
  );
  const topicLinks = card.topicIds
    .map((topicId) => ({
      confidence: topicLinkConfidence.get(topicId),
      topic: topicsById.get(topicId),
    }))
    .filter((entry) => Boolean(entry.topic));
  const sourceChunks = service.listSourceChunks(card.sourceItemId);

  return (
    <SiteShell>
      <div className="flex flex-col gap-4 p-4">
        <header className="flex flex-col gap-4">
          {/* breadcrumb */}
          <Link
            className="mb-4 inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            href="/inbox"
          >
            ← 记忆
          </Link>
          <h1 className="max-w-3xl break-words text-2xl font-medium">
            {card.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{statusLabel(card.status)}</Badge>
            <Badge variant="outline">{card.sourceChannel}</Badge>
            {source?.kind && <Badge variant="outline">{source.kind}</Badge>}
            {card.status !== "saved" ? (
              <span className="text-muted-foreground text-sm">
                {card.worthSaving ? "值得保留" : "仅作参考"}
              </span>
            ) : null}
            <span className="ml-auto text-muted-foreground text-sm">
              {new Date(card.createdAt).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {source?.sourceUrl ? (
              <Button asChild size="sm" variant="outline">
                <a href={source.sourceUrl} rel="noreferrer" target="_blank">
                  原始来源 ↗
                </a>
              </Button>
            ) : null}
            {card.status !== "saved" ? (
              <Button asChild size="sm">
                <Link
                  href={buildAskHref({
                    cardId: card.id,
                    question: `"${card.title}" 最值得记住的是什么？`,
                  })}
                >
                  问 Agent
                </Link>
              </Button>
            ) : null}
            <DeleteMemoryDialog cardId={card.id} variant="button" />
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle>摘要</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 px-5 pt-5 pb-6">
                <ProseBlock title="简要">
                  <p>{card.summary || "还没有消化。"}</p>
                </ProseBlock>
                <Separator className="opacity-50" />
                <ProseBlock title="深度">
                  <p>{card.deepSummary || "还没有深度消化。"}</p>
                </ProseBlock>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>要点</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 pt-6">
                {card.keyPoints.length > 0 || card.evidence.length > 0 ? (
                  <>
                    {card.keyPoints.map((point) => (
                      <ProseBlock key={point} title="要点">
                        <p>{point}</p>
                      </ProseBlock>
                    ))}
                    {card.evidence.map((evidence) => (
                      <ProseBlock key={evidence} title="依据">
                        <p>{evidence}</p>
                      </ProseBlock>
                    ))}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">还没有要点。</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <details className="[&[open]>summary_span[data-arrow]]:rotate-180">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                  <span>来源正文</span>
                  <span
                    className="text-muted-foreground text-xs font-normal transition-transform"
                    data-arrow=""
                  >
                    ▼
                  </span>
                </summary>
                <CardContent className="pt-4 pb-2">
                  {source?.bodyText ? (
                    <p className="max-h-[28rem] overflow-y-auto break-words whitespace-pre-wrap rounded-lg border border-border/50 bg-muted/20 p-4 text-muted-foreground text-sm leading-relaxed">
                      {source.bodyText}
                    </p>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      还没有正文。
                    </p>
                  )}
                </CardContent>
              </details>
            </Card>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>操作</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 px-4 pt-4 pb-4">
                <MemoryAnalysisActions cardId={card.id} status={card.status} />
                <Separator className="opacity-40" />
                <MemorySignalActions
                  cardId={card.id}
                  compact
                  initialSummary={signalSummary}
                  recordViewOnMount
                  topicId={card.topicIds[0]}
                />
              </CardContent>
            </Card>

            {topicLinks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>主题</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 px-4 pt-3 pb-4">
                  {topicLinks.map(({ confidence, topic }) =>
                    topic ? (
                      <div
                        className="rounded border border-border/40 bg-muted/30"
                        key={topic.id}
                      >
                        <div className="px-3 py-2.5">
                          <p className="break-words text-sm font-medium">
                            {topic.name}
                          </p>
                          {typeof confidence === "number" ? (
                            <p className="mt-0.5 font-mono text-muted-foreground text-[0.68rem] tabular-nums">
                              {Math.round(confidence * 100)}% 匹配
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1.5 border-border/40 border-t px-3 py-2">
                          <Button asChild size="xs" variant="outline">
                            <Link href={`/inbox?topicId=${topic.id}`}>
                              查看记忆
                            </Link>
                          </Button>
                          <Button asChild size="xs" variant="secondary">
                            <Link
                              href={buildAskHref({
                                cardId: card.id,
                                question: `结合"${card.title}"，围绕这个主题我还应该追问什么？`,
                                topicId: topic.id,
                              })}
                            >
                              问主题
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ) : null,
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>元数据</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-border/30 px-0 py-0">
                {[
                  { label: "来源", value: card.sourceChannel },
                  { label: "类型", value: source?.kind ?? "未知" },
                  {
                    label: "创建",
                    value: new Date(card.createdAt).toLocaleDateString("zh-CN"),
                  },
                ].map((row) => (
                  <div
                    className="flex min-w-0 items-center justify-between gap-3 px-4 py-2.5 text-[0.78rem]"
                    key={row.label}
                  >
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="min-w-0 break-words text-right font-medium">
                      {row.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </aside>
        </div>

        {sourceChunks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>引用片段</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 p-4 md:grid-cols-2">
              {sourceChunks.map((chunk) => (
                <div
                  className="rounded bg-muted/30 px-3.5 py-3"
                  id={`chunk-${chunk.id}`}
                  key={chunk.id}
                >
                  <p className="mb-1.5 font-mono text-[0.63rem] text-muted-foreground/50 tabular-nums">
                    #{chunk.sequence} · {chunk.startOffset}–{chunk.endOffset}
                  </p>
                  <p className="break-words text-[0.8rem] leading-relaxed text-muted-foreground">
                    {chunk.text}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </SiteShell>
  );
}
