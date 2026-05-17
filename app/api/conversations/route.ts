import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { conversationTurnSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function GET() {
  const service = await getMemduckService();
  return NextResponse.json({
    conversations: service.listConversations(),
  });
}

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = conversationTurnSchema.safeParse(json.body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid conversation turn.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  return NextResponse.json(service.recordConversationTurn(parsed.data));
}
