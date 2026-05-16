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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function statusLabel(status: MemoryCard["status"]) {
  switch (status) {
    case "deep_ready":
      return "深度";
    case "quick_ready":
      return "已消化";
    case "saved":
      return "待消化";
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
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="line-clamp-2">{card.title}</CardTitle>
          <CardDescription className="line-clamp-3">
            {card.status === "saved"
              ? "内容尚未消化，点击「消化」处理。"
              : card.summary}
          </CardDescription>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" type="button" variant="ghost">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>操作</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => sendSignal("star")}>
                  <StarIcon />
                  收藏
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => sendSignal("highlight")}>
                  <BookmarkIcon />
                  标记
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => sendSignal("review_request")}>
                  <EyeIcon />
                  加入回看
                </DropdownMenuItem>
                {card.status === "saved" && (
                  <DropdownMenuItem
                    disabled={digesting}
                    onSelect={() => digest("quick")}
                  >
                    <ZapIcon />
                    快速消化
                  </DropdownMenuItem>
                )}
                {card.status !== "deep_ready" && (
                  <DropdownMenuItem
                    disabled={digesting}
                    onSelect={() => digest("deep")}
                  >
                    <ZapIcon />
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
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">{statusLabel(card.status)}</Badge>
          <Badge variant="outline">{card.sourceChannel}</Badge>
          {linkedTopics.slice(0, 2).map((topic) => (
            <Badge key={topic.id} variant="outline">
              {topic.name}
            </Badge>
          ))}
          {card.status === "saved" && (
            <Button
              disabled={digesting}
              onClick={() => digest("quick")}
              size="xs"
              type="button"
              variant="outline"
            >
              <ZapIcon data-icon="inline-start" />
              {digesting ? "消化中…" : "消化"}
            </Button>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/memory/${card.id}`}>打开</Link>
          </Button>
          {card.status !== "saved" && (
            <Button asChild size="sm">
              <Link
                href={buildAskHref({
                  cardId: card.id,
                  question: `"${card.title}" 最值得记住的是什么？`,
                })}
              >
                <BotIcon data-icon="inline-start" />
                Agent
              </Link>
            </Button>
          )}
          <span className="ml-auto text-muted-foreground text-xs">
            {new Date(card.createdAt).toLocaleDateString("zh-CN", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </CardFooter>
      </Card>

      <DeleteMemoryDialog
        cardId={card.id}
        onDeleted={onDeleted ?? (() => router.refresh())}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </>
  );
}
