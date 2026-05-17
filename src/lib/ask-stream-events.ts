import type { Citation } from "./memduck/service";

export type AskStreamEvent = {
  citations?: Citation[];
  conversationId?: string;
  done?: boolean;
  error?: string;
  token?: string;
};

function parseAskStreamEvent(data: string): AskStreamEvent {
  try {
    return JSON.parse(data) as AskStreamEvent;
  } catch {
    throw new Error("Agent stream returned malformed data.");
  }
}

export async function* readAskStreamEvents(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<AskStreamEvent> {
  if (!body) {
    throw new Error("Stream unavailable.");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      yield parseAskStreamEvent(data);
    }
  }

  const remaining = buffer.trim();
  if (remaining.startsWith("data:")) {
    const data = remaining.slice(5).trim();
    if (data) {
      yield parseAskStreamEvent(data);
    }
  }
}
