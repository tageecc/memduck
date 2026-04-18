import { NextResponse } from "next/server";
import { inputEnvelopeSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { InputEnvelope } from "@/lib/memduck/service";

export async function POST(request: Request) {
  const parsed = inputEnvelopeSchema.safeParse(
    (await request.json()) as InputEnvelope,
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid ingest envelope",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  const result = await service.ingest(parsed.data);
  return NextResponse.json(result);
}
