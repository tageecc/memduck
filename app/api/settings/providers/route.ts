import { NextResponse } from "next/server";

import {
  providerProfileIdSchema,
  providerProfileSchema,
} from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import type { ProviderProfile } from "@/lib/memduck/service";

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
    name: profile.name,
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
  const service = await getMemduckService();
  const payload = (await request.json()) as Record<string, unknown>;
  const parsed = providerProfileSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid provider profile", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const makeActive = payload.makeActive !== false;
  const profileId = parsed.data.id ?? globalThis.crypto.randomUUID();
  const saved = service.saveProviderProfile(
    {
      ...parsed.data,
      id: profileId,
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
  const service = await getMemduckService();
  const parsed = providerProfileIdSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Provider profile id is required.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

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
