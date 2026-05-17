import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";

function localizeCompileError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "主题摘要暂时无法编译，请稍后重试。";

  if (/provider request timed out/i.test(message)) {
    return "主题摘要编译超时，请稍后重试或检查模型配置。";
  }

  return message;
}

export async function POST() {
  const service = await getMemduckService();

  try {
    await service.compileKnowledge();
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: localizeCompileError(error),
      },
      { status: 502 },
    );
  }
}
