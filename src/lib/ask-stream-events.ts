import type { Citation } from "./memduck/service";

export type AskStreamEvent = {
  citations?: Citation[];
  conversationId?: string;
  done?: boolean;
  error?: string;
  token?: string;
};

type AskStreamReaderOptions = {
  idleTimeoutMs?: number;
};

function parseAskStreamEvent(data: string): AskStreamEvent {
  try {
    return JSON.parse(data) as AskStreamEvent;
  } catch {
    throw new Error("Ask stream returned malformed data.");
  }
}

function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  idleTimeoutMs: number | undefined,
) {
  if (!idleTimeoutMs) {
    return reader.read();
  }

  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new DOMException("Ask stream timed out.", "TimeoutError"));
    }, idleTimeoutMs);
  });

  return Promise.race([reader.read(), timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

export async function* readAskStreamEvents(
  body: ReadableStream<Uint8Array> | null,
  options: AskStreamReaderOptions = {},
): AsyncGenerator<AskStreamEvent> {
  if (!body) {
    throw new Error("Stream unavailable.");
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await readWithIdleTimeout(
      reader,
      options.idleTimeoutMs,
    );
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
