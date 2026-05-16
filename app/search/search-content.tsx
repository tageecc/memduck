"use client";

import Link from "next/link";
import { startTransition, useState } from "react";

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
import { Input } from "@/components/ui/input";
import { buildAskHref } from "@/lib/memduck/ask-link";
import type { MemoryCard } from "@/lib/memduck/service";

type SearchResult = {
  card: MemoryCard;
  rerankScore: number;
  semanticScore: number;
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

export function SearchContent() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [pending, setPending] = useState(false);
  const [searched, setSearched] = useState(false);

  function handleSearch() {
    if (!query.trim()) return;
    setPending(true);
    setSearched(true);

    startTransition(() => {
      void fetch("/api/search", {
        body: JSON.stringify({ limit: 20, query: query.trim() }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then((r) => r.json() as Promise<{ items: SearchResult[] }>)
        .then((data) => setResults(data.items))
        .catch(() => setResults([]))
        .finally(() => setPending(false));
    });
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
            disabled={pending || !query.trim()}
            onClick={handleSearch}
          >
            {pending ? "搜索中…" : "搜索"}
          </Button>
        </div>
      </div>

      <div className="min-h-[200px]">
        {results === null && !searched ? (
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
              return (
                <Card className="overflow-hidden" key={card.id} size="sm">
                  <div className="flex gap-0 sm:flex-row">
                    <div className="flex w-20 shrink-0 flex-col items-center justify-center border-border/60 border-b bg-muted/30 py-4 sm:border-r sm:border-b-0 sm:py-5">
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
                          <Link href={`/memory/${card.id}`}>打开</Link>
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
