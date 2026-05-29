import { NextResponse } from "next/server";

import {
  inputEnvelopeSchema,
  requestedDepthSchema,
  sourceContextSchema,
} from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import { getRuntimeDir } from "@/lib/memduck/runtime-path";
import type { InputEnvelope } from "@/lib/memduck/service";
import { requireMobileSession } from "@/lib/mobile/auth";
import { mobileUnauthorized } from "@/lib/mobile/responses";
import { createAssetStore } from "@/lib/storage/assets";

export async function POST(request: Request) {
  const session = await requireMobileSession(request);
  if (!session) {
    return mobileUnauthorized();
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Image file is required." },
      { status: 400 },
    );
  }

  if (!file.name.trim() || !file.type.trim()) {
    return NextResponse.json(
      { error: "Image file name and MIME type are required." },
      { status: 400 },
    );
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "Image ingest only accepts image MIME types." },
      { status: 400 },
    );
  }

  const requestedDepth = requestedDepthSchema.safeParse(
    formData.get("requestedDepth"),
  );
  const caption = formData.get("caption");
  const sourceContext = sourceContextSchema.safeParse(
    typeof caption === "string" && caption.length > 0 ? { caption } : undefined,
  );

  if (!requestedDepth.success || !sourceContext.success) {
    return NextResponse.json(
      {
        error: "Invalid mobile multipart capture.",
        issues: {
          requestedDepth: requestedDepth.success
            ? undefined
            : requestedDepth.error.flatten(),
          sourceContext: sourceContext.success
            ? undefined
            : sourceContext.error.flatten(),
        },
      },
      { status: 400 },
    );
  }

  const assetStore = createAssetStore(getRuntimeDir());
  const saved = assetStore.saveBuffer({
    bytes: Buffer.from(await file.arrayBuffer()),
    fileName: file.name,
    mimeType: file.type,
    prefix: "uploads",
  });

  const parsed = inputEnvelopeSchema.safeParse({
    kind: "image",
    payload: {
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      objectKey: saved.objectKey,
    },
    requestedDepth: requestedDepth.data,
    sourceChannel: "ios",
    sourceContext: sourceContext.data,
  } satisfies InputEnvelope);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid mobile multipart capture.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  service.recordChannelHeartbeat({
    channel: "ios",
    metadata: { accountId: session.account.id, ingress: "mobile-multipart" },
    occurredAt: new Date().toISOString(),
  });

  return NextResponse.json(await service.ingest(parsed.data));
}
