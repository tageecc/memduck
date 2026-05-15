"use client";

import {
  BookmarkIcon,
  BotIcon,
  EyeIcon,
  MoreHorizontalIcon,
  StarIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { DeleteMemoryDialog } from "@/components/delete-memory-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildAskHref } from "@/lib/memduck/ask-link";
import type { MemoryCard, Topic } from "@/lib/memduck/service";
import { cn } from "@/lib/utils";

function statusMeta(status: MemoryCard["status"]): {
  color: string;
  label: string;
  textClass: string;
} {
  switch (status) {
    case "deep_ready":
      return {
        color: "oklch(0.48 0.13 265)",
        label: "深度",
        textClass: "text-status-deep",
      };
    case "quick_ready":
      return {
        color: "oklch(0.54 0.11 178)",
        label: "已消化",
        textClass: "text-status-quick",
      };
    case "saved":
      return {
        color: "oklch(0.68 0.15 70)",
        label: "待消化",
        textClass: "text-status-pending",
      };
  }
}

export function MemoryCardPreview({
  card,
  onDeleted,
  topics,
}: {
  card: MemoryCard;
  onDeleted?: () => void;
  topics: Topic[];
}) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [digesting, setDigesting] = useState(false);
  const linkedTopics = topics.filter((t) => card.topicIds.includes(t.id));
  const meta = statusMeta(card.status);

  function digest(depth: "deep" | "quick") {
    setDigesting(true);
    startTransition(() => {
      void fetch(`/api/memory-cards/${card.id}/analyze`, {
        body: JSON.stringify({ requestedDepth: depth }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(() => router.refresh())
        .finally(() => setDigesting(false));
    });
  }

  function sendSignal(type: "highlight" | "review_request" | "star") {
    void fetch("/api/signals", {
      body: JSON.stringify({ cardId: card.id, type }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
  }

  return (
    <>
      <article
        className={cn(
          "group/card relative flex flex-col overflow-hidden rounded-lg bg-card",
          "shadow-[0_1px_3px_0_rgb(0_0_0/0.05),0_0_0_1px_rgb(0_0_0/0.06)]",
          "transition-shadow duration-150 hover:shadow-[0_4px_12px_0_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.07)]",
        )}
        style={{ borderLeft: `2.5px solid ${meta.color}` }}
      >
        {/* card header */}
        <div className="flex items-start gap-2 px-4 pt-4 pb-0">
          <h3 className="min-w-0 flex-1 text-[0.875rem] font-semibold leading-snug tracking-tight text-foreground line-clamp-2">
            {card.title}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="mt-px size-6 shrink-0 rounded opacity-0 text-muted-foreground/40 transition-opacity group-hover/card:opacity-100 data-[state=open]:opacity-100 hover:text-foreground hover:bg-muted"
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <MoreHorizontalIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-[0.7rem] font-normal text-muted-foreground">
                操作
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => sendSignal("star")}>
                <StarIcon className="size-3.5" />
                收藏
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => sendSignal("highlight")}>
                <BookmarkIcon className="size-3.5" />
                标记
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => sendSignal("review_request")}>
                <EyeIcon className="size-3.5" />
                加入回看
              </DropdownMenuItem>
              {card.status === "saved" && (
                <DropdownMenuItem
                  disabled={digesting}
                  onSelect={() => digest("quick")}
                >
                  <ZapIcon className="size-3.5" />
                  快速消化
                </DropdownMenuItem>
              )}
              {card.status !== "deep_ready" && (
                <DropdownMenuItem
                  disabled={digesting}
                  onSelect={() => digest("deep")}
                >
                  <ZapIcon className="size-3.5 text-status-deep" />
                  深度消化
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteOpen(true);
                }}
              >
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* summary */}
        <p className="px-4 pt-2 pb-3 text-[0.8rem] leading-relaxed text-muted-foreground line-clamp-2">
          {card.status === "saved"
            ? "内容尚未消化，点击「消化」处理。"
            : card.summary}
        </p>

        {/* meta tags */}
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[0.67rem] font-semibold tracking-wide",
              meta.textClass,
            )}
            style={{
              background: `color-mix(in oklch, ${meta.color} 10%, transparent)`,
            }}
          >
            {meta.label}
          </span>
          <span className="rounded border border-border/60 bg-transparent px-1.5 py-0.5 text-[0.67rem] font-normal text-muted-foreground">
            {card.sourceChannel}
          </span>
          {linkedTopics.slice(0, 2).map((topic) => (
            <span
              className="rounded bg-muted/70 px-1.5 py-0.5 text-[0.67rem] text-muted-foreground"
              key={topic.id}
            >
              {topic.name}
            </span>
          ))}
          {card.status === "saved" && (
            <button
              className={cn(
                "ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-[0.67rem] font-semibold transition-colors disabled:opacity-50",
                "text-status-pending hover:bg-status-pending/10",
              )}
              disabled={digesting}
              onClick={() => digest("quick")}
              type="button"
            >
              <ZapIcon className="size-2.5" />
              {digesting ? "消化中…" : "消化"}
            </button>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center gap-1.5 border-t border-border/40 bg-muted/25 px-3 py-2">
          <Button
            asChild
            className="h-6 rounded px-2.5 text-[0.75rem] border-border/50"
            size="sm"
            variant="outline"
          >
            <Link href={`/memory/${card.id}`}>打开</Link>
          </Button>
          {card.status !== "saved" && (
            <Button
              asChild
              className="h-6 rounded px-2.5 text-[0.75rem]"
              size="sm"
            >
              <Link
                href={buildAskHref({
                  cardId: card.id,
                  question: `"${card.title}" 最值得记住的是什么？`,
                })}
              >
                <BotIcon className="size-2.5" />
                Agent
              </Link>
            </Button>
          )}
          <span className="ml-auto font-mono text-[0.63rem] tabular-nums text-muted-foreground/40">
            {new Date(card.createdAt).toLocaleDateString("zh-CN", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </article>

      <DeleteMemoryDialog
        cardId={card.id}
        onDeleted={onDeleted ?? (() => router.refresh())}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </>
  );
}
