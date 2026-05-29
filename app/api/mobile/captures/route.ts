import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { inputEnvelopeSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { InputEnvelope } from "@/lib/memduck/service";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileBadRequest, mobileUnauthorized } from "@/lib/mobile/responses";

export async function POST(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const body = json.body as Omit<InputEnvelope, "sourceChannel">;
  const parsed = inputEnvelopeSchema.safeParse({
    ...body,
    sourceChannel: "ios",
  });
  if (!parsed.success) {
    return mobileBadRequest("Invalid mobile capture.", parsed.error.flatten());
  }

  const service = await getMemduckService();
  service.recordChannelHeartbeat({
    channel: "ios",
    metadata: { accountId: session.account.id, ingress: "mobile" },
    occurredAt: new Date().toISOString(),
  });

  return NextResponse.json(await service.ingest(parsed.data));
}
