import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { mobileDeviceSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
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

  const parsed = mobileDeviceSchema.safeParse(json.body);
  if (!parsed.success) {
    return mobileBadRequest("Invalid mobile device.", parsed.error.flatten());
  }

  const service = await getMemduckService();
  return NextResponse.json(
    service.registerMobileDevice({
      accountId: session.account.id,
      ...parsed.data,
    }),
  );
}
