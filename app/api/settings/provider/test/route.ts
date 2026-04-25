import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { providerSettingsSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = providerSettingsSchema.safeParse(json.body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider settings", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const service = await getMemduckService();
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
