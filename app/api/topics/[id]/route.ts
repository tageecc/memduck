import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { topicUpdateSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = topicUpdateSchema.safeParse(json.body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid topic update",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const service = await getMemduckService();
    const topic = service.renameTopic(id, parsed.data);
    return NextResponse.json({ topic });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
