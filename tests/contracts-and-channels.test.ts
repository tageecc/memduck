import { describe, expect, it } from "vitest";

import { buildExtensionEnvelope } from "../src/lib/channels/extension";
import { parseTelegramMessage } from "../src/lib/channels/telegram";
import { buildAskHref } from "../src/lib/memduck/ask-link";
import {
  askRequestSchema,
  inputEnvelopeSchema,
  searchRequestSchema,
  signalRequestSchema,
} from "../src/lib/memduck/contracts";

describe("memduck contracts", () => {
  it("accepts valid envelopes across url, text, and image inputs", () => {
    const urlEnvelope = inputEnvelopeSchema.parse({
      kind: "url",
      payload: { url: "https://memduck.dev/story" },
      requestedDepth: "quick",
      sourceChannel: "web",
      sourceContext: { pageTitle: "memduck story" },
    });

    const textEnvelope = inputEnvelopeSchema.parse({
      kind: "text",
      payload: { text: "Personal memory systems need compression and recall." },
      requestedDepth: "save",
      sourceChannel: "extension",
    });

    const imageEnvelope = inputEnvelopeSchema.parse({
      kind: "image",
      payload: {
        fileName: "cluster.png",
        mimeType: "image/png",
        objectKey: "telegram/photo-1.png",
      },
      requestedDepth: "deep",
      sourceChannel: "telegram",
    });

    expect(urlEnvelope.kind).toBe("url");
    expect(textEnvelope.kind).toBe("text");
    expect(imageEnvelope.kind).toBe("image");
  });

  it("rejects malformed requests before they hit the service", () => {
    expect(() =>
      inputEnvelopeSchema.parse({
        kind: "url",
        payload: { url: "" },
        requestedDepth: "instant",
        sourceChannel: "web",
      }),
    ).toThrow();

    expect(() =>
      askRequestSchema.parse({
        question: "",
      }),
    ).toThrow();

    expect(() =>
      signalRequestSchema.parse({
        type: "save",
      }),
    ).toThrow();
  });

  it("serializes scoped Ask links with repeated card filters", () => {
    expect(
      buildAskHref({
        cardIds: ["card-a", "card-b"],
        question: "What matters in this review set?",
        topicId: "topic-1",
      }),
    ).toBe(
      "/ask?q=What+matters+in+this+review+set%3F&topicId=topic-1&cardId=card-a&cardId=card-b",
    );
  });

  it("accepts a dedicated search request contract with retrieval filters", () => {
    const request = searchRequestSchema.parse({
      filters: {
        sourceChannels: ["telegram"],
        topicIds: ["topic-1"],
      },
      limit: 4,
      query: "retrieval practice",
    });

    expect(request.query).toBe("retrieval practice");
    expect(request.limit).toBe(4);
    expect(request.filters?.sourceChannels).toEqual(["telegram"]);
  });
});

describe("extension channel helper", () => {
  it("prefers selected text when the popup is asked to save a snippet", () => {
    const envelope = buildExtensionEnvelope({
      mode: "deep",
      note: "keep the interesting paragraph",
      pageTitle: "How memory engines work",
      pageUrl: "https://example.com/memory-engines",
      selectionText: "A memory engine should digest before it archives.",
      useSelectionAsText: true,
    });

    expect(envelope.kind).toBe("text");
    expect(envelope.requestedDepth).toBe("deep");
    expect(envelope.payload).toEqual({
      text: "A memory engine should digest before it archives.",
    });
  });

  it("falls back to the page url when there is no selected text", () => {
    const envelope = buildExtensionEnvelope({
      mode: "save",
      note: "",
      pageTitle: "OpenClaw notes",
      pageUrl: "https://example.com/openclaw",
      selectionText: "",
      useSelectionAsText: true,
    });

    expect(envelope.kind).toBe("url");
    expect(envelope.payload).toEqual({
      url: "https://example.com/openclaw",
    });
  });
});

describe("telegram channel helper", () => {
  it("parses commands, urls, free text, and photos into memduck actions", () => {
    expect(parseTelegramMessage({ text: "/review" })).toEqual({
      kind: "review",
    });

    expect(
      parseTelegramMessage({ text: "/ask what have I saved about memory?" }),
    ).toEqual({
      kind: "ask",
      question: "what have I saved about memory?",
    });

    expect(
      parseTelegramMessage({ text: "/search retrieval practice" }),
    ).toEqual({
      kind: "search",
      query: "retrieval practice",
    });

    expect(parseTelegramMessage({ text: "/recent" })).toEqual({
      kind: "recent",
    });

    expect(
      parseTelegramMessage({ text: "/deep https://example.com/deeper-memory" }),
    ).toMatchObject({
      envelope: {
        kind: "url",
        payload: { url: "https://example.com/deeper-memory" },
        requestedDepth: "deep",
        sourceChannel: "telegram",
      },
      kind: "ingest",
    });

    expect(
      parseTelegramMessage({ text: "https://example.com/retrieval-practice" }),
    ).toMatchObject({
      envelope: {
        kind: "url",
        payload: { url: "https://example.com/retrieval-practice" },
        requestedDepth: "quick",
        sourceChannel: "telegram",
      },
      kind: "ingest",
    });

    expect(
      parseTelegramMessage({
        caption: "whiteboard screenshot",
        photoFileId: "abc123",
      }),
    ).toMatchObject({
      envelope: {
        kind: "image",
        payload: {
          fileName: "telegram-abc123.jpg",
          mimeType: "image/jpeg",
          objectKey: "telegram/abc123.jpg",
        },
        sourceChannel: "telegram",
      },
      kind: "ingest",
    });
  });
});
