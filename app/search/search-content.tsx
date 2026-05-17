"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { buildAskHref } from "@/lib/memduck/ask-link";
import { buildSearchHref } from "@/lib/memduck/search-link";
import type { MemoryCard } from "@/lib/memduck/service";

type SearchResult = {
  card: MemoryCard;
  rerankScore: number;
  semanticScore: number;
};

type StatusNotice = {
  message: string;
  tone: "error" | "info";
};

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

function parseSearchPayload(responseText: string): {
  error?: string;
  items?: SearchResult[];
} {
  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText) as {
      error?: string;
      items?: SearchResult[];
    };
  } catch {
    return {};
  }
}

function SearchLoadingState() {
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      <p className="text-muted-foreground text-sm">正在搜索相关记忆…</p>
      {[0, 1].map((item) => (
        <Card className="overflow-hidden" key={item} size="sm">
          <div className="flex flex-col gap-0 sm:flex-row">
            <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-border/60 border-b bg-muted/30 px-4 py-3 sm:w-20 sm:flex-col sm:justify-center sm:border-r sm:border-b-0 sm:px-0 sm:py-5">
              <Skeleton className="h-8 w-10" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="min-w-0 flex-1">
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/5" />
                <div className="flex gap-1.5 pt-1">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-14" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
              <CardFooter className="gap-2 border-border/50 border-t bg-muted/10">
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-8 w-20" />
              </CardFooter>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(queryParam);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [pending, setPending] = useState(false);
  const [searched, setSearched] = useState(false);
  const [statusNotice, setStatusNotice] = useState<StatusNotice | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  function cancelSearch() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setPending(false);
    setStatusNotice({ message: "已取消搜索。", tone: "info" });
  }

  const executeSearch = useCallback(async (rawQuery: string) => {
    const normalizedQuery = rawQuery.trim();
    if (!normalizedQuery) return;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setPending(true);
    setSearched(true);
    setStatusNotice(null);

    try {
      const response = await fetch("/api/search", {
        body: JSON.stringify({ limit: 10, query: normalizedQuery }),
        headers: { "content-type": "application/json" },
        method: "POST",
        signal: abortController.signal,
      });
      const responseText = await response.text();
      const data = parseSearchPayload(responseText);

      if (!response.ok || !Array.isArray(data.items)) {
        throw new Error(data.error ?? "搜索失败。");
      }

      setResults(data.items);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setStatusNotice({
        message: error instanceof Error ? error.message : "搜索失败。",
        tone: "error",
      });
      setResults([]);
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setPending(false);
    }
  }, []);

  useEffect(() => {
    setQuery(queryParam);

    if (queryParam.trim()) {
      void executeSearch(queryParam);
      return;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setPending(false);
    setSearched(false);
    setResults(null);
    setStatusNotice(null);
  }, [executeSearch, queryParam]);

  function handleSearch() {
    if (pending) {
      cancelSearch();
      return;
    }
    if (!query.trim()) return;

    const normalizedQuery = query.trim();
    if (normalizedQuery === queryParam.trim()) {
      void executeSearch(normalizedQuery);
      return;
    }

    router.replace(buildSearchHref({ query: normalizedQuery }), {
      scroll: false,
    });
  }

  function clearSearch() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setQuery("");
    setPending(false);
    setSearched(false);
    setResults(null);
    setStatusNotice(null);
    router.replace("/search", { scroll: false });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-medium">语义搜索</h1>
          <p className="text-muted-foreground text-sm">
            按含义检索记忆，而不仅是字面匹配。输入问题或关键词，查看相关度排序结果。
          </p>
        </div>
      </header>

      <div className="flex w-full max-w-3xl flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <Input
            className="h-11 flex-1 border-border bg-card text-base sm:text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：上次记录的 Next.js 要点、项目预算讨论…"
            value={query}
          />
          <Button
            className="h-11 shrink-0 px-6 sm:w-28"
            disabled={!pending && !query.trim()}
            onClick={handleSearch}
            variant={pending ? "secondary" : "default"}
          >
            {pending ? "取消" : "搜索"}
          </Button>
        </div>
        {statusNotice ? (
          <Alert
            variant={statusNotice.tone === "error" ? "destructive" : "default"}
          >
            <AlertDescription>{statusNotice.message}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="min-h-[200px]">
        {pending ? (
          <SearchLoadingState />
        ) : results === null && !searched ? (
          <p className="text-center text-muted-foreground text-sm">
            在上方输入内容后开始搜索。
          </p>
        ) : results !== null && results.length === 0 ? (
          <Empty className="border border-dashed py-14">
            <EmptyHeader>
              <EmptyTitle>没有找到相关记忆</EmptyTitle>
              <EmptyDescription>
                试试换个问法，或先在 Agent 里保存一些相关内容。
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              <Button onClick={clearSearch} size="sm" variant="outline">
                清空搜索
              </Button>
              <Button asChild size="sm">
                <Link href={buildAskHref({ question: query })}>去 Agent</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : results !== null ? (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              找到{" "}
              <span className="font-mono font-medium text-foreground tabular-nums">
                {results.length}
              </span>{" "}
              条相关记忆
            </p>
            {results.map(({ card, rerankScore }) => {
              const pct = Math.round(rerankScore * 100);
              const returnHref = buildSearchHref({ query });
              const memoryHref = `/memory/${encodeURIComponent(
                card.id,
              )}?returnTo=${encodeURIComponent(returnHref)}`;
              return (
                <Card className="overflow-hidden" key={card.id} size="sm">
                  <div className="flex flex-col gap-0 sm:flex-row">
                    <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-border/60 border-b bg-muted/30 px-4 py-3 sm:w-20 sm:flex-col sm:justify-center sm:border-r sm:border-b-0 sm:px-0 sm:py-5">
                      <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
                        {pct}
                      </span>
                      <span className="text-muted-foreground text-[0.65rem] uppercase tracking-wider">
                        相关度
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base leading-snug">
                          {card.title}
                        </CardTitle>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Badge variant="outline">{card.sourceChannel}</Badge>
                          <Badge variant="secondary">
                            {statusLabel(card.status)}
                          </Badge>
                        </div>
                      </CardHeader>
                      {card.summary ? (
                        <CardContent className="pt-0">
                          <p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
                            {card.summary}
                          </p>
                        </CardContent>
                      ) : null}
                      <CardFooter className="gap-2 border-border/50 border-t bg-muted/10">
                        <Button asChild size="sm" variant="outline">
                          <Link href={memoryHref}>打开</Link>
                        </Button>
                        <Button asChild size="sm" variant="default">
                          <Link
                            href={buildAskHref({
                              cardId: card.id,
                              question: query,
                            })}
                          >
                            问 Agent
                          </Link>
                        </Button>
                      </CardFooter>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
