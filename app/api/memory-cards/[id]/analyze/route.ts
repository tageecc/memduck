import { NextResponse } from "next/server";
import { z } from "zod";

import { readJsonRequest } from "@/lib/http/json-request";
import { getMemduckService } from "@/lib/memduck/runtime";

const analyzeRequestSchema = z.object({
  requestedDepth: z.enum(["deep", "quick"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = analyzeRequestSchema.safeParse(json.body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid analyze request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const service = await getMemduckService();
    const memoryCard = await service.analyzeMemoryCard(
      id,
      parsed.data.requestedDepth,
    );

    return NextResponse.json({ memoryCard });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
