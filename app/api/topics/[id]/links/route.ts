import { NextResponse } from "next/server";

import { topicLinkRemoveSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsed = topicLinkRemoveSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid topic link removal",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const service = await getMemduckService();
    const memoryCard = service.removeTopicLink({
      cardId: parsed.data.cardId,
      topicId: id,
    });
    return NextResponse.json({ memoryCard });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
