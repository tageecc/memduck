import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";

export async function POST(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const service = await getMemduckService();
  service.clearActiveConversation();
  return NextResponse.json({ activeConversationId: null });
}
