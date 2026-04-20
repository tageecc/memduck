import { NextResponse } from "next/server";

import { providerProfileSchema } from "@/lib/memduck/contracts";
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
  if (profile.kind === "mock") {
    return {
      createdAt: profile.createdAt,
      id: profile.id,
      kind: profile.kind,
      name: profile.name,
      updatedAt: profile.updatedAt,
    };
  }

  return {
    answerModel: profile.answerModel ?? "",
    apiKey: "",
    apiKeyMasked: maskSecret(profile.apiKey),
    baseUrl: profile.baseUrl ?? "",
    createdAt: profile.createdAt,
    embeddingModel: profile.embeddingModel ?? "",
    hasApiKey: Boolean(profile.apiKey),
    id: profile.id,
    kind: profile.kind,
    name: profile.name,
    rerankModel: profile.rerankModel ?? "",
    summarizeModel: profile.summarizeModel ?? "",
    updatedAt: profile.updatedAt,
    visionModel: profile.visionModel ?? "",
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
  const profileId =
    parsed.data.id ??
    `${parsed.data.kind}-${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const existing = service
    .listProviderProfiles()
    .find((profile) => profile.id === profileId);

  const profile =
    parsed.data.kind !== "mock" && !parsed.data.apiKey && existing
      ? {
          ...parsed.data,
          apiKey: existing.kind !== "mock" ? (existing.apiKey ?? "") : "",
          id: profileId,
        }
      : {
          ...parsed.data,
          id: profileId,
        };

  const saved = service.saveProviderProfile(profile, { makeActive });

  return NextResponse.json({
    activeProviderId: service.getActiveProviderProfile()?.id ?? null,
    profile: toPublicProfile(saved),
    profiles: service.listProviderProfiles().map(toPublicProfile),
  });
}

export async function DELETE(request: Request) {
  const service = await getMemduckService();
  const payload = (await request.json()) as { id?: string };

  if (!payload.id) {
    return NextResponse.json(
      { error: "Provider profile id is required." },
      { status: 400 },
    );
  }

  service.deleteProviderProfile(payload.id);

  return NextResponse.json({
    activeProviderId: service.getActiveProviderProfile()?.id ?? null,
    profiles: service.listProviderProfiles().map(toPublicProfile),
  });
}
