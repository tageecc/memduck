import { NextResponse } from "next/server";
import { readJsonRequest } from "@/lib/http/json-request";
import { signalRequestSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { UserSignal } from "@/lib/memduck/service";

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = signalRequestSchema.safeParse(
    json.body as Omit<UserSignal, "createdAt" | "id">,
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid signal payload",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  service.recordSignal({
    ...parsed.data,
    createdAt: new Date(),
    id: `signal-api-${Date.now()}`,
  });
  return NextResponse.json({
    ok: true,
    summary: service.getCardSignalSummary(parsed.data.cardId),
  });
}
