import { NextResponse } from "next/server";
import { readJsonRequest } from "@/lib/http/json-request";
import { askRequestSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { AskRequest } from "@/lib/memduck/service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = askRequestSchema.safeParse(json.body as AskRequest);
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
  try {
    return NextResponse.json(
      await service.ask({
        ...parsed.data,
        filters: {
          ...parsed.data.filters,
          topicIds: [id],
        },
      }),
    );
  } catch {
    return NextResponse.json(
      { error: "Agent 暂时无法回答，请稍后重试。" },
      { status: 502 },
    );
  }
}
