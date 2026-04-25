import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { channelHeartbeatSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = channelHeartbeatSchema.safeParse(json.body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid channel heartbeat.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  service.recordChannelHeartbeat({
    channel: parsed.data.channel,
    metadata: parsed.data.metadata,
    occurredAt: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    status: service.getChannelConnectionStatus(parsed.data.channel),
  });
}
