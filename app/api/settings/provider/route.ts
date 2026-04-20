import { NextResponse } from "next/server";

import { providerSettingsSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { ProviderSettings } from "@/lib/memduck/service";

function maskSecret(secret?: string): string {
  if (!secret) {
    return "";
  }

  if (secret.length <= 8) {
    return "••••••••";
  }

  return `${secret.slice(0, 4)}••••${secret.slice(-2)}`;
}

function toPublicSettings(settings: ProviderSettings | null) {
  if (!settings) {
    return null;
  }

  if (settings.kind === "mock") {
    return { kind: "mock" as const };
  }

  return {
    answerModel: settings.answerModel ?? "",
    apiKey: "",
    apiKeyMasked: maskSecret(settings.apiKey),
    baseUrl: settings.baseUrl ?? "",
    hasApiKey: Boolean(settings.apiKey),
    kind: settings.kind,
    summarizeModel: settings.summarizeModel ?? "",
    visionModel: settings.visionModel ?? "",
  };
}

export async function GET() {
  const service = await getMemduckService();
  return NextResponse.json({
    settings: toPublicSettings(service.getProviderSettings()),
  });
}

export async function POST(request: Request) {
  const service = await getMemduckService();
  const existing = service.getProviderSettings();
  const parsed = providerSettingsSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider settings", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const settings =
    parsed.data.kind !== "mock" && !parsed.data.apiKey && existing
      ? {
          ...parsed.data,
          apiKey: existing.kind !== "mock" ? (existing.apiKey ?? "") : "",
        }
      : parsed.data;

  service.saveProviderSettings(settings);

  return NextResponse.json({
    settings: toPublicSettings(service.getProviderSettings()),
    setupState: service.getSetupState(),
  });
}
