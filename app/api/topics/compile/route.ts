import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST() {
  const service = await getMemduckService();

  try {
    await service.compileKnowledge();
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "主题摘要暂时无法编译，请稍后重试。",
      },
      { status: 502 },
    );
  }
}
