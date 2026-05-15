import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { providerSettingsSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import { buildProviderSettings } from "@/lib/providers/provider-presets";

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
    await service.testProviderSettings(buildProviderSettings(parsed.data));

    return NextResponse.json({
      message: "Provider connection verified.",
      ok: true,
    });
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
