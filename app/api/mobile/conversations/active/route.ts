import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";

export async function GET(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const service = await getMemduckService();
  const activeConversationId = service.getActiveConversationId();
  return NextResponse.json({
    activeConversationId,
    conversation: activeConversationId
      ? service.getConversationThread(activeConversationId)
      : null,
  });
}
