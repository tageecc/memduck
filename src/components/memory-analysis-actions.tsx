"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
            throw new Error(payload.error ?? "消化失败，请重试。");
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {canQuick ? (
          <Button
            disabled={Boolean(pendingDepth)}
            onClick={() => runAnalysis("quick")}
            type="button"
            variant="outline"
          >
            {pendingDepth === "quick" ? "处理中..." : "快速消化"}
          </Button>
        ) : null}
        {canDeep ? (
          <Button
            disabled={Boolean(pendingDepth)}
            onClick={() => runAnalysis("deep")}
            type="button"
          >
            {pendingDepth === "deep" ? "处理中..." : "深度消化"}
          </Button>
        ) : null}
      </div>
      {statusMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{statusMessage}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
