import { NextResponse } from "next/server";
import { inputEnvelopeSchema } from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import { getRuntimeDir } from "@/lib/memduck/runtime-path";
import type { InputEnvelope } from "@/lib/memduck/service";
import { createAssetStore } from "@/lib/storage/assets";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required." },
        { status: 400 },
      );
    }

    const assetStore = createAssetStore(getRuntimeDir());
    const saved = assetStore.saveBuffer({
      bytes: Buffer.from(await file.arrayBuffer()),
      fileName: file.name || "capture.png",
      mimeType: file.type || "image/png",
      prefix: "uploads",
    });

    const service = await getMemduckService();
    const envelope: InputEnvelope = {
      kind: "image",
      payload: {
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        objectKey: saved.objectKey,
      },
      requestedDepth:
        (formData.get("requestedDepth") as InputEnvelope["requestedDepth"]) ??
        "quick",
      sourceChannel:
        (formData.get("sourceChannel") as InputEnvelope["sourceChannel"]) ??
        "web",
      sourceContext:
        typeof formData.get("caption") === "string" && formData.get("caption")
          ? { caption: String(formData.get("caption")) }
          : undefined,
    };

    const result = await service.ingest(envelope);
    return NextResponse.json(result);
  }

  const parsed = inputEnvelopeSchema.safeParse(
    (await request.json()) as InputEnvelope,
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid ingest envelope",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const service = await getMemduckService();
  const result = await service.ingest(parsed.data);
  return NextResponse.json(result);
}
