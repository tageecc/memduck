import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const service = await getMemduckService();
  const params = await context.params;
  const thread = service.getConversationThread(params.id);

  if (!thread) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(thread);
}
