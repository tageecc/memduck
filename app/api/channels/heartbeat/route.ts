import { NextResponse } from "next/server";

import { channelHeartbeatSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(request: Request) {
  const service = await getMemduckService();
  const parsed = channelHeartbeatSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid channel heartbeat.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
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
