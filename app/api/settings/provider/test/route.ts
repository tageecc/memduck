import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import { providerSettingsSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import { buildProviderSettings } from "@/lib/providers/provider-presets";

function localizeProviderTestError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Provider 连接测试失败。";

  if (/provider request timed out/i.test(message)) {
    return "Provider 连接测试超时，请稍后重试或检查模型配置。";
  }

  return message;
}

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const service = await getMemduckService();
  const payload = json.body as Record<string, unknown>;
  const existingProfile =
    typeof payload.id === "string"
      ? service
          .listProviderProfiles()
          .find((profile) => profile.id === payload.id)
      : null;
  const payloadWithSavedSecret =
    existingProfile &&
    existingProfile.providerId === payload.providerId &&
    !payload.apiKey?.toString().trim()
      ? { ...payload, apiKey: existingProfile.apiKey }
      : payload;
  const { id: _id, ...settingsPayload } = payloadWithSavedSecret;
  const parsed = providerSettingsSchema.safeParse(settingsPayload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider settings", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await service.testProviderSettings(buildProviderSettings(parsed.data));

    return NextResponse.json({
      message: "Provider connection verified.",
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: localizeProviderTestError(error),
        ok: false,
      },
      { status: 400 },
    );
  }
}
