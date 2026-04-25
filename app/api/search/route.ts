import { NextResponse } from "next/server";

import { searchRequestSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(request: Request) {
  const parsed = searchRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid search request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  return NextResponse.json(
    await service.retrieveCards({
      filters: parsed.data.filters,
      limit: parsed.data.limit ?? 5,
      query: parsed.data.query,
    }),
  );
}
