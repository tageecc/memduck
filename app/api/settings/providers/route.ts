import { NextResponse } from "next/server";

import { readJsonRequest } from "@/lib/http/json-request";
import {
  providerProfileIdSchema,
  providerProfileRequestSchema,
} from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { ProviderProfile } from "@/lib/memduck/service";
import { buildProviderSettings } from "@/lib/providers/provider-presets";

function maskSecret(secret?: string): string {
  if (!secret) {
    return "";
  }

  if (secret.length <= 8) {
    return "••••••••";
  }

  return `${secret.slice(0, 4)}••••${secret.slice(-2)}`;
}

function toPublicProfile(profile: ProviderProfile) {
  return {
    answerModel: profile.answerModel,
    apiKey: "",
    apiKeyMasked: maskSecret(profile.apiKey),
    baseUrl: profile.baseUrl,
    createdAt: profile.createdAt,
    embeddingModel: profile.embeddingModel,
    hasApiKey: Boolean(profile.apiKey),
    id: profile.id,
    kind: profile.kind,
    model: profile.model,
    name: profile.name,
    providerId: profile.providerId,
    rerankModel: profile.rerankModel,
    summarizeModel: profile.summarizeModel,
    updatedAt: profile.updatedAt,
    visionModel: profile.visionModel,
  };
}

export async function GET() {
  const service = await getMemduckService();

  return NextResponse.json({
    activeProviderId: service.getActiveProviderProfile()?.id ?? null,
    profiles: service.listProviderProfiles().map(toPublicProfile),
  });
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
  const parsed = providerProfileRequestSchema.safeParse(payloadWithSavedSecret);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider profile", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, makeActive = true, name, ...settingsInput } = parsed.data;
  const profileId = id ?? globalThis.crypto.randomUUID();
  let settings: ReturnType<typeof buildProviderSettings>;
  try {
    settings = buildProviderSettings(settingsInput);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const saved = service.saveProviderProfile(
    {
      ...settings,
      id: profileId,
      name,
    },
    { makeActive },
  );

  return NextResponse.json({
    activeProviderId: service.getActiveProviderProfile()?.id ?? null,
    profile: toPublicProfile(saved),
    profiles: service.listProviderProfiles().map(toPublicProfile),
  });
}

export async function DELETE(request: Request) {
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
    service.deleteProviderProfile(parsed.data.id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    activeProviderId: service.getActiveProviderProfile()?.id ?? null,
    profiles: service.listProviderProfiles().map(toPublicProfile),
  });
}
