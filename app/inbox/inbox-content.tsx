"use client";

import { DownloadIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useState } from "react";

import { MemoryCardPreview } from "@/components/memory-card-preview";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { MemoryCard, Topic } from "@/lib/memduck/service";
import { cn } from "@/lib/utils";

type Filters = {
  query: string;
  status: "" | "deep_ready" | "quick_ready" | "saved";
  topicId: string;
};

const STATUS_FILTERS: {
  key: Filters["status"] | "_all";
  label: string;
}[] = [
  { key: "_all", label: "全部" },
  { key: "saved", label: "待消化" },
  { key: "quick_ready", label: "已消化" },
  { key: "deep_ready", label: "深度" },
];

function filterCards(cards: MemoryCard[], filters: Filters): MemoryCard[] {
  return cards.filter((card) => {
    if (
      filters.query &&
      !card.title.toLowerCase().includes(filters.query.toLowerCase()) &&
      !card.summary.toLowerCase().includes(filters.query.toLowerCase())
    ) {
      return false;
    }
    if (filters.status && card.status !== filters.status) {
      return false;
    }
    if (filters.topicId && !card.topicIds.includes(filters.topicId)) {
      return false;
    }
    return true;
  });
}

function InboxCardSkeleton() {
  return (
    <div className="rounded-lg bg-card shadow-[0_1px_3px_0_rgb(0_0_0/0.05),0_0_0_1px_rgb(0_0_0/0.06)] overflow-hidden">
      <div className="p-4 pb-3">
        <Skeleton className="mb-2.5 h-4 w-[80%] rounded" />
        <Skeleton className="mb-1.5 h-3 w-full rounded" />
        <Skeleton className="h-3 w-3/5 rounded" />
      </div>
      <div className="flex gap-1.5 px-4 pb-3">
        <Skeleton className="h-4 w-12 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
      <div className="border-t border-border/30 bg-muted/20 px-3 py-2">
        <Skeleton className="h-5 w-10 rounded" />
      </div>
    </div>
  );
}

export function InboxContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filters, setFilters] = useState<Filters>({
    query: "",
    status: "",
    topicId: searchParams.get("topicId") ?? "",
  });
  const [batchPending, setBatchPending] = useState(false);

  const reload = useCallback(() => {
    void Promise.all([
      fetch("/api/memory-cards").then((r) => r.json() as Promise<MemoryCard[]>),
      fetch("/api/topics").then((r) => r.json() as Promise<Topic[]>),
    ]).then(([c, t]) => {
      setCards(c);
      setTopics(t);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    void fetch("/api/setup-state")
      .then((r) => r.json() as Promise<{ needsOnboarding: boolean }>)
      .then((state) => {
        if (state.needsOnboarding) router.replace("/models");
        else reload();
      });
  }, [reload, router]);

  const filtered = filterCards(cards, filters);
  const pendingCards = cards.filter((c) => c.status === "saved");

  function handleBatchAnalyze() {
    setBatchPending(true);

    startTransition(() => {
      void Promise.all(
        pendingCards.map((card) =>
          fetch(`/api/memory-cards/${card.id}/analyze`, {
            body: JSON.stringify({ requestedDepth: "quick" }),
            headers: { "content-type": "application/json" },
            method: "POST",
          }),
        ),
      )
        .then(() => reload())
        .finally(() => setBatchPending(false));
    });
  }

  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <div>
          <h1 className="workspace-title">记忆</h1>
          <p className="workspace-description">
            浏览、筛选、批量消化已保存的内容
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {cards.length > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground/60">
              {filtered.length}
              {filtered.length !== cards.length ? ` / ${cards.length}` : ""}
            </span>
          )}
          <Button
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => {
              const a = document.createElement("a");
              a.href = "/api/export?format=json";
              a.download = "";
              a.click();
            }}
            size="sm"
            variant="outline"
          >
            <DownloadIcon className="size-3" />
            导出
          </Button>
        </div>
      </header>

      {!loading && cards.length > 0 && (
        <div className="flat-panel grid grid-cols-2 overflow-hidden md:grid-cols-4">
          {[
            { label: "全部", value: cards.length, accent: "text-foreground" },
            {
              accent: "text-status-pending",
              label: "待消化",
              value: cards.filter((c) => c.status === "saved").length,
            },
            {
              accent: "text-status-quick",
              label: "已消化",
              value: cards.filter((c) => c.status === "quick_ready").length,
            },
            {
              accent: "text-status-deep",
              label: "深度",
              value: cards.filter((c) => c.status === "deep_ready").length,
            },
          ].map((stat, i) => (
            <div
              className={cn(
                "flex flex-col gap-1 px-5 py-4",
                i > 0 && "md:border-l md:border-border",
                i > 1 && "border-t border-border md:border-t-0",
              )}
              key={stat.label}
            >
              <span
                className={cn(
                  "font-mono text-[1.75rem] font-semibold tabular-nums leading-none",
                  stat.accent,
                )}
              >
                {stat.value}
              </span>
              <span className="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            className="h-8 rounded border-border/60 bg-card pl-8 text-sm shadow-[0_1px_2px_0_rgb(0_0_0/0.04)] placeholder:text-muted-foreground/40 focus-visible:ring-1"
            onChange={(e) =>
              setFilters((f) => ({ ...f, query: e.target.value }))
            }
            placeholder="搜索标题或摘要…"
            value={filters.query}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flat-chip flex gap-0.5 p-0.5">
            {STATUS_FILTERS.map(({ key, label }) => {
              const active =
                key === "_all" ? filters.status === "" : filters.status === key;
              return (
                <button
                  className={cn(
                    "cursor-pointer rounded px-2.5 py-1 text-[0.75rem] font-medium transition-colors",
                    active
                      ? "bg-card text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  key={key}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      status: key === "_all" ? "" : key,
                    }))
                  }
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>
          {topics.length > 0 && (
            <Select
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, topicId: v === "_all" ? "" : v }))
              }
              value={filters.topicId || "_all"}
            >
              <SelectTrigger className="h-8 w-[9.5rem] rounded-md border-border bg-card text-sm">
                <SelectValue placeholder="全部主题" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">全部主题</SelectItem>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {pendingCards.length > 0 ? (
            <Button
              className="h-8 px-3 text-xs"
              disabled={batchPending}
              onClick={handleBatchAnalyze}
              size="sm"
              variant="outline"
            >
              {batchPending ? "处理中…" : `消化全部 (${pendingCards.length})`}
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InboxCardSkeleton />
          <InboxCardSkeleton />
          <InboxCardSkeleton />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((card) => (
            <MemoryCardPreview
              key={card.id}
              card={card}
              onDeleted={reload}
              topics={topics}
            />
          ))}
        </div>
      ) : (
        <Empty className="flat-panel border-dashed py-20">
          <EmptyHeader>
            <EmptyTitle>
              {cards.length === 0 ? "还没有记忆" : "没有匹配的记忆"}
            </EmptyTitle>
            <EmptyDescription>
              {cards.length === 0
                ? "在 Agent 里发送链接、文本或图片后会出现在这里。"
                : "试试调整搜索或过滤条件。"}
            </EmptyDescription>
          </EmptyHeader>
          {cards.length === 0 ? (
            <Button asChild size="sm">
              <Link href="/ask">去 Agent</Link>
            </Button>
          ) : null}
        </Empty>
      )}
    </div>
  );
}
