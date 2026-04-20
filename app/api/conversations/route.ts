import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";

export async function GET() {
  const service = await getMemduckService();
  return NextResponse.json({
    conversations: service.listConversations(),
  });
}
