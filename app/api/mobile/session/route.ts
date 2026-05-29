import { NextResponse } from "next/server";

import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";

export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  return NextResponse.json(session);
}
