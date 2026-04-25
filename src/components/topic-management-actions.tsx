"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import type { Topic } from "@/lib/memduck/service";

export function TopicManagementActions({
  topic,
  topics,
}: {
  topic: Topic;
  topics: Topic[];
}) {
  const router = useRouter();
  const [name, setName] = useState(topic.name);
  const [keywords, setKeywords] = useState(topic.keywords.join(", "));
  const [targetTopicId, setTargetTopicId] = useState("");
  const [pendingAction, setPendingAction] = useState<"merge" | "rename" | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const mergeTargets = topics.filter((entry) => entry.id !== topic.id);

  async function renameTopic() {
    setPendingAction("rename");
    setStatusMessage(null);

    startTransition(() => {
      void fetch(`/api/topics/${topic.id}`, {
        body: JSON.stringify({
          keywords: keywords
            .split(",")
            .map((keyword) => keyword.trim())
            .filter(Boolean),
          name,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      })
        .then(async (response) => {
          const payload = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to rename topic.");
          }

          router.refresh();
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPendingAction(null);
        });
    });
  }

  async function mergeTopic() {
    setPendingAction("merge");
    setStatusMessage(null);

    startTransition(() => {
      void fetch(`/api/topics/${topic.id}/merge`, {
        body: JSON.stringify({
          targetTopicId,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      })
        .then(async (response) => {
          const payload = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to merge topic.");
          }

          router.refresh();
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPendingAction(null);
        });
    });
  }

  return (
    <div className="topic-list">
      <label className="field">
        <span>Name</span>
        <input onChange={(event) => setName(event.target.value)} value={name} />
      </label>
      <label className="field">
        <span>Keywords</span>
        <input
          onChange={(event) => setKeywords(event.target.value)}
          value={keywords}
        />
      </label>
      <div className="action-row">
        <button
          className="secondary-button"
          disabled={Boolean(pendingAction) || !name.trim() || !keywords.trim()}
          onClick={renameTopic}
          type="button"
        >
          {pendingAction === "rename" ? "Renaming..." : "Rename topic"}
        </button>
      </div>
      {mergeTargets.length > 0 ? (
        <>
          <label className="field">
            <span>Merge into</span>
            <select
              onChange={(event) => setTargetTopicId(event.target.value)}
              value={targetTopicId}
            >
              <option value="">Choose target topic</option>
              {mergeTargets.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <div className="action-row">
            <button
              className="secondary-button"
              disabled={Boolean(pendingAction) || !targetTopicId}
              onClick={mergeTopic}
              type="button"
            >
              {pendingAction === "merge" ? "Merging..." : "Merge topic"}
            </button>
          </div>
        </>
      ) : null}
      {statusMessage ? <p className="action-result">{statusMessage}</p> : null}
    </div>
  );
}

export function TopicUnlinkAction({
  cardId,
  topicId,
}: {
  cardId: string;
  topicId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function unlink() {
    setPending(true);
    setStatusMessage(null);

    startTransition(() => {
      void fetch(`/api/topics/${topicId}/links`, {
        body: JSON.stringify({ cardId }),
        headers: {
          "content-type": "application/json",
        },
        method: "DELETE",
      })
        .then(async (response) => {
          const payload = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(payload.error ?? "Unable to remove topic link.");
          }

          router.refresh();
        })
        .catch((error: Error) => {
          setStatusMessage(error.message);
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  return (
    <>
      <button
        className="secondary-button"
        disabled={pending}
        onClick={unlink}
        type="button"
      >
        {pending ? "Removing..." : "Remove link"}
      </button>
      {statusMessage ? <p className="action-result">{statusMessage}</p> : null}
    </>
  );
}
