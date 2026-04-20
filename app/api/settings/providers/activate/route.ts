import { NextResponse } from "next/server";

import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(request: Request) {
  const service = await getMemduckService();
  const payload = (await request.json()) as { id?: string };

  if (!payload.id) {
    return NextResponse.json(
      { error: "Provider profile id is required." },
      { status: 400 },
    );
  }

  service.setActiveProviderProfile(payload.id);

  return NextResponse.json({
    activeProviderId: service.getActiveProviderProfile()?.id ?? null,
  });
}
