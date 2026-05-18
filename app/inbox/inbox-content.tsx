"use client";

import { DownloadIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useCallback, useEffect, useState } from "react";

import { MemoryCardPreview } from "@/components/memory-card-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  readErrorMessage,
  readJsonObject,
  readJsonValue,
} from "@/lib/http/response";
import { buildInboxHref } from "@/lib/memduck/inbox-link";
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

function readStatusFilter(value: string | null): Filters["status"] {
  return value === "deep_ready" || value === "quick_ready" || value === "saved"
    ? value
    : "";
}

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
    <Card>
      <CardContent>
        <Skeleton className="mb-2.5 h-4 w-[80%] rounded" />
        <Skeleton className="mb-1.5 h-3 w-full rounded" />
        <Skeleton className="h-3 w-3/5 rounded" />
      </CardContent>
      <CardContent className="flex gap-1.5">
        <Skeleton className="h-4 w-12 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </CardContent>
      <CardContent>
        <Skeleton className="h-5 w-10 rounded" />
      </CardContent>
    </Card>
  );
}

function localizeAnalyzeError(message: string) {
  if (/provider request timed out/i.test(message)) {
    return "模型请求超时，请稍后重试或检查模型配置。";
  }

  return message;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function InboxContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filters, setFilters] = useState<Filters>({
    query: searchParams.get("q") ?? "",
    status: readStatusFilter(searchParams.get("status")),
    topicId: searchParams.get("topicId") ?? "",
  });
  const [batchPending, setBatchPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const reload = useCallback(() => {
    setStatusMessage(null);
    void Promise.all([fetch("/api/memory-cards"), fetch("/api/topics")])
      .then(async ([cardsResponse, topicsResponse]) => {
        if (!cardsResponse.ok) {
          throw new Error(
            await readErrorMessage(cardsResponse, "记忆加载失败。"),
          );
        }
        if (!topicsResponse.ok) {
          throw new Error(
            await readErrorMessage(topicsResponse, "主题加载失败。"),
          );
        }

        const [nextCards, nextTopics] = (await Promise.all([
          readJsonValue(cardsResponse),
          readJsonValue(topicsResponse),
        ])) as [MemoryCard[] | null, Topic[] | null];

        if (!Array.isArray(nextCards) || !Array.isArray(nextTopics)) {
          throw new Error("记忆加载失败。");
        }

        setCards(nextCards);
        setTopics(nextTopics);
      })
      .catch((error: Error) => {
        setStatusMessage(error.message || "记忆加载失败。");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void fetch("/api/setup-state")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            await readErrorMessage(response, "设置状态加载失败。"),
          );
        }

        const state = (await readJsonObject(response)) as {
          needsOnboarding?: unknown;
        } | null;

        if (typeof state?.needsOnboarding !== "boolean") {
          throw new Error("设置状态加载失败。");
        }

        return { needsOnboarding: state.needsOnboarding };
      })
      .then((state) => {
        if (state.needsOnboarding) router.replace("/models");
        else reload();
      })
      .catch((error: Error) => {
        setStatusMessage(error.message || "设置状态加载失败。");
        setLoading(false);
      });
  }, [reload, router]);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      query: searchParams.get("q") ?? "",
      status: readStatusFilter(searchParams.get("status")),
      topicId: searchParams.get("topicId") ?? "",
    }));
  }, [searchParams]);

  const updateFilters = useCallback(
    (nextFilters: Filters) => {
      setFilters(nextFilters);
      router.replace(buildInboxHref(nextFilters), { scroll: false });
    },
    [router],
  );
  const currentInboxHref = buildInboxHref(filters);

  const filtered = filterCards(cards, filters);
  const visiblePendingCards = filtered.filter((c) => c.status === "saved");
  const hasActiveFilters = Boolean(
    filters.query.trim() || filters.status || filters.topicId,
  );
  const resetFilters = useCallback(() => {
    updateFilters({ query: "", status: "", topicId: "" });
  }, [updateFilters]);

  function handleBatchAnalyze() {
    setBatchPending(true);
    setStatusMessage(null);

    startTransition(() => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 30_000);

      void Promise.all(
        visiblePendingCards.map((card) =>
          fetch(`/api/memory-cards/${card.id}/analyze`, {
            body: JSON.stringify({ requestedDepth: "quick" }),
            headers: { "content-type": "application/json" },
            method: "POST",
            signal: controller.signal,
          }),
        ),
      )
        .then(async (responses) => {
          const failed = responses.find((response) => !response.ok);
          if (failed) {
            throw new Error(
              localizeAnalyzeError(
                await readErrorMessage(failed, "批量消化失败。"),
              ),
            );
          }

          reload();
        })
        .catch((error: unknown) => {
          setStatusMessage(
            isAbortError(error)
              ? "批量消化超时，请稍后重试或检查模型配置。"
              : error instanceof Error
                ? error.message || "批量消化失败。"
                : "批量消化失败。",
          );
        })
        .finally(() => {
          window.clearTimeout(timeout);
          setBatchPending(false);
        });
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium">记忆</h1>
          <p className="text-muted-foreground text-sm">
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
        <Card>
          <CardContent className="grid grid-cols-2 p-0 md:grid-cols-4">
            {[
              { label: "全部", value: cards.length },
              {
                label: "待消化",
                value: cards.filter((c) => c.status === "saved").length,
              },
              {
                label: "已消化",
                value: cards.filter((c) => c.status === "quick_ready").length,
              },
              {
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
                <span className="font-mono text-2xl font-semibold tabular-nums leading-none">
                  {stat.value}
                </span>
                <span className="text-muted-foreground text-xs">
                  {stat.label}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            className="pl-8"
            onChange={(e) =>
              updateFilters({ ...filters, query: e.target.value })
            }
            placeholder="搜索标题或摘要…"
            value={filters.query}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            {STATUS_FILTERS.map(({ key, label }) => {
              const active =
                key === "_all" ? filters.status === "" : filters.status === key;
              return (
                <button
                  className={cn(
                    "cursor-pointer rounded-md px-2.5 py-1 text-sm transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  key={key}
                  onClick={() =>
                    updateFilters({
                      ...filters,
                      status: key === "_all" ? "" : key,
                    })
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
              onValueChange={(v) => {
                const topicId = v === "_all" ? "" : v;
                updateFilters({ ...filters, topicId });
              }}
              value={filters.topicId || "_all"}
            >
              <SelectTrigger className="w-[9.5rem]">
                <SelectValue placeholder="全部主题" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="_all">全部主题</SelectItem>
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          {visiblePendingCards.length > 0 ? (
            <Button
              className="h-8 px-3 text-xs"
              disabled={batchPending}
              onClick={handleBatchAnalyze}
              size="sm"
              variant="outline"
            >
              {batchPending
                ? "处理中…"
                : `消化当前结果 (${visiblePendingCards.length})`}
            </Button>
          ) : null}
        </div>
      </div>

      {statusMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}

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
              returnHref={currentInboxHref}
              topics={topics}
            />
          ))}
        </div>
      ) : (
        <Empty className="border border-dashed py-20">
          <EmptyHeader>
            <EmptyTitle>
              {cards.length === 0 ? "还没有记忆" : "没有匹配的记忆"}
            </EmptyTitle>
            <EmptyDescription>
              {cards.length === 0
                ? "在 Ask 里发送链接、文本或图片后会出现在这里。"
                : "试试调整搜索或过滤条件。"}
            </EmptyDescription>
          </EmptyHeader>
          {cards.length === 0 ? (
            <Button asChild size="sm">
              <Link href="/ask">去 Ask</Link>
            </Button>
          ) : hasActiveFilters ? (
            <EmptyContent>
              <Button onClick={resetFilters} size="sm" variant="outline">
                清除条件
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      )}
    </div>
  );
}
