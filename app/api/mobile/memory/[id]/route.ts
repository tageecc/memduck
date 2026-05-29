import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const { id } = await context.params;
  const service = await getMemduckService();
  const memoryCard = service.getMemoryCard(id);
  if (!memoryCard) {
    return NextResponse.json(
      { error: "Memory card not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    memoryCard,
    sourceChunks: service.listSourceChunks(memoryCard.sourceItemId),
  });
}
