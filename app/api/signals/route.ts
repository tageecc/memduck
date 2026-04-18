import { NextResponse } from "next/server";
import { signalRequestSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { UserSignal } from "@/lib/memduck/service";

export async function POST(request: Request) {
  const parsed = signalRequestSchema.safeParse(
    (await request.json()) as Omit<UserSignal, "createdAt" | "id">,
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
  return NextResponse.json({ ok: true });
}
