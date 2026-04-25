import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
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
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = channelSettingsSchema.safeParse(json.body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid channel settings", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  service.saveChannelSettings(parsed.data);

  return NextResponse.json({
    connectionStatus: readConnectionStatus(service),
    diagnostics: service.getRuntimeDiagnostics(),
    settings: toPublicChannels(service.getChannelSettings()),
  });
}
