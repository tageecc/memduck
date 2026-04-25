import { NextResponse } from "next/server";

import { providerProfileIdSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(request: Request) {
  const service = await getMemduckService();
  const parsed = providerProfileIdSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Provider profile id is required.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    service.setActiveProviderProfile(parsed.data.id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    activeProviderId: service.getActiveProviderProfile()?.id ?? null,
  });
}
