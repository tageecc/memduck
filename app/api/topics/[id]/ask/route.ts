import { NextResponse } from "next/server";
import { askRequestSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { AskRequest } from "@/lib/memduck/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = askRequestSchema.safeParse(
    (await request.json()) as AskRequest,
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid ask request",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  return NextResponse.json(
    await service.ask({
      ...parsed.data,
      filters: {
        ...parsed.data.filters,
        topicIds: [id],
      },
    }),
  );
}
