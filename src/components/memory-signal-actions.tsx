"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CardSignalSummary, UserSignalType } from "@/lib/memduck/service";

function emptySignalSummary(cardId: string): CardSignalSummary {
  return {
    cardId,
    counts: {
      ask: 0,
      follow_up: 0,
      highlight: 0,
      review_request: 0,
      save: 0,
      star: 0,
      view: 0,
    },
    lastSignalAt: null,
    total: 0,
  };
}

function labelForType(type: UserSignalType) {
  switch (type) {
    case "highlight":
      return "已标记";
    case "review_request":
      return "已加入回看";
    case "star":
      return "已收藏";
    case "view":
      return "已查看";
    default:
      return "已保存";
  }
}

function buttonLabel(
  type: Extract<UserSignalType, "highlight" | "review_request" | "star">,
) {
  switch (type) {
    case "highlight":
      return "标记";
    case "review_request":
      return "回看";
    default:
      return "收藏";
  }
}

export function MemorySignalActions({
  cardId,
  compact = false,
  initialSummary,
  recordViewOnMount = false,
  topicId,
}: {
  cardId: string;
  compact?: boolean;
  initialSummary?: CardSignalSummary;
  recordViewOnMount?: boolean;
  topicId?: string;
}) {
  const [summary, setSummary] = useState<CardSignalSummary>(
    initialSummary ?? emptySignalSummary(cardId),
  );
  const [pendingType, setPendingType] = useState<UserSignalType | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const hasRecordedView = useRef(false);

  const sendSignal = useEffectEvent(
    async (type: UserSignalType, options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setPendingType(type);
        setStatusMessage(null);
      }

      try {
        const response = await fetch("/api/signals", {
          body: JSON.stringify({
            cardId,
            topicId,
            type,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json()) as {
          error?: string;
          summary?: CardSignalSummary;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "信号记录失败。");
        }

        if (payload.summary) {
          setSummary(payload.summary);
        }

        if (!options.silent) {
          setStatusMessage(labelForType(type));
        }
      } catch (error) {
        if (!options.silent) {
          setStatusMessage(
            error instanceof Error ? error.message : "信号记录失败。",
          );
        }
      } finally {
        if (!options.silent) {
          setPendingType(null);
        }
      }
    },
  );

  useEffect(() => {
    if (!recordViewOnMount || hasRecordedView.current) {
      return;
    }

    hasRecordedView.current = true;
    void sendSignal("view", { silent: true });
  }, [recordViewOnMount]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["star", "highlight", "review_request"] as const).map((type) => (
          <Button
            disabled={pendingType !== null}
            key={type}
            onClick={() => void sendSignal(type)}
            type="button"
            variant="outline"
          >
            {pendingType === type ? "保存中..." : buttonLabel(type)}
            {summary.counts[type] > 0 ? ` · ${summary.counts[type]}` : ""}
          </Button>
        ))}
      </div>
      {!compact ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{summary.total} 操作</Badge>
          <Badge variant="outline">{summary.counts.view} 查看</Badge>
          <Badge variant="outline">{summary.counts.review_request} 回看</Badge>
        </div>
      ) : null}
      {statusMessage ? (
        <Alert>
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
