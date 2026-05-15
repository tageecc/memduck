import { readJsonRequest } from "@/lib/http/json-request";
import { askRequestSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { AskRequest } from "@/lib/memduck/service";

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = askRequestSchema.safeParse(json.body as AskRequest);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid ask request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  const stream = service.askStream(parsed.data);

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const line = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(line));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "cache-control": "no-cache",
      "content-type": "text/event-stream",
      "x-accel-buffering": "no",
    },
  });
}
