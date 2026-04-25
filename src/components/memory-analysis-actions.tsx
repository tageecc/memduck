"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { MemoryCard } from "@/lib/memduck/service";

export function MemoryAnalysisActions({
  cardId,
  status,
}: {
  cardId: string;
  status: MemoryCard["status"];
}) {
  const router = useRouter();
  const [pendingDepth, setPendingDepth] = useState<"deep" | "quick" | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canQuick = status === "saved";
  const canDeep = status !== "deep_ready";

  if (!canQuick && !canDeep) {
    return null;
  }

  async function runAnalysis(requestedDepth: "deep" | "quick") {
    setPendingDepth(requestedDepth);
    setStatusMessage(null);

    startTransition(() => {
      void fetch(`/api/memory-cards/${cardId}/analyze`, {
        body: JSON.stringify({ requestedDepth }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json()) as {
            error?: string;
          };

          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to analyze this card.");
          }

          router.refresh();
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPendingDepth(null);
        });
    });
  }

  return (
    <>
      <div className="action-row">
        {canQuick ? (
          <button
            className="secondary-button"
            disabled={Boolean(pendingDepth)}
            onClick={() => runAnalysis("quick")}
            type="button"
          >
            {pendingDepth === "quick" ? "Running quick..." : "Quick analyze"}
          </button>
        ) : null}
        {canDeep ? (
          <button
            className="primary-button"
            disabled={Boolean(pendingDepth)}
            onClick={() => runAnalysis("deep")}
            type="button"
          >
            {pendingDepth === "deep" ? "Running deep..." : "Deep analyze"}
          </button>
        ) : null}
      </div>
      {statusMessage ? <p className="action-result">{statusMessage}</p> : null}
    </>
  );
}
