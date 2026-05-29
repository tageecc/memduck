import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { askRequestSchema } from "@/lib/memduck/contracts";
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

  const parsed = askRequestSchema.safeParse(json.body);
  if (!parsed.success) {
    return mobileBadRequest(
      "Invalid mobile ask request.",
      parsed.error.flatten(),
    );
  }

  const service = await getMemduckService();
  return NextResponse.json(await service.ask(parsed.data));
}
