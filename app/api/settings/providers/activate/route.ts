import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { providerProfileIdSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = providerProfileIdSchema.safeParse(json.body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Provider profile id is required.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
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
