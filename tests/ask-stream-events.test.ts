import { describe, expect, it } from "vitest";

import { readAskStreamEvents } from "../src/lib/ask-stream-events";

function streamFromText(value: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

describe("readAskStreamEvents", () => {
  it("parses server-sent ask stream events", async () => {
    const events = [];

    for await (const event of readAskStreamEvents(
      streamFromText(
        'data: {"conversationId":"conversation-1"}\n\n' +
          'data: {"token":"hello"}\n\n',
      ),
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      { conversationId: "conversation-1" },
      { token: "hello" },
    ]);
  });

  it("reports malformed ask stream events as recoverable errors", async () => {
    const events = readAskStreamEvents(streamFromText("data: {not-json}\n\n"));

    await expect(async () => {
      for await (const _event of events) {
        // exhaust the stream
      }
    }).rejects.toThrow("Agent stream returned malformed data.");
  });

  it("times out when the stream stops producing events", async () => {
    const stream = new ReadableStream<Uint8Array>();
    const events = readAskStreamEvents(stream, { idleTimeoutMs: 5 });

    await expect(async () => {
      for await (const _event of events) {
        // exhaust the stream
      }
    }).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
