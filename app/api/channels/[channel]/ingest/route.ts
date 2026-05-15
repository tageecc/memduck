import { NextResponse } from "next/server";
import {
  getChannelCatalogEntry,
  isChannelCatalogId,
} from "@/lib/channels/catalog";
import { getChannelRuntimeAdapter } from "@/lib/channels/runtime-registry";
import { readJsonRequest } from "@/lib/http/json-request";
import { inputEnvelopeSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type {
  ChannelSettingsEntry,
  InputEnvelope,
} from "@/lib/memduck/service";

function isConfigured(channelId: string, setting?: ChannelSettingsEntry) {
  if (!isChannelCatalogId(channelId) || !setting?.enabled) {
    return false;
  }

  const channel = getChannelCatalogEntry(channelId);

  return channel.fields
    .filter((field) => field.required)
    .every((field) => Boolean(setting.values[field.key]?.trim()));
}

function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/, 2);

  if (scheme?.toLowerCase() === "bearer" && token?.trim()) {
    return token.trim();
  }

  return (
    request.headers.get("x-memduck-channel-token") ??
    request.headers.get("x-memduck-channel-secret") ??
    ""
  ).trim();
}

function isAuthorized(
  request: Request,
  channelId: string,
  setting: ChannelSettingsEntry,
) {
  if (!isChannelCatalogId(channelId)) {
    return false;
  }

  const secrets = getChannelCatalogEntry(channelId)
    .fields.filter((field) => field.secret)
    .map((field) => setting.values[field.key]?.trim())
    .filter((value): value is string => Boolean(value));

  if (secrets.length === 0) {
    return true;
  }

  const provided = readBearerToken(request);
  return Boolean(provided) && secrets.includes(provided);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ channel: string }> },
) {
  const { channel } = await context.params;

  if (!isChannelCatalogId(channel) || channel === "web") {
    return NextResponse.json(
      { error: "Unsupported channel ingest endpoint." },
      { status: 404 },
    );
  }

  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = inputEnvelopeSchema.safeParse(json.body as InputEnvelope);
  if (parsed.success && parsed.data.sourceChannel !== channel) {
    return NextResponse.json(
      {
        error: "Channel path and envelope sourceChannel must match.",
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  const settings = service.getChannelSettings();
  const channelSetting = settings.channels?.[channel];

  if (!channelSetting || !isConfigured(channel, channelSetting)) {
    return NextResponse.json(
      { error: "Channel is not enabled or fully configured." },
      { status: 409 },
    );
  }

  if (!isAuthorized(request, channel, channelSetting)) {
    return NextResponse.json(
      { error: "Channel authentication is required." },
      { status: 401 },
    );
  }

  const adapterEnvelope = parsed.success
    ? null
    : getChannelRuntimeAdapter(channel)?.parseWebhook?.(json.body);
  const envelope = parsed.success ? parsed.data : adapterEnvelope;

  if (!envelope) {
    return NextResponse.json(
      {
        error: "Invalid channel ingest envelope.",
        issues: parsed.success ? undefined : parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  service.recordChannelHeartbeat({
    channel,
    metadata: {
      ingress: "channel",
    },
    occurredAt: new Date().toISOString(),
  });

  const result = await service.ingest(envelope);
  return NextResponse.json(result);
}
