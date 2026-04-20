"use client";

import { startTransition, useMemo, useState } from "react";
import type {
  InputEnvelope,
  InputKind,
  RequestedDepth,
  SourceChannel,
} from "@/lib/memduck/service";

const kindLabels: Record<InputKind, string> = {
  image: "Image / Screenshot",
  text: "Text",
  url: "Link",
};

export function IngestComposer({ onSubmitted }: { onSubmitted?: () => void }) {
  const [kind, setKind] = useState<InputKind>("url");
  const [requestedDepth, setRequestedDepth] = useState<RequestedDepth>("quick");
  const [sourceChannel, setSourceChannel] = useState<SourceChannel>("web");
  const [value, setValue] = useState("");
  const [caption, setCaption] = useState("");
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const placeholder = useMemo(() => {
    if (kind === "url") return "Paste a link you want memduck to digest";
    if (kind === "text")
      return "Paste a long post, thread, notes, or copied excerpt";
    return "Choose an image file or let memduck simulate an object key";
  }, [kind]);

  async function submit() {
    if (kind === "image") {
      if (!selectedFile) {
        setResult("Choose an image file first.");
        return;
      }

      setPending(true);
      setResult(null);

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("requestedDepth", requestedDepth);
      formData.append("sourceChannel", sourceChannel);
      if (caption) {
        formData.append("caption", caption);
      }

      startTransition(() => {
        void fetch("/api/ingest", {
          body: formData,
          method: "POST",
        })
          .then(async (response) => {
            if (!response.ok) {
              throw new Error("Unable to store capture.");
            }
            return response.json();
          })
          .then((payload) => {
            setResult(`${payload.memoryCard.title} is now in your inbox.`);
            setCaption("");
            setFileName("");
            setSelectedFile(null);
            onSubmitted?.();
          })
          .catch((error: Error) => {
            setResult(error.message);
          })
          .finally(() => {
            setPending(false);
          });
      });
      return;
    }

    const envelope: InputEnvelope =
      kind === "url"
        ? {
            kind,
            payload: { url: value },
            requestedDepth,
            sourceChannel,
            sourceContext: caption ? { pageTitle: caption } : undefined,
          }
        : {
            kind,
            payload: { text: value },
            requestedDepth,
            sourceChannel,
            sourceContext: caption ? { caption } : undefined,
          };

    setPending(true);
    setResult(null);

    startTransition(() => {
      void fetch("/api/ingest", {
        body: JSON.stringify(envelope),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Unable to store capture.");
          }
          return response.json();
        })
        .then((payload) => {
          setResult(`${payload.memoryCard.title} is now in your inbox.`);
          setValue("");
          setCaption("");
          setFileName("");
          onSubmitted?.();
        })
        .catch((error: Error) => {
          setResult(error.message);
        })
        .finally(() => {
          setPending(false);
        });
    });
  }

  return (
    <section className="panel panel-emphasis">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Quick Ingest</p>
          <h2>Feed memduck without breaking your flow</h2>
        </div>
        <p className="panel-copy">
          Web, extension, and Telegram all use the same ingestion contract.
        </p>
      </div>

      <div className="choice-row">
        {(Object.keys(kindLabels) as InputKind[]).map((option) => (
          <button
            key={option}
            className={option === kind ? "chip chip-active" : "chip"}
            onClick={() => setKind(option)}
            type="button"
          >
            {kindLabels[option]}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Requested depth</span>
          <select
            value={requestedDepth}
            onChange={(event) =>
              setRequestedDepth(event.target.value as RequestedDepth)
            }
          >
            <option value="save">Save</option>
            <option value="quick">Quick analyze</option>
            <option value="deep">Deep analyze</option>
          </select>
        </label>

        <label className="field">
          <span>Source channel</span>
          <select
            value={sourceChannel}
            onChange={(event) =>
              setSourceChannel(event.target.value as SourceChannel)
            }
          >
            <option value="web">Web</option>
            <option value="extension">Extension</option>
            <option value="telegram">Telegram</option>
          </select>
        </label>
      </div>

      {kind === "image" ? (
        <div className="form-grid">
          <label className="field">
            <span>Image file</span>
            <input
              onChange={(event) => {
                const file = event.target.files?.[0];
                setSelectedFile(file ?? null);
                setFileName(file?.name ?? "");
              }}
              type="file"
            />
          </label>

          <label className="field">
            <span>Caption</span>
            <input
              onChange={(event) => setCaption(event.target.value)}
              placeholder="What is in this screenshot?"
              value={caption}
            />
          </label>
        </div>
      ) : (
        <label className="field">
          <span>{kind === "url" ? "Source" : "Content"}</span>
          <textarea
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            rows={kind === "url" ? 3 : 6}
            value={value}
          />
        </label>
      )}

      {kind !== "image" && (
        <label className="field">
          <span>{kind === "url" ? "Page title" : "Caption / note"}</span>
          <input
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Optional context to preserve"
            value={caption}
          />
        </label>
      )}

      <div className="action-row">
        <button
          className="primary-button"
          disabled={pending || (kind === "image" ? !fileName : !value.trim())}
          onClick={submit}
          type="button"
        >
          {pending ? "Digesting..." : "Send to memduck"}
        </button>
        {result ? <p className="action-result">{result}</p> : null}
      </div>
    </section>
  );
}
