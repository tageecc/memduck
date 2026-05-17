import { NextResponse } from "next/server";

import { getChannelRuntimeReadiness } from "@/lib/channels/runtime-registry";
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
  const readiness = getChannelRuntimeReadiness(service.getChannelSettings())[
    parsed.data.channel
  ];

  if (!readiness?.ready) {
    return NextResponse.json(
      { error: "Channel is not enabled or fully configured." },
      { status: 409 },
    );
  }

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
