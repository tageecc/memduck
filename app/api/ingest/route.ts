import { NextResponse } from "next/server";
import { readJsonRequest } from "@/lib/http/json-request";
import {
  inputEnvelopeSchema,
  requestedDepthSchema,
  sourceChannelSchema,
  sourceContextSchema,
} from "@/lib/memduck/contracts";
import { getMemduckService } from "@/lib/memduck/runtime";
import { getRuntimeDir } from "@/lib/memduck/runtime-path";
import type { InputEnvelope } from "@/lib/memduck/service";
import { createAssetStore } from "@/lib/storage/assets";

function formatIngestError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (
    message.includes("image length and width") ||
    message.includes("must be larger than 10")
  ) {
    return "图片尺寸太小，请换一张宽高都大于 10px 的图片。";
  }

  if (message.includes("No active provider profile")) {
    return "请先在模型设置里启用一个可用的模型配置。";
  }

  return "内容消化失败，请稍后重试。";
}

async function ingestOrError(envelope: InputEnvelope) {
  try {
    const service = await getMemduckService();
    const result = await service.ingest(envelope);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: formatIngestError(error) },
      { status: 502 },
    );
  }
}

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
    const sourceChannel = sourceChannelSchema.safeParse(
      formData.get("sourceChannel"),
    );
    const caption = formData.get("caption");
    const sourceContext = sourceContextSchema.safeParse(
      typeof caption === "string" && caption.length > 0
        ? { caption }
        : undefined,
    );

    if (
      !requestedDepth.success ||
      !sourceChannel.success ||
      !sourceContext.success
    ) {
      return NextResponse.json(
        {
          error: "Invalid ingest envelope",
          issues: {
            requestedDepth: requestedDepth.success
              ? undefined
              : requestedDepth.error.flatten(),
            sourceChannel: sourceChannel.success
              ? undefined
              : sourceChannel.error.flatten(),
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
      sourceChannel: sourceChannel.data,
      sourceContext: sourceContext.data,
    } satisfies InputEnvelope);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid ingest envelope",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    return ingestOrError(parsed.data);
  }

  const json = await readJsonRequest(request);
  if (!json.ok) {
    return json.response;
  }

  const parsed = inputEnvelopeSchema.safeParse(json.body as InputEnvelope);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid ingest envelope",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  return ingestOrError(parsed.data);
}
