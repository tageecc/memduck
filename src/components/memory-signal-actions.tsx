"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

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
      return "Highlighted";
    case "review_request":
      return "Queued for review";
    case "star":
      return "Starred";
    case "view":
      return "Viewed";
    default:
      return "Signal saved";
  }
}

function buttonLabel(
  type: Extract<UserSignalType, "highlight" | "review_request" | "star">,
) {
  switch (type) {
    case "highlight":
      return "Highlight";
    case "review_request":
      return "Review later";
    default:
      return "Star";
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
          throw new Error(payload.error ?? "Unable to save signal.");
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
            error instanceof Error ? error.message : "Unable to save signal.",
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
    <div
      className={
        compact
          ? "memory-signal-stack memory-signal-stack-compact"
          : "memory-signal-stack"
      }
    >
      <div className="action-row">
        {(["star", "highlight", "review_request"] as const).map((type) => (
          <button
            className="secondary-button"
            disabled={pendingType !== null}
            key={type}
            onClick={() => void sendSignal(type)}
            type="button"
          >
            {pendingType === type ? "Saving..." : buttonLabel(type)}
            {summary.counts[type] > 0 ? ` · ${summary.counts[type]}` : ""}
          </button>
        ))}
      </div>
      {!compact ? (
        <div className="signal-summary-grid">
          <div className="topic-card">
            <strong>{summary.total}</strong>
            <span>total explicit signals</span>
          </div>
          <div className="topic-card">
            <strong>{summary.counts.view}</strong>
            <span>views recorded</span>
          </div>
          <div className="topic-card">
            <strong>{summary.counts.review_request}</strong>
            <span>review requests</span>
          </div>
        </div>
      ) : null}
      {statusMessage ? <p className="action-result">{statusMessage}</p> : null}
    </div>
  );
}
