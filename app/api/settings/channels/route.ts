import { NextResponse } from "next/server";

import { channelSettingsSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type {
  ChannelConnectionStatus,
  ChannelSettings,
} from "@/lib/memduck/service";

function toPublicChannels(settings: ChannelSettings) {
  return {
    extension: settings.extension,
    telegram: {
      ...settings.telegram,
      botToken: "",
      hasBotToken: Boolean(settings.telegram.botToken),
    },
    web: settings.web,
  };
}

function readConnectionStatus(
  service: Awaited<ReturnType<typeof getMemduckService>>,
) {
  return {
    extension: service.getChannelConnectionStatus("extension"),
    telegram: service.getChannelConnectionStatus("telegram"),
  } satisfies Record<string, ChannelConnectionStatus | null>;
}

export async function GET() {
  const service = await getMemduckService();
  return NextResponse.json({
    connectionStatus: readConnectionStatus(service),
    diagnostics: service.getRuntimeDiagnostics(),
    settings: toPublicChannels(service.getChannelSettings()),
  });
}

export async function POST(request: Request) {
  const service = await getMemduckService();
  const existing = service.getChannelSettings();
  const payload = (await request.json()) as Record<string, unknown>;
  const parsed = channelSettingsSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid channel settings", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  service.saveChannelSettings({
    ...parsed.data,
    telegram: {
      ...parsed.data.telegram,
      botToken:
        parsed.data.telegram.botToken || existing.telegram.botToken || "",
    },
  });

  return NextResponse.json({
    connectionStatus: readConnectionStatus(service),
    diagnostics: service.getRuntimeDiagnostics(),
    settings: toPublicChannels(service.getChannelSettings()),
  });
}
