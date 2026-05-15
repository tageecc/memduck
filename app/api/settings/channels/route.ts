import { NextResponse } from "next/server";
import {
  channelCatalog,
  getChannelCatalogEntry,
  isChannelCatalogId,
} from "@/lib/channels/catalog";
import { getChannelRuntimeReadiness } from "@/lib/channels/runtime-registry";
import { readJsonRequest } from "@/lib/http/json-request";
import { channelSettingsSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type {
  ChannelConnectionStatus,
  ChannelSettings,
} from "@/lib/memduck/service";

function toPublicChannels(settings: ChannelSettings) {
  const channelSettings = settings.channels ?? {};
  const channels = Object.fromEntries(
    channelCatalog.map((channel) => {
      const setting = channelSettings[channel.id] ?? {
        enabled: false,
        values: {},
      };
      const values = { ...setting.values };
      const secrets = Object.fromEntries(
        channel.fields
          .filter((field) => field.secret)
          .map((field) => {
            const hasValue = Boolean(values[field.key]?.trim());
            values[field.key] = "";
            return [field.key, hasValue];
          }),
      );

      return [
        channel.id,
        {
          enabled: setting.enabled,
          secrets,
          values,
        },
      ];
    }),
  );

  return {
    channels,
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
  return Object.fromEntries(
    channelCatalog.map((channel) => [
      channel.id,
      service.getChannelConnectionStatus(channel.id),
    ]),
  ) satisfies Record<string, ChannelConnectionStatus | null>;
}

function stripUnchangedSecrets(settings: unknown) {
  if (!settings || typeof settings !== "object") {
    return settings;
  }

  const payload = settings as {
    channels?: Record<
      string,
      { enabled?: boolean; values?: Record<string, string> }
    >;
  };

  if (!payload.channels) {
    return settings;
  }

  return {
    ...payload,
    channels: Object.fromEntries(
      Object.entries(payload.channels).map(([channelId, setting]) => {
        const values = { ...(setting.values ?? {}) };

        if (isChannelCatalogId(channelId)) {
          const entry = getChannelCatalogEntry(channelId);
          for (const field of entry.fields) {
            if (field.secret && values[field.key] === "") {
              delete values[field.key];
            }
          }
        }

        return [
          channelId,
          {
            ...setting,
            values,
          },
        ];
      }),
    ),
  };
}

export async function GET() {
  const service = await getMemduckService();
  return NextResponse.json({
    catalog: channelCatalog,
    connectionStatus: readConnectionStatus(service),
    diagnostics: service.getRuntimeDiagnostics(),
    runtimeReadiness: getChannelRuntimeReadiness(service.getChannelSettings()),
    settings: toPublicChannels(service.getChannelSettings()),
  });
}

export async function POST(request: Request) {
  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = channelSettingsSchema.safeParse(
    stripUnchangedSecrets(json.body),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid channel settings", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  service.saveChannelSettings(parsed.data);

  return NextResponse.json({
    catalog: channelCatalog,
    connectionStatus: readConnectionStatus(service),
    diagnostics: service.getRuntimeDiagnostics(),
    runtimeReadiness: getChannelRuntimeReadiness(service.getChannelSettings()),
    settings: toPublicChannels(service.getChannelSettings()),
  });
}
