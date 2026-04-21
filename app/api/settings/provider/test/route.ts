import { NextResponse } from "next/server";

import { providerSettingsSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(request: Request) {
  const service = await getMemduckService();
  const parsed = providerSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider settings", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const message = await service.testProviderSettings(parsed.data);
    return NextResponse.json({ message, ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Provider test failed.",
        ok: false,
      },
      { status: 400 },
    );
  }
}
