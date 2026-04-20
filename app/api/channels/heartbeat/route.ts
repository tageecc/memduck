import { NextResponse } from "next/server";

import { sourceChannelSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(request: Request) {
  const service = await getMemduckService();
  const payload = (await request.json()) as {
    channel?: string;
    metadata?: Record<string, string>;
  };

  const parsedChannel = sourceChannelSchema.safeParse(payload.channel);
  if (!parsedChannel.success) {
    return NextResponse.json(
      { error: "Invalid channel heartbeat." },
      { status: 400 },
    );
  }

  service.recordChannelHeartbeat({
    channel: parsedChannel.data,
    metadata: payload.metadata ?? {},
    occurredAt: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    status: service.getChannelConnectionStatus(parsedChannel.data),
  });
}
