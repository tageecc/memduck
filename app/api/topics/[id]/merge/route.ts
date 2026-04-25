import { NextResponse } from "next/server";

import { topicMergeSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = topicMergeSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid topic merge",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const service = await getMemduckService();
    const topic = service.mergeTopics({
      sourceTopicId: id,
      targetTopicId: parsed.data.targetTopicId,
    });
    return NextResponse.json({ topic });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
